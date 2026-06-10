import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { run as runResearcher } from '@/agents/researcher';
import { run as runCommunication } from '@/agents/communication';
import { run as runVenue } from '@/agents/venue';
import { run as runVendor } from '@/agents/vendor';
import { run as runSchedule } from '@/agents/schedule';
import { run as runAnalytics } from '@/agents/analytics';
import { run as runAttendee } from '@/agents/attendee';
import { run as runWhiteboard } from '@/agents/whiteboard';
import { run as runForms } from '@/agents/forms';
import { getEvent, updateEvent } from '@/lib/db/events';
import {
  applyEventDetailsPatch,
  eventDetailsPatchFromField,
  hasPersistedField,
} from '@/agents/orchestrator/event-details';

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT REGISTRY — maps agent names to their run functions
// ═══════════════════════════════════════════════════════════════════════════════

type AgentRun = (task: string, options?: { eventId?: string }) => Promise<string>;

const agentRegistry: Record<string, AgentRun> = {
  researcher: runResearcher,
  communication: runCommunication,
  venue: runVenue,
  vendor: runVendor,
  schedule: runSchedule,
  analytics: runAnalytics,
  attendee: runAttendee,
  whiteboard: runWhiteboard,
  forms: runForms,
};

export interface OrchestratorToolContext {
  eventId?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR TOOLS — delegation + event management (NO search/send tools)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build per-run orchestrator tools. The closure carries the server-known eventId,
 * so tools do not depend on prompt compliance or a user-visible eventId prefix.
 */
export function createOrchestratorTools(context: OrchestratorToolContext = {}) {
  const eventId = context.eventId ?? null;

  const delegateToAgentTool = new DynamicStructuredTool({
    name: 'delegate_to_agent',
    description: `Delegate a task to a specialized autonomous agent. Each agent has its own tools and loops until the task is complete.

Available agents:
- researcher: General web research (venues, food, activities, prices, images, reviews). Use for ANY search/lookup task.
- communication: Send WhatsApp messages and emails. Drafts professional messages.
- venue: Find and compare event venues (capacity, pricing, location, amenities).
- vendor: Find caterers, photographers, AV, decorators, entertainment providers.
- schedule: Build event timelines, detect conflicts, suggest optimal scheduling.
- analytics: Budget tracking, cost breakdowns, per-person calculations, spending alerts.
- attendee: Manage guest lists, RSVPs, dietary preferences, attendance tracking.
- whiteboard: Manages event state. Saves confirmed choices, removes cancelled items, generates visualization. Call after ANY decision is confirmed.
- forms: Generate registration forms, feedback surveys, RSVP pages, ticket pages, event landing pages. Returns structured page configs.

IMPORTANT: Be specific in the task description. Include all relevant context (headcount, budget, date, location, dietary needs, etc.).`,
    schema: z.object({
      agent: z.enum(['researcher', 'communication', 'venue', 'vendor', 'schedule', 'analytics', 'attendee', 'whiteboard', 'forms'])
        .describe('Which agent to delegate to'),
      task: z.string().describe('Detailed task description with all relevant context for the agent'),
    }),
    func: async ({ agent, task }) => {
      const runAgent = agentRegistry[agent];
      if (!runAgent) {
        return JSON.stringify({ error: `Unknown agent: ${agent}` });
      }

      try {
        if (agent === 'whiteboard') {
          if (!eventId) {
            return JSON.stringify({ error: 'Whiteboard agent requires an active eventId' });
          }
          return await runAgent(task, { eventId });
        }
        return await runAgent(task);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({ error: `Agent ${agent} failed: ${errMsg}` });
      }
    },
  });

  /**
   * Get current date/time — the orchestrator keeps this for quick date resolution.
   */
  const getCurrentDateTimeTool = new DynamicStructuredTool({
    name: 'get_current_datetime',
    description: 'Get current date/time in Singapore (SGT). ALWAYS use this when user mentions relative dates like "this weekend", "tomorrow", "next Friday".',
    schema: z.object({}),
    func: async () => {
      const now = new Date();
      const sgOptions: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Singapore', dateStyle: 'full', timeStyle: 'short' };
      const sgTime = now.toLocaleString('en-SG', sgOptions);
      const sgNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
      const dayOfWeek = sgNow.getDay();

      const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
      const saturday = new Date(sgNow.getTime() + daysUntilSat * 86400000);
      const sunday = new Date(saturday.getTime() + 86400000);
      const tomorrow = new Date(sgNow.getTime() + 86400000);
      const nextMonday = new Date(sgNow.getTime() + ((8 - dayOfWeek) % 7 || 7) * 86400000);

      return JSON.stringify({
        now: sgTime,
        today: sgNow.toISOString().split('T')[0],
        tomorrow: tomorrow.toISOString().split('T')[0],
        thisSaturday: saturday.toISOString().split('T')[0],
        thisSunday: sunday.toISOString().split('T')[0],
        nextMonday: nextMonday.toISOString().split('T')[0],
        timezone: 'Asia/Singapore (SGT, UTC+8)',
      });
    },
  });

  /**
   * Save structured event details. This now writes to the event record and
   * verifies the field exists after the write, instead of returning fake success.
   */
  const saveEventDetailsTool = new DynamicStructuredTool({
    name: 'save_event_details',
    description: 'Save confirmed event details (venue, catering, date, headcount, budget, schedule, topics, contacts/vendors) for tracking. Use when user confirms a choice or when a plan should appear on the event dashboard.',
    schema: z.object({
      field: z.enum(['venue', 'catering', 'date', 'time', 'budget', 'attendeeCount', 'attendees', 'schedule', 'vendor', 'contacts', 'topics', 'visibleSections'])
        .describe('Which field to save'),
      value: z.string().describe('Value to save. JSON strings are accepted for structured values.'),
      details: z.string().optional().describe('Additional details or notes, JSON if structured'),
    }),
    func: async ({ field, value, details }) => {
      if (!eventId) {
        return JSON.stringify({ saved: false, error: 'save_event_details requires an active eventId' });
      }

      const event = await getEvent(eventId);
      if (!event) {
        return JSON.stringify({ saved: false, error: 'Event not found' });
      }

      const patch = eventDetailsPatchFromField(field, value, details);
      if (patch.expectedFields.length === 0) {
        return JSON.stringify({ saved: false, field, error: 'No supported detail field parsed from value' });
      }

      await updateEvent(eventId, {
        details: applyEventDetailsPatch(event.details || {}, patch.details),
        ...(patch.attendeeCount ? { attendeeCount: patch.attendeeCount } : {}),
      });

      const verified = await getEvent(eventId);
      const missingFields = verified
        ? patch.expectedFields.filter((expectedField) => !hasPersistedField(verified, expectedField))
        : patch.expectedFields;

      return JSON.stringify({
        saved: missingFields.length === 0,
        field,
        expectedFields: patch.expectedFields,
        missingFields,
        timestamp: new Date().toISOString(),
      });
    },
  });

  return [
    delegateToAgentTool,
    getCurrentDateTimeTool,
    saveEventDetailsTool,
  ];
}

// Default tool set used by legacy imports and tests; request handling builds a
// per-event set through createOrchestratorTools().
export const orchestratorTools = createOrchestratorTools();
