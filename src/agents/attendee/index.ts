import { ChatBedrockConverse } from '@langchain/aws';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDEE AGENT — Guest list management, RSVPs, dietary preferences
// ═══════════════════════════════════════════════════════════════════════════════

// In-memory store for attendees (in production this would be DynamoDB)
const attendeeStore: Map<string, Array<{
  name: string;
  email?: string;
  phone?: string;
  rsvp: 'pending' | 'confirmed' | 'declined';
  dietary?: string;
  notes?: string;
}>> = new Map();

const addAttendeeTool = new DynamicStructuredTool({
  name: 'add_attendee',
  description: 'Add one or more attendees to the guest list. Tracks name, contact, dietary preferences.',
  schema: z.object({
    eventId: z.string().optional().default('default').describe('Event identifier'),
    attendees: z.array(z.object({
      name: z.string().describe('Attendee full name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      dietary: z.string().optional().describe('Dietary requirements (halal, vegetarian, nut-free, etc.)'),
      notes: z.string().optional().describe('Additional notes'),
    })).describe('List of attendees to add'),
  }),
  func: async ({ eventId, attendees }) => {
    const existing = attendeeStore.get(eventId) || [];
    const added: string[] = [];

    for (const attendee of attendees) {
      // Check for duplicates by name
      const duplicate = existing.find(e => e.name.toLowerCase() === attendee.name.toLowerCase());
      if (duplicate) {
        // Update existing
        Object.assign(duplicate, { ...attendee, rsvp: duplicate.rsvp });
        added.push(`${attendee.name} (updated)`);
      } else {
        existing.push({ ...attendee, rsvp: 'pending' });
        added.push(`${attendee.name} (added)`);
      }
    }

    attendeeStore.set(eventId, existing);
    return JSON.stringify({
      success: true,
      totalAttendees: existing.length,
      processed: added,
      summary: {
        confirmed: existing.filter(a => a.rsvp === 'confirmed').length,
        pending: existing.filter(a => a.rsvp === 'pending').length,
        declined: existing.filter(a => a.rsvp === 'declined').length,
      },
    });
  },
});

const getAttendeeListTool = new DynamicStructuredTool({
  name: 'get_attendee_list',
  description: 'Get the current guest list with RSVP status and dietary information.',
  schema: z.object({
    eventId: z.string().optional().default('default').describe('Event identifier'),
    filter: z.enum(['all', 'confirmed', 'pending', 'declined']).optional().default('all').describe('Filter by RSVP status'),
  }),
  func: async ({ eventId, filter }) => {
    const attendees = attendeeStore.get(eventId) || [];
    const filtered = filter === 'all'
      ? attendees
      : attendees.filter(a => a.rsvp === filter);

    const dietarySummary = attendees.reduce((acc, a) => {
      if (a.dietary) {
        acc[a.dietary] = (acc[a.dietary] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return JSON.stringify({
      total: attendees.length,
      filtered: filtered.length,
      filterApplied: filter,
      attendees: filtered.map(a => ({
        name: a.name,
        email: a.email || 'N/A',
        phone: a.phone || 'N/A',
        rsvp: a.rsvp,
        dietary: a.dietary || 'None specified',
      })),
      summary: {
        confirmed: attendees.filter(a => a.rsvp === 'confirmed').length,
        pending: attendees.filter(a => a.rsvp === 'pending').length,
        declined: attendees.filter(a => a.rsvp === 'declined').length,
      },
      dietarySummary,
    });
  },
});

const trackRsvpTool = new DynamicStructuredTool({
  name: 'track_rsvp',
  description: 'Update RSVP status for one or more attendees.',
  schema: z.object({
    eventId: z.string().optional().default('default').describe('Event identifier'),
    updates: z.array(z.object({
      name: z.string().describe('Attendee name'),
      rsvp: z.enum(['confirmed', 'declined', 'pending']).describe('New RSVP status'),
      dietary: z.string().optional().describe('Updated dietary requirement'),
    })).describe('RSVP updates'),
  }),
  func: async ({ eventId, updates }) => {
    const attendees = attendeeStore.get(eventId) || [];
    const results: string[] = [];

    for (const update of updates) {
      const attendee = attendees.find(a => a.name.toLowerCase() === update.name.toLowerCase());
      if (attendee) {
        attendee.rsvp = update.rsvp;
        if (update.dietary) attendee.dietary = update.dietary;
        results.push(`${update.name}: ${update.rsvp}`);
      } else {
        results.push(`${update.name}: NOT FOUND in guest list`);
      }
    }

    attendeeStore.set(eventId, attendees);
    return JSON.stringify({
      success: true,
      updates: results,
      currentSummary: {
        total: attendees.length,
        confirmed: attendees.filter(a => a.rsvp === 'confirmed').length,
        pending: attendees.filter(a => a.rsvp === 'pending').length,
        declined: attendees.filter(a => a.rsvp === 'declined').length,
      },
    });
  },
});

const tools = [addAttendeeTool, getAttendeeListTool, trackRsvpTool];

const SYSTEM_PROMPT = `You are Eventiq's Attendee Management Agent.

Your job: Manage guest lists, track RSVPs, handle dietary preferences, and provide attendee summaries.

CAPABILITIES:
- add_attendee: Add people to the guest list (with contact info, dietary needs)
- get_attendee_list: View current guest list (filter by RSVP status)
- track_rsvp: Update RSVP status for attendees

BEHAVIOR:
1. Parse attendee information from the task
2. Add/update attendees as needed
3. Provide clear summaries of guest list status
4. Highlight dietary requirements for catering coordination

RULES:
- Always confirm what was added/updated
- Provide RSVP counts (confirmed/pending/declined)
- List dietary requirements summary for catering
- Flag any duplicates
- Format output clearly with attendee details`;

const AttendeeState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type AttendeeStateType = typeof AttendeeState.State;

function createHaiku() {
  return new ChatBedrockConverse({
    model: 'us.anthropic.claude-3-haiku-20240307-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    temperature: 0.2,
    maxTokens: 4096,
  }).bindTools(tools);
}

async function agentNode(state: AttendeeStateType) {
  const llm = createHaiku();
  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

function router(state: AttendeeStateType): 'tools' | '__end__' {
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

function buildAttendeeGraph() {
  const toolNode = new ToolNode(tools);
  return new StateGraph(AttendeeState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', router, { tools: 'tools', __end__: '__end__' })
    .addEdge('tools', 'agent')
    .compile();
}

let compiledGraph: ReturnType<typeof buildAttendeeGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildAttendeeGraph();
  }
  return compiledGraph;
}

/**
 * Run the attendee agent autonomously.
 */
export async function run(task: string): Promise<string> {
  const graph = getGraph();
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
    if (typeof content === 'string' && content.trim().length > 0) {
      return content;
    }
  }

  return 'Attendee management completed but no structured response was generated.';
}
