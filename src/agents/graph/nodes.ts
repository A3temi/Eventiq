import { ChatBedrockConverse } from '@langchain/aws';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  allTools,
  venueAgentTools,
  vendorAgentTools,
  foodAgentTools,
  communicationAgentTools,
  scheduleAgentTools,
  analyticsAgentTools,
} from './tools';
import type { AgentStateType } from './state';

// ═══════════════════════════════════════════════════════════════════════════════
// LLM FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/** Claude Sonnet — orchestrator (complex reasoning/routing) */
function createSonnet(tools: any[] = []) {
  const llm = new ChatBedrockConverse({
    model: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    temperature: 0.3,
    maxTokens: 4096,
  });
  return tools.length > 0 ? llm.bindTools(tools) : llm;
}

/** Claude Haiku — sub-agents (fast, cheap, tool execution) */
function createHaiku(tools: any[] = []) {
  const llm = new ChatBedrockConverse({
    model: 'us.anthropic.claude-3-haiku-20240307-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    temperature: 0.2,
    maxTokens: 4096,
  });
  return tools.length > 0 ? llm.bindTools(tools) : llm;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract only the clean user/assistant messages (no tool_use or tool_result).
 * Sub-agents receive this so they don't see orphaned tool calls from the orchestrator.
 */
function getCleanHistory(messages: BaseMessage[]): BaseMessage[] {
  return messages.filter((m) => {
    const type = m._getType?.();
    // Keep only human and AI messages that don't have tool calls
    if (type === 'human') return true;
    if (type === 'ai') {
      const hasToolCalls = 'tool_calls' in m &&
        Array.isArray((m as any).tool_calls) &&
        (m as any).tool_calls.length > 0;
      return !hasToolCalls;
    }
    return false;
  });
}

/**
 * Get the last human message content from state.
 */
function getLastUserMessage(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]._getType?.() === 'human') {
      return typeof messages[i].content === 'string'
        ? messages[i].content as string
        : '';
    }
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR — the brain that routes to specialized agents
// ═══════════════════════════════════════════════════════════════════════════════

const ORCHESTRATOR_PROMPT = `You are Eventiq's orchestrator — an AI event planning brain for Singapore.

You have tools to RESEARCH and ACT. NEVER ask the user for information you can look up yourself.

TOOLS:
- search_venues: Find event venues
- search_vendors: Find service providers
- search_catering: Find food/catering
- send_whatsapp / send_email: Send real messages
- get_current_datetime: Get current date (use for "this weekend" etc.)
- create_schedule: Build event timelines
- get_budget_summary: Analyze budget
- web_search: Look up ANY public information (pricing, reviews, availability, ideas, directions, contacts, etc.)

CRITICAL BEHAVIOR:
1. If you need information to answer the user, USE web_search to find it. Do NOT ask the user.
2. ALWAYS call get_current_datetime for relative dates ("this weekend", "tomorrow")
3. Use EXACT numbers from the user (40 people = 40, not 50)
4. Be PROACTIVE — research and present answers, don't ask clarifying questions unless truly ambiguous
5. Present results as structured numbered lists
6. Singapore context (SGT UTC+8, currency SGD)

EXAMPLES OF PROACTIVE BEHAVIOR:
- User: "plan a team building" → web_search for team building activities Singapore, then present options
- User: "how much is Marina Bay Sands" → web_search for MBS event pricing, don't ask "what kind of event?"
- User: "get a caterer for 40 people" → search_catering immediately with reasonable defaults
- User: "what are good conference venues" → search_venues immediately`;

export async function orchestratorNode(state: AgentStateType) {
  const llm = createSonnet(allTools);
  const systemMsg = new SystemMessage(ORCHESTRATOR_PROMPT);
  const response = await llm.invoke([systemMsg, ...state.messages]);

  return {
    messages: [response],
    response: typeof response.content === 'string' ? response.content : '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VENUE AGENT
// ═══════════════════════════════════════════════════════════════════════════════

const VENUE_PROMPT = `You are Eventiq's Venue Specialist for Singapore.

Your job: find and present event venues. You have: search_venues, get_current_datetime, web_search.

RULES:
- Include capacity, location, event type in search queries
- Use web_search to look up pricing, reviews, or details if needed — don't ask the user
- Present as numbered list: **Name** — Description, Capacity, URL
- If search results lack pricing, use web_search to find it
- Use get_current_datetime for relative date references`;

export async function venueAgentNode(state: AgentStateType) {
  const llm = createHaiku(venueAgentTools);
  const userRequest = getLastUserMessage(state.messages);
  const messages: BaseMessage[] = [
    new SystemMessage(VENUE_PROMPT),
    new HumanMessage(userRequest),
  ];
  const response = await llm.invoke(messages);

  return {
    messages: [response],
    response: typeof response.content === 'string' ? response.content : '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR AGENT
// ═══════════════════════════════════════════════════════════════════════════════

const VENDOR_PROMPT = `You are Eventiq's Vendor Specialist for Singapore.

Your job: find photographers, AV, decorators, entertainment, florists, transport. You have: search_vendors, web_search.

RULES:
- Always specify the category in the search
- Use web_search to find pricing, reviews, or contact details — don't ask the user
- Include event scale and budget if mentioned
- Present as numbered list: **Name** — Service, Category, Price (if found), URL`;

export async function vendorAgentNode(state: AgentStateType) {
  const llm = createHaiku(vendorAgentTools);
  const userRequest = getLastUserMessage(state.messages);
  const messages: BaseMessage[] = [
    new SystemMessage(VENDOR_PROMPT),
    new HumanMessage(userRequest),
  ];
  const response = await llm.invoke(messages);

  return {
    messages: [response],
    response: typeof response.content === 'string' ? response.content : '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOOD AGENT
// ═══════════════════════════════════════════════════════════════════════════════

const FOOD_PROMPT = `You are Eventiq's Food & Catering Specialist for Singapore.

Your job: find caterers, handle dietary requirements, menu planning. You have: search_catering, web_search.

SINGAPORE KNOWLEDGE:
- Corporate buffet: $15-30/pax, Premium: $40-80/pax
- Common dietary: halal, vegetarian, no pork/lard
- Styles: buffet, bento, cocktail, sit-down

RULES:
- Include headcount and dietary needs in search
- Use web_search to find menus, pricing pages, or reviews — don't ask the user
- Present options with pricing info
- Mention dietary accommodations`;

export async function foodAgentNode(state: AgentStateType) {
  const llm = createHaiku(foodAgentTools);
  const userRequest = getLastUserMessage(state.messages);
  const messages: BaseMessage[] = [
    new SystemMessage(FOOD_PROMPT),
    new HumanMessage(userRequest),
  ];
  const response = await llm.invoke(messages);

  return {
    messages: [response],
    response: typeof response.content === 'string' ? response.content : '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNICATION AGENT
// ═══════════════════════════════════════════════════════════════════════════════

const COMMUNICATION_PROMPT = `You are Eventiq's Communication agent for Singapore.

Your job: send WhatsApp and email messages. You have: send_whatsapp, send_email.

RULES:
- Phone numbers → send_whatsapp (format: +65XXXXXXXX)
- Email addresses → send_email
- Craft professional, warm messages for Singapore business culture
- After sending, confirm what was sent and to whom
- For vendors: include event date, headcount, ask for availability/quote`;

export async function communicationAgentNode(state: AgentStateType) {
  const llm = createHaiku(communicationAgentTools);
  const userRequest = getLastUserMessage(state.messages);
  const messages: BaseMessage[] = [
    new SystemMessage(COMMUNICATION_PROMPT),
    new HumanMessage(userRequest),
  ];
  const response = await llm.invoke(messages);

  return {
    messages: [response],
    response: typeof response.content === 'string' ? response.content : '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE AGENT
// ═══════════════════════════════════════════════════════════════════════════════

const SCHEDULE_PROMPT = `You are Eventiq's Schedule Specialist.

Your job: build event timelines and agendas. You have: create_schedule, get_current_datetime.

RULES:
- Check current date for relative references
- Include 5min transitions, 15min coffee breaks, 45-60min lunch
- Standard: keynote 30-45min, talk 20min, workshop 60-90min
- Present as formatted timeline
- Warn if schedule exceeds time window`;

export async function scheduleAgentNode(state: AgentStateType) {
  const llm = createHaiku(scheduleAgentTools);
  const userRequest = getLastUserMessage(state.messages);
  const messages: BaseMessage[] = [
    new SystemMessage(SCHEDULE_PROMPT),
    new HumanMessage(userRequest),
  ];
  const response = await llm.invoke(messages);

  return {
    messages: [response],
    response: typeof response.content === 'string' ? response.content : '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS AGENT
// ═══════════════════════════════════════════════════════════════════════════════

const ANALYTICS_PROMPT = `You are Eventiq's Analytics & Budget agent.

Your job: budget tracking, cost analysis, spending reports. You have: get_budget_summary.

RULES:
- Calculate utilization across categories
- Warn about over-budget items
- Suggest 10% contingency if not allocated
- Currency is always SGD
- Present clear breakdowns`;

export async function analyticsAgentNode(state: AgentStateType) {
  const llm = createHaiku(analyticsAgentTools);
  const userRequest = getLastUserMessage(state.messages);
  const messages: BaseMessage[] = [
    new SystemMessage(ANALYTICS_PROMPT),
    new HumanMessage(userRequest),
  ];
  const response = await llm.invoke(messages);

  return {
    messages: [response],
    response: typeof response.content === 'string' ? response.content : '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL NODES
// ═══════════════════════════════════════════════════════════════════════════════

export const orchestratorToolNode = new ToolNode(allTools);
export const venueToolNode = new ToolNode(venueAgentTools);
export const vendorToolNode = new ToolNode(vendorAgentTools);
export const foodToolNode = new ToolNode(foodAgentTools);
export const communicationToolNode = new ToolNode(communicationAgentTools);
export const scheduleToolNode = new ToolNode(scheduleAgentTools);
export const analyticsToolNode = new ToolNode(analyticsAgentTools);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export function trackToolsNode(state: AgentStateType) {
  const toolNames: string[] = [];
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const msg = state.messages[i];
    const msgType = msg._getType?.() || (msg as any).constructor?.name;
    if (msgType === 'tool' || msgType === 'ToolMessage') {
      toolNames.push((msg as any).name || 'unknown');
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

/** After sub-agents: run their tools if they made tool calls, otherwise end */
export function subAgentRouter(state: AgentStateType): 'tools' | '__end__' {
  return hasToolCalls(state) ? 'tools' : '__end__';
}

/**
 * After orchestrator tools run and orchestrator produces its final response,
 * decide if a sub-agent should refine the answer.
 * For now: orchestrator handles everything end-to-end via its tool loop.
 * Sub-agents are invoked when orchestrator explicitly delegates.
 */
export function postOrchestratorRouter(state: AgentStateType): 'venue' | 'vendor' | 'food' | 'communication' | 'schedule' | 'analytics' | '__end__' {
  // Check the nextAgent field set by the orchestrator
  // For now, orchestrator handles its own tools — sub-agents are used for
  // multi-step delegation (future enhancement)
  return '__end__';
}
