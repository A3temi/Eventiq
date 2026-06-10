import { StateGraph } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { AgentState } from './state';
import {
  orchestratorNode,
  venueAgentNode,
  vendorAgentNode,
  foodAgentNode,
  communicationAgentNode,
  scheduleAgentNode,
  analyticsAgentNode,
  orchestratorToolNode,
  venueToolNode,
  vendorToolNode,
  foodToolNode,
  communicationToolNode,
  scheduleToolNode,
  analyticsToolNode,
  trackToolsNode,
  orchestratorRouter,
  subAgentRouter,
} from './nodes';

/**
 * Multi-Agent LangGraph Workflow
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ORCHESTRATOR (Claude Sonnet)                                │
 * │  - Interprets user intent                                    │
 * │  - Calls tools directly (search, send, schedule, etc.)       │
 * │  - Loops: orchestrator → tools → track → orchestrator        │
 * │  - Produces final response when no more tool calls needed    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Sub-agents (Venue, Vendor, Food, Communication, Schedule, Analytics)
 * are available as independent entry points — each with:
 * - Specialized system prompt
 * - Domain-specific tools only
 * - Claude Haiku (fast/cheap)
 * - Their own tool loop
 *
 * Current flow: Orchestrator handles everything via tool loop.
 * The sub-agents can be invoked directly via runSubAgent() for
 * explicit delegation or parallel execution.
 */
function buildGraph() {
  const graph = new StateGraph(AgentState)
    // ── Orchestrator + tool loop ──
    .addNode('orchestrator', orchestratorNode)
    .addNode('orchestrator_tools', orchestratorToolNode)
    .addNode('orchestrator_track', trackToolsNode)

    // Entry
    .addEdge('__start__', 'orchestrator')

    // Orchestrator loop: call tools or end
    .addConditionalEdges('orchestrator', orchestratorRouter, {
      orchestrator_tools: 'orchestrator_tools',
      __end__: '__end__',
    })
    .addEdge('orchestrator_tools', 'orchestrator_track')
    .addEdge('orchestrator_track', 'orchestrator');

  return graph.compile(); // LangGraph loops orchestrator → tools until no more tool calls
}

/**
 * Build a standalone sub-agent graph for direct invocation.
 * Each sub-agent has its own isolated tool loop.
 */
function buildSubAgentGraph(
  agentNode: (state: AgentStateType) => Promise<any>,
  toolNode: any
) {
  const graph = new StateGraph(AgentState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addNode('track', trackToolsNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', subAgentRouter, {
      tools: 'tools',
      __end__: '__end__',
    })
    .addEdge('tools', 'track')
    .addEdge('track', 'agent');

  return graph.compile();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Compiled graphs (singletons)
// ═══════════════════════════════════════════════════════════════════════════════

type AgentStateType = typeof AgentState.State;

// Singleton — compiled once per server lifecycle
let compiledGraph: ReturnType<typeof buildGraph> | null = null;

function getMainGraph() {
  if (!compiledGraph) {
    compiledGraph = buildGraph();
  }
  return compiledGraph;
}

// Sub-agent graphs — compiled on first use
const subGraphs: Record<string, ReturnType<typeof buildSubAgentGraph>> = {};

function getSubGraph(agent: string) {
  if (!subGraphs[agent]) {
    switch (agent) {
      case 'venue':
        subGraphs[agent] = buildSubAgentGraph(venueAgentNode, venueToolNode);
        break;
      case 'vendor':
        subGraphs[agent] = buildSubAgentGraph(vendorAgentNode, vendorToolNode);
        break;
      case 'food':
        subGraphs[agent] = buildSubAgentGraph(foodAgentNode, foodToolNode);
        break;
      case 'communication':
        subGraphs[agent] = buildSubAgentGraph(communicationAgentNode, communicationToolNode);
        break;
      case 'schedule':
        subGraphs[agent] = buildSubAgentGraph(scheduleAgentNode, scheduleToolNode);
        break;
      case 'analytics':
        subGraphs[agent] = buildSubAgentGraph(analyticsAgentNode, analyticsToolNode);
        break;
      default:
        throw new Error(`Unknown sub-agent: ${agent}`);
    }
  }
  return subGraphs[agent];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the main orchestrator graph.
 * The orchestrator (Claude Sonnet) handles intent + tool execution in a loop.
 */
export async function runAgentGraph(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<{ response: string; toolsUsed: string[] }> {
  const graph = getMainGraph();

  const messages = [
    ...conversationHistory.map(m =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    ),
    new HumanMessage(userMessage),
  ];

  const result = await graph.invoke({
    messages,
    toolsUsed: [],
  });

  // Extract final response
  const aiMessages = result.messages.filter((m: any) => {
    const type = m._getType?.();
    return type === 'ai';
  });

  let response = 'I processed your request but have no text response.';
  for (let i = aiMessages.length - 1; i >= 0; i--) {
    const content = aiMessages[i].content;
    if (typeof content === 'string' && content.trim().length > 0) {
      // Skip messages that are only tool calls with no text
      const hasToolCalls = 'tool_calls' in aiMessages[i] &&
        Array.isArray((aiMessages[i] as any).tool_calls) &&
        (aiMessages[i] as any).tool_calls.length > 0;
      if (hasToolCalls && content.trim().length < 5) continue;
      response = content;
      break;
    } else if (Array.isArray(content)) {
      const textBlocks = content.filter((b: any) => b.type === 'text');
      if (textBlocks.length > 0) {
        response = textBlocks.map((b: any) => b.text).join('\n');
        break;
      }
    }
  }

  return {
    response,
    toolsUsed: result.toolsUsed || [],
  };
}

/**
 * Run a specific sub-agent directly (for explicit delegation).
 * The sub-agent gets a clean context — just the user request.
 */
export async function runSubAgent(
  agent: 'venue' | 'vendor' | 'food' | 'communication' | 'schedule' | 'analytics',
  userMessage: string
): Promise<{ response: string; toolsUsed: string[] }> {
  const graph = getSubGraph(agent);

  const result = await graph.invoke({
    messages: [new HumanMessage(userMessage)],
    toolsUsed: [],
  });

  const aiMessages = result.messages.filter((m: any) => m._getType?.() === 'ai');
  let response = 'Sub-agent completed with no text response.';

  for (let i = aiMessages.length - 1; i >= 0; i--) {
    const content = aiMessages[i].content;
    if (typeof content === 'string' && content.trim().length > 0) {
      response = content;
      break;
    }
  }

  return {
    response,
    toolsUsed: result.toolsUsed || [],
  };
}
