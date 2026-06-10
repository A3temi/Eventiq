import { ChatBedrockConverse } from '@langchain/aws';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE AGENT — Timeline building and conflict detection
// ═══════════════════════════════════════════════════════════════════════════════

const getCurrentDateTimeTool = new DynamicStructuredTool({
  name: 'get_current_datetime',
  description: 'Get current date/time in Singapore (SGT). Use for relative dates like "this weekend", "tomorrow", "next Friday".',
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

const createTimelineTool = new DynamicStructuredTool({
  name: 'create_timeline',
  description: 'Generate a structured event agenda/timeline with automatic transition buffers and conflict detection.',
  schema: z.object({
    eventName: z.string().describe('Name of the event'),
    date: z.string().describe('Event date (YYYY-MM-DD)'),
    startTime: z.string().describe('Start time (HH:MM, 24h format)'),
    endTime: z.string().describe('End time (HH:MM, 24h format)'),
    sessions: z.array(z.object({
      topic: z.string(),
      speaker: z.string().optional(),
      durationMinutes: z.number(),
      type: z.enum(['keynote', 'talk', 'workshop', 'break', 'networking', 'meal']),
    })).describe('Sessions to schedule in order'),
  }),
  func: async ({ eventName, date, startTime, endTime, sessions }) => {
    const scheduled: Array<{
      topic: string;
      speaker?: string;
      durationMinutes: number;
      type: string;
      startTime: string;
      endTime: string;
    }> = [];
    let currentTime = new Date(`${date}T${startTime}:00+08:00`);
    const endDateTime = new Date(`${date}T${endTime}:00+08:00`);

    for (const session of sessions) {
      const sessionEnd = new Date(currentTime.getTime() + session.durationMinutes * 60000);
      scheduled.push({
        ...session,
        startTime: currentTime.toTimeString().slice(0, 5),
        endTime: sessionEnd.toTimeString().slice(0, 5),
      });
      // 5-minute transition buffer between sessions
      currentTime = new Date(sessionEnd.getTime() + 5 * 60000);
    }

    const overflow = currentTime > endDateTime;
    return JSON.stringify({
      eventName,
      date,
      scheduledSessions: scheduled,
      totalDuration: `${startTime} – ${endTime}`,
      sessionsCount: scheduled.length,
      fitsInTimeSlot: !overflow,
      warning: overflow ? 'Schedule exceeds the end time. Consider shortening sessions.' : null,
    });
  },
});

const checkConflictsTool = new DynamicStructuredTool({
  name: 'check_conflicts',
  description: 'Check for scheduling conflicts between sessions or with external constraints.',
  schema: z.object({
    sessions: z.array(z.object({
      name: z.string(),
      startTime: z.string().describe('HH:MM format'),
      endTime: z.string().describe('HH:MM format'),
      room: z.string().optional(),
    })).describe('Sessions to check for conflicts'),
    constraints: z.array(z.string()).optional().describe('External constraints (e.g. "lunch must be between 12:00-13:00")'),
  }),
  func: async ({ sessions, constraints }) => {
    const conflicts: string[] = [];

    // Check for time overlaps
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i];
        const b = sessions[j];
        if (a.room && b.room && a.room !== b.room) continue; // Different rooms OK
        if (a.startTime < b.endTime && b.startTime < a.endTime) {
          conflicts.push(`CONFLICT: "${a.name}" (${a.startTime}-${a.endTime}) overlaps with "${b.name}" (${b.startTime}-${b.endTime})`);
        }
      }
    }

    // Check constraints
    if (constraints) {
      for (const constraint of constraints) {
        conflicts.push(`CONSTRAINT: ${constraint} — manual verification needed`);
      }
    }

    return JSON.stringify({
      hasConflicts: conflicts.length > 0,
      conflicts,
      sessionsChecked: sessions.length,
    });
  },
});

const tools = [getCurrentDateTimeTool, createTimelineTool, checkConflictsTool];

const SYSTEM_PROMPT = `You are Eventiq's Schedule Specialist for Singapore.

Your job: Build event timelines, detect conflicts, and suggest optimal scheduling.

CAPABILITIES:
- get_current_datetime: Get current SGT date/time (for relative date references)
- create_timeline: Build a structured event agenda with automatic buffers
- check_conflicts: Detect scheduling overlaps and constraint violations

BEHAVIOR:
1. ALWAYS call get_current_datetime first if the user mentions relative dates
2. Build timelines with appropriate breaks and transitions
3. Check for conflicts after creating schedules
4. Present formatted timelines with clear time blocks

SCHEDULING BEST PRACTICES:
- Keynote: 30-45 min
- Talk/presentation: 20-30 min
- Workshop: 60-90 min
- Coffee break: 15-20 min
- Lunch: 45-60 min
- Networking: 20-30 min
- Always include 5-min transitions between sessions
- Morning sessions for high-energy content
- Post-lunch slots for interactive workshops (avoid passive talks)

RULES:
- Warn if schedule exceeds the time window
- Include break frequency (every 90 min max)
- Note Singapore considerations (prayer times, peak MRT hours 8-9am, 5:30-7pm)
- Present as formatted timeline table
- Suggest alternatives if schedule doesn't fit`;

const ScheduleState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type ScheduleStateType = typeof ScheduleState.State;

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

async function agentNode(state: ScheduleStateType) {
  const llm = createHaiku();
  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

function router(state: ScheduleStateType): 'tools' | '__end__' {
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

function buildScheduleGraph() {
  const toolNode = new ToolNode(tools);
  return new StateGraph(ScheduleState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', router, { tools: 'tools', __end__: '__end__' })
    .addEdge('tools', 'agent')
    .compile();
}

let compiledGraph: ReturnType<typeof buildScheduleGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildScheduleGraph();
  }
  return compiledGraph;
}

/**
 * Run the schedule agent autonomously.
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

  return 'Schedule creation completed but no structured response was generated.';
}
