import { createFastLLM } from '@/lib/llm';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getEvent, updateEvent } from '@/lib/db/events';
import type { EventDetails } from '@/types/event';

// ═══════════════════════════════════════════════════════════════════════════════
// WHITEBOARD AGENT — Manages event state and generates visualization config
// ═══════════════════════════════════════════════════════════════════════════════

interface WhiteboardSection {
  id: string;
  type: 'date' | 'venue' | 'catering' | 'schedule' | 'contacts' | 'budget' | 'topics' | 'custom';
  title: string;
  status: 'confirmed' | 'discussing' | 'pending';
  content: Record<string, any>;
  order: number;
}

interface WhiteboardConfig {
  sections: WhiteboardSection[];
}

type WhiteboardTool = DynamicStructuredTool;

function createWhiteboardTools(eventId: string): WhiteboardTool[] {
  const getCurrentEvent = async () => getEvent(eventId);

  const saveEventStateTool = new DynamicStructuredTool({
    name: 'save_event_state',
    description: `Save a key-value to the event record. Supported fields: date, time, venue, catering, attendees, schedule, contacts, topics, budget, visibleSections. Use this after a user confirms a decision.`,
    schema: z.object({
      field: z.enum(['date', 'time', 'venue', 'catering', 'attendees', 'schedule', 'contacts', 'topics', 'budget', 'visibleSections'])
        .describe('Which field to save'),
      value: z.string().describe('JSON-encoded value to save for the field'),
    }),
    func: async ({ field, value }) => {
      const event = await getCurrentEvent();
      if (!event) return JSON.stringify({ error: 'Event not found' });

      const details: EventDetails = event.details || {};
      let parsedValue: any;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }

      switch (field) {
        case 'date':
          details.confirmedDate = parsedValue;
          break;
        case 'time':
          details.confirmedTime = parsedValue;
          break;
        case 'venue':
          details.confirmedVenue = typeof parsedValue === 'string'
            ? { name: parsedValue, status: 'confirmed' }
            : { ...parsedValue, status: parsedValue.status || 'confirmed' };
          break;
        case 'catering':
          details.confirmedCatering = typeof parsedValue === 'string'
            ? { name: parsedValue, status: 'confirmed' }
            : { ...parsedValue, status: parsedValue.status || 'confirmed' };
          break;
        case 'attendees':
          if (typeof parsedValue === 'number') {
            await updateEvent(eventId, { attendeeCount: parsedValue });
          }
          break;
        case 'schedule':
          details.schedule = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
          break;
        case 'contacts':
          details.contacts = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
          break;
        case 'topics':
          details.topics = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
          break;
        case 'budget':
          details.budget = typeof parsedValue === 'object' ? parsedValue : { total: parsedValue };
          break;
        case 'visibleSections':
          details.visibleSections = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
          break;
      }

      if (field !== 'visibleSections' && field !== 'attendees') {
        const sections = details.visibleSections || [];
        if (!sections.includes(field)) details.visibleSections = [...sections, field];
      }

      await updateEvent(eventId, { details });
      return JSON.stringify({ saved: true, field, timestamp: new Date().toISOString() });
    },
  });

  const removeEventStateTool = new DynamicStructuredTool({
    name: 'remove_event_state',
    description: 'Remove a field from the event state. User says "remove agenda" → removes schedule section.',
    schema: z.object({
      field: z.enum(['date', 'time', 'venue', 'catering', 'schedule', 'contacts', 'topics', 'budget'])
        .describe('Which field to remove'),
    }),
    func: async ({ field }) => {
      const event = await getCurrentEvent();
      if (!event) return JSON.stringify({ error: 'Event not found' });

      const details: EventDetails = event.details || {};
      switch (field) {
        case 'date': delete details.confirmedDate; break;
        case 'time': delete details.confirmedTime; break;
        case 'venue': delete details.confirmedVenue; break;
        case 'catering': delete details.confirmedCatering; break;
        case 'schedule': delete details.schedule; break;
        case 'contacts': delete details.contacts; break;
        case 'topics': delete details.topics; break;
        case 'budget': delete details.budget; break;
      }

      if (details.visibleSections) {
        details.visibleSections = details.visibleSections.filter((s) => s !== field);
      }

      await updateEvent(eventId, { details });
      return JSON.stringify({ removed: true, field, timestamp: new Date().toISOString() });
    },
  });

  const getEventStateTool = new DynamicStructuredTool({
    name: 'get_event_state',
    description: 'Read the current event state including all confirmed details.',
    schema: z.object({}),
    func: async () => {
      const event = await getCurrentEvent();
      if (!event) return JSON.stringify({ error: 'Event not found' });
      return JSON.stringify({
        id: event.id,
        name: event.name,
        status: event.status,
        attendeeCount: event.attendeeCount,
        details: event.details || {},
      });
    },
  });

  const generateWhiteboardTool = new DynamicStructuredTool({
    name: 'generate_whiteboard',
    description: 'Generate a structured visualization config from the current event state. Returns which sections to show, their order, content, and status.',
    schema: z.object({
      eventState: z.string().describe('JSON string of the current event state (from get_event_state)'),
    }),
    func: async ({ eventState }) => {
      let state: any;
      try {
        state = JSON.parse(eventState);
      } catch {
        return JSON.stringify({ error: 'Invalid event state JSON' });
      }
      return JSON.stringify(generateWhiteboardConfig(state.details || {}, state.attendeeCount));
    },
  });

  return [saveEventStateTool, removeEventStateTool, getEventStateTool, generateWhiteboardTool];
}

function generateWhiteboardConfig(details: EventDetails, attendeeCount?: number): WhiteboardConfig {
  const sections: WhiteboardSection[] = [];
  let order = 0;

  if (details.confirmedDate || details.confirmedTime) {
    sections.push({ id: 'date', type: 'date', title: 'Date & Time', status: 'confirmed', content: { date: details.confirmedDate, time: details.confirmedTime }, order: order++ });
  }
  if (details.confirmedVenue) {
    sections.push({ id: 'venue', type: 'venue', title: 'Venue', status: details.confirmedVenue.status || 'confirmed', content: details.confirmedVenue, order: order++ });
  }
  if (details.confirmedCatering) {
    sections.push({ id: 'catering', type: 'catering', title: 'Catering', status: details.confirmedCatering.status || 'confirmed', content: details.confirmedCatering, order: order++ });
  }
  if ((details.contacts && details.contacts.length > 0) || (attendeeCount && attendeeCount > 0)) {
    const contacts = details.contacts ?? [];
    const confirmed = contacts.filter((c) => c.status === 'confirmed').length;
    const pending = contacts.length - confirmed;
    sections.push({ id: 'contacts', type: 'contacts', title: 'Attendees', status: confirmed > 0 ? 'confirmed' : 'pending', content: { contacts, confirmed, pending, total: attendeeCount || contacts.length }, order: order++ });
  }
  if (details.schedule && details.schedule.length > 0) {
    const allConfirmed = details.schedule.every((s) => s.status === 'confirmed');
    const anyDiscussing = details.schedule.some((s) => s.status === 'discussing');
    sections.push({ id: 'schedule', type: 'schedule', title: 'Schedule', status: allConfirmed ? 'confirmed' : anyDiscussing ? 'discussing' : 'pending', content: { items: details.schedule }, order: order++ });
  }
  if (details.budget) {
    const committed = details.budget.committed || 0;
    sections.push({ id: 'budget', type: 'budget', title: 'Budget', status: committed > 0 ? 'confirmed' : 'pending', content: details.budget, order: order++ });
  }
  if (details.topics && details.topics.length > 0) {
    sections.push({ id: 'topics', type: 'topics', title: 'Topics', status: 'confirmed', content: { topics: details.topics }, order: order++ });
  }

  return { sections };
}

// ─── LangGraph Setup ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Whiteboard Agent for Eventiq, an event planning platform.

Your job: Parse user/orchestrator messages to extract confirmed decisions and save them to the event state. Also handle add/remove requests.

TOOLS:
- save_event_state: Save a confirmed decision (date, venue, catering, schedule, contacts, topics, budget)
- remove_event_state: Remove a field the user doesn't want anymore
- get_event_state: Read current state
- generate_whiteboard: Generate visualization config from current state

BEHAVIOR:
1. Parse the incoming task to identify what was confirmed or what needs to be removed
2. Use save_event_state for each confirmed item
3. Use remove_event_state when user says "remove X" or "delete X"  
4. After saving/removing, call get_event_state then generate_whiteboard to return the updated visualization
5. Always return the whiteboard config at the end

VALUE FORMATS (pass as JSON strings):
- date: "Saturday, June 14" (plain string)
- time: "2:00 PM" (plain string)
- venue: {"name": "Exa Office", "url": "https://...", "price": "$500", "status": "confirmed"}
- catering: {"name": "Grain", "price": "$31.80/pax", "status": "discussing"}
- schedule: [{"time": "14:00", "title": "Welcome", "status": "confirmed"}, ...]
- contacts: [{"name": "John", "email": "john@...", "status": "confirmed"}, ...]
- topics: ["Topic 1", "Topic 2"]
- budget: {"total": 5000, "committed": 1272, "items": [{"name": "Catering", "amount": 1272, "status": "committed"}]}
- attendees: 40 (number)

PARSING RULES:
- "confirmed X" or "let's go with X" → save with status "confirmed"
- "considering X" or "looking at X" → save with status "discussing"
- "remove X" or "delete X" or "no longer need X" → remove_event_state
- "add X section" → save with status "pending"`;

const WhiteboardState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type WhiteboardStateType = typeof WhiteboardState.State;

function createAgentNode(tools: WhiteboardTool[]) {
  return async function agentNode(state: WhiteboardStateType) {
    const llm = createFastLLM().bindTools(tools);
    const response = await llm.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      ...state.messages,
    ]);
    return { messages: [response] };
  };
}

function router(state: WhiteboardStateType): 'tools' | '__end__' {
  const last = state.messages[state.messages.length - 1];
  if (
    last &&
    'tool_calls' in last &&
    Array.isArray((last as any).tool_calls) &&
    (last as any).tool_calls.length > 0
  ) {
    return 'tools';
  }
  return '__end__';
}

function buildWhiteboardGraph(eventId: string) {
  const tools = createWhiteboardTools(eventId);
  const toolNode = new ToolNode(tools);
  return new StateGraph(WhiteboardState)
    .addNode('agent', createAgentNode(tools))
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', router, { tools: 'tools', __end__: '__end__' })
    .addEdge('tools', 'agent')
    .compile();
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run the whiteboard agent autonomously. Prefer options.eventId; the legacy
 * "eventId:<id> |" prefix is accepted for backward compatibility only.
 */
export async function run(task: string, options: { eventId?: string } = {}): Promise<string> {
  const eventIdMatch = task.match(/^eventId:([^\s|]+)\s*\|\s*/);
  const eventId = options.eventId ?? eventIdMatch?.[1];
  if (eventIdMatch) task = task.replace(eventIdMatch[0], '');
  if (!eventId) return JSON.stringify({ error: 'No active event ID set for whiteboard agent' });

  const graph = buildWhiteboardGraph(eventId);
  const result = await graph.invoke({
    messages: [new HumanMessage(task)],
  });

  const aiMessages = result.messages.filter((m: BaseMessage) => m._getType?.() === 'ai');
  for (let i = aiMessages.length - 1; i >= 0; i--) {
    const content = aiMessages[i].content;
    if (typeof content === 'string' && content.trim().length > 10) {
      const hasToolCalls = 'tool_calls' in aiMessages[i] &&
        Array.isArray((aiMessages[i] as any).tool_calls) &&
        (aiMessages[i] as any).tool_calls.length > 0;
      if (!hasToolCalls) return content;
    }
  }

  for (let i = aiMessages.length - 1; i >= 0; i--) {
    const content = aiMessages[i].content;
    if (typeof content === 'string' && content.trim().length > 0) return content;
  }

  return 'Whiteboard state updated successfully.';
}
