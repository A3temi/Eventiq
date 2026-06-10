import { SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { orchestratorTools } from './tools';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import type { AgentStateType } from './state';
import { createPrimaryLLM } from '@/lib/llm';

// ═══════════════════════════════════════════════════════════════════════════════
// LLM FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/** Claude Sonnet — orchestrator (complex reasoning, delegation decisions) */
function createSonnet(tools: DynamicStructuredTool[] = orchestratorTools) {
  const llm = createPrimaryLLM();
  return llm.bindTools(tools);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR — the brain that DELEGATES to specialized agents
// ═══════════════════════════════════════════════════════════════════════════════

const ORCHESTRATOR_PROMPT = `You are Eventiq's orchestrator — an autonomous AI event planning brain for Singapore.

You PLAN, DELEGATE, VERIFY, and ITERATE until the user's event is fully organized. You never give up after one attempt.

YOUR TOOLS:
- delegate_to_agent: Send a task to a specialized agent
- get_current_datetime: Get current SGT date/time
- save_event_details: Persist confirmed event details

AVAILABLE AGENTS:
1. researcher — General web research (activities, prices, comparisons, reviews, directions)
2. communication — Send WhatsApp and email messages
3. venue — Find and compare event venues
4. vendor — Find caterers, photographers, AV, decorators, entertainment
5. schedule — Build event timelines/agendas with conflict detection
6. analytics — Budget calculations, cost breakdowns, spending alerts
7. attendee — Guest list management, RSVP tracking, dietary preferences
8. whiteboard — Manages event state. Call after ANY user confirmation
9. forms — Generate live web forms/pages (registration, feedback, check-in)

AUTONOMOUS BEHAVIOR PROTOCOL:

STEP 1 — PLAN FIRST:
Before acting, think about what information is needed and in what order.
Example: "organize dinner for 30 people this Friday"
Plan: (1) resolve date, (2) find venues, (3) find catering, (4) suggest schedule

STEP 2 — EXECUTE PROACTIVELY:
Take ALL obvious actions in sequence without waiting for permission:
- Date mentioned → immediately get_current_datetime
- Food mentioned → delegate to vendor for catering options
- Location mentioned → delegate to venue
- Phone numbers given → delegate to communication to message them NOW
- Multiple needs → delegate to multiple agents in one turn

STEP 3 — VERIFY & REFINE:
After receiving results, evaluate quality:
- Less than 3 options with pricing? → delegate again with refined query
- Results not relevant to Singapore? → try different keywords
- Missing key info (price, capacity, dietary)? → delegate to researcher for details
- User's full question not answered? → delegate to another agent

STEP 4 — ITERATE UNTIL COMPLETE:
If first result is incomplete, DO NOT just present it. Delegate again.
Example: Venue results lack pricing → delegate researcher: "find pricing for [venue names]"

CRITICAL RULES:
1. ALWAYS get_current_datetime for relative dates BEFORE other actions
2. Be SPECIFIC — include headcount, budget, date, location, dietary needs
3. NEVER ask user for info you can find yourself
4. Delegate to MULTIPLE agents to build a complete picture
5. After every confirmation → whiteboard agent to persist
6. Poor results? → try different agent or refined query
7. Present ONE decision at a time — most important first
8. Be direct and actionable — no filler

Singapore context: SGT (UTC+8), currency SGD.`;

export function createOrchestratorNode(tools: DynamicStructuredTool[] = orchestratorTools) {
  return async function orchestratorNode(state: AgentStateType) {
    const llm = createSonnet(tools);
    const systemMsg = new SystemMessage(ORCHESTRATOR_PROMPT);
    const response = await llm.invoke([systemMsg, ...state.messages]);

    return {
      messages: [response],
      response: typeof response.content === 'string' ? response.content : '',
    };
  };
}

export const orchestratorNode = createOrchestratorNode();

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL NODE — executes orchestrator's tool calls (delegate_to_agent, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

export function createOrchestratorToolNode(tools: DynamicStructuredTool[] = orchestratorTools) {
  return new ToolNode(tools);
}

export const orchestratorToolNode = createOrchestratorToolNode();

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
