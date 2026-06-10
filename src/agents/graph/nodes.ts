import { SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { orchestratorTools } from './tools';
import type { AgentStateType } from './state';
import { createPrimaryLLM } from '@/lib/llm';

// ═══════════════════════════════════════════════════════════════════════════════
// LLM FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/** Claude Sonnet — orchestrator (complex reasoning, delegation decisions) */
function createSonnet() {
  const llm = createPrimaryLLM();
  return llm.bindTools(orchestratorTools);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR — the brain that DELEGATES to specialized agents
// ═══════════════════════════════════════════════════════════════════════════════

const ORCHESTRATOR_PROMPT = `You are Eventiq's orchestrator — an AI event planning brain for Singapore.

You DELEGATE tasks to specialized autonomous agents. You do NOT search, send messages, or do research yourself.

YOUR TOOLS:
- delegate_to_agent: Send a task to a specialized agent (researcher, communication, venue, vendor, schedule, analytics, attendee)
- get_current_datetime: Get current SGT date/time (for resolving "this weekend", "tomorrow", etc.)
- save_event_details: Persist confirmed event details

AVAILABLE AGENTS:
1. **researcher** — General web research. Use for ANY lookup: activities, prices, comparisons, reviews, directions, ideas.
2. **communication** — Send WhatsApp and email messages. Drafts professional messages for Singapore business culture.
3. **venue** — Find and compare event venues. Knows Singapore areas, pricing, capacity.
4. **vendor** — Find caterers, photographers, AV, decorators, florists, entertainment.
5. **schedule** — Build event timelines/agendas. Handles transitions, breaks, conflict detection.
6. **analytics** — Budget calculations, cost breakdowns, per-person costs, spending alerts.
7. **attendee** — Guest list management, RSVP tracking, dietary preferences.
8. **whiteboard** — Manages event state. Call after ANY user confirmation to save the decision. Also call to remove items user doesn't want.
9. **forms** — Generate web forms/pages: registration, feedback surveys, RSVP, tickets with QR codes, event landing pages.

CRITICAL BEHAVIOR:
1. ALWAYS resolve relative dates (call get_current_datetime) BEFORE delegating date-sensitive tasks
2. Be SPECIFIC in your delegation — include headcount, budget, date, location, dietary needs, etc.
3. For RESEARCH tasks (looking up info, finding options), delegate to the appropriate specialist:
   - Venue search → venue agent
   - Vendor/catering search → vendor agent  
   - General research (activities, ideas, prices) → researcher agent
4. You can delegate to MULTIPLE agents in sequence if needed
5. After receiving agent results, compose a clear, helpful response for the user
6. Use save_event_details when the user confirms a choice
7. After EVERY confirmation from the user, delegate to whiteboard agent to save the state

DELEGATION EXAMPLES:
- "plan a team building" → delegate_to_agent(researcher, "Find team building activities in Singapore, include pricing and reviews")
- "find a caterer for 40 people" → delegate_to_agent(vendor, "Find catering services for 40 people in Singapore, include halal options and pricing")
- "send a message to +6591234567" → delegate_to_agent(communication, "Send WhatsApp to +6591234567: [message content]")
- "how much is Marina Bay Sands" → delegate_to_agent(venue, "Find pricing and event space details for Marina Bay Sands Singapore")
- "create a schedule for our conference" → delegate_to_agent(schedule, "Create timeline for conference on [date], [start]-[end], sessions: ...")
- "what's our budget looking like" → delegate_to_agent(analytics, "Calculate budget breakdown: total $X, items: ...")

RESPONSE STYLE:
- Present agent results in a clean, structured format
- Use numbered lists for options
- Include URLs, prices, and key details
- Be proactive — don't ask the user for info you can delegate agents to find
- Singapore context (SGT UTC+8, currency SGD)`;

export async function orchestratorNode(state: AgentStateType) {
  const llm = createSonnet();
  const systemMsg = new SystemMessage(ORCHESTRATOR_PROMPT);
  const response = await llm.invoke([systemMsg, ...state.messages]);

  return {
    messages: [response],
    response: typeof response.content === 'string' ? response.content : '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL NODE — executes orchestrator's tool calls (delegate_to_agent, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

export const orchestratorToolNode = new ToolNode(orchestratorTools);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export function trackToolsNode(state: AgentStateType) {
  const toolNames: string[] = [];
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const msg = state.messages[i];
    const msgType = msg._getType?.() || (msg as any).constructor?.name;
    if (msgType === 'tool' || msgType === 'ToolMessage') {
      const toolName = (msg as any).name || 'unknown';
      toolNames.push(toolName);

      // If the tool was delegate_to_agent, also record which agent was called
      // by checking the tool call content for agent identification
      if (toolName === 'delegate_to_agent') {
        // Parse which sub-agent was invoked from the tool call args
        // This enriches the tracking with sub-agent info
        const content = typeof (msg as any).content === 'string' ? (msg as any).content : '';
        if (content.includes('venue')) toolNames.push('search_venues');
        else if (content.includes('vendor') || content.includes('cater')) toolNames.push('search_vendors');
        else if (content.includes('search') || content.includes('research')) toolNames.push('web_search');
        else if (content.includes('WhatsApp') || content.includes('whatsapp')) toolNames.push('send_whatsapp');
        else if (content.includes('email') || content.includes('Email')) toolNames.push('send_email');
        else if (content.includes('schedule') || content.includes('timeline')) toolNames.push('create_schedule');
        else if (content.includes('budget') || content.includes('cost')) toolNames.push('get_budget_summary');
      }
    } else {
      break;
    }
  }
  return { toolsUsed: toolNames };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTING LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function hasToolCalls(state: AgentStateType): boolean {
  const last = state.messages[state.messages.length - 1];
  return !!(
    last &&
    'tool_calls' in last &&
    Array.isArray((last as any).tool_calls) &&
    (last as any).tool_calls.length > 0
  );
}

/** After orchestrator: run tools if it made tool calls, otherwise end */
export function orchestratorRouter(state: AgentStateType): 'orchestrator_tools' | '__end__' {
  return hasToolCalls(state) ? 'orchestrator_tools' : '__end__';
}
