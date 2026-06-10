import { StateGraph } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { AgentState } from './state';
import {
  orchestratorNode,
  orchestratorToolNode,
  trackToolsNode,
  orchestratorRouter,
} from './nodes';

/**
 * Multi-Agent LangGraph Workflow — TRUE Delegation Architecture
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  ORCHESTRATOR (Claude Sonnet)                                        │
 * │  - Interprets user intent                                            │
 * │  - DELEGATES to specialized agents via delegate_to_agent tool        │
 * │  - Does NOT search/send directly                                     │
 * │  - Composes final response from agent results                        │
 * └──────────────────────────┬──────────────────────────────────────────┘
 *                            │ delegate_to_agent(agent, task)
 *                            ▼
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SUB-AGENTS (Claude Haiku) — each runs AUTONOMOUSLY                  │
 * │                                                                       │
 * │  ┌──────────┐ ┌───────────────┐ ┌───────┐ ┌────────┐               │
 * │  │Researcher│ │Communication  │ │ Venue │ │ Vendor │               │
 * │  │(Exa web) │ │(WhatsApp+Email│ │search │ │caterers│               │
 * │  └──────────┘ └───────────────┘ └───────┘ └────────┘               │
 * │  ┌──────────┐ ┌───────────────┐ ┌──────────┐                       │
 * │  │ Schedule │ │  Analytics    │ │ Attendee │                       │
 * │  │(timeline)│ │  (budget)     │ │ (RSVPs)  │                       │
 * │  └──────────┘ └───────────────┘ └──────────┘                       │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Each sub-agent has its own LangGraph with:
 * - Own system prompt optimized for its domain
 * - Own tools (search, send, calculate, etc.)
 * - Own agent loop (calls tools repeatedly until goal is reached)
 * - Uses Claude Haiku (cheap, fast, can loop many times)
 */
function buildGraph() {
  const graph = new StateGraph(AgentState)
    // ── Orchestrator + delegation loop ──
    .addNode('orchestrator', orchestratorNode)
    .addNode('orchestrator_tools', orchestratorToolNode)
    .addNode('orchestrator_track', trackToolsNode)

    // Entry point
    .addEdge('__start__', 'orchestrator')

    // Orchestrator loop: delegate to agents or end
    .addConditionalEdges('orchestrator', orchestratorRouter, {
      orchestrator_tools: 'orchestrator_tools',
      __end__: '__end__',
    })
    .addEdge('orchestrator_tools', 'orchestrator_track')
    .addEdge('orchestrator_track', 'orchestrator');

  return graph.compile();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Compiled graph (singleton)
// ═══════════════════════════════════════════════════════════════════════════════

type AgentStateType = typeof AgentState.State;

let compiledGraph: ReturnType<typeof buildGraph> | null = null;

function getMainGraph() {
  if (!compiledGraph) {
    compiledGraph = buildGraph();
  }
  return compiledGraph;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the orchestrator graph.
 * The orchestrator (Claude Sonnet) delegates to autonomous sub-agents.
 * Each sub-agent runs its own LangGraph loop with its own tools.
 *
 * Includes a 50s timeout to stay within Vercel's 60s function limit.
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

  // Invoke the graph — no artificial timeout, let Vercel's maxDuration handle limits
  const result = await graph.invoke({
    messages,
    toolsUsed: [],
  });

  // Extract final response from the orchestrator
  const aiMessages = (result.messages as Array<{ _getType?: () => string; content: unknown; tool_calls?: unknown[] }>).filter((m) => {
    const type = m._getType?.();
    return type === 'ai';
  });

  let response = 'I processed your request but have no text response.';
  for (let i = aiMessages.length - 1; i >= 0; i--) {
    const content = aiMessages[i].content;
    if (typeof content === 'string' && content.trim().length > 0) {
      // Skip messages that are only tool calls with no meaningful text
      const hasToolCalls = Array.isArray(aiMessages[i].tool_calls) &&
        aiMessages[i].tool_calls!.length > 0;
      if (hasToolCalls && content.trim().length < 5) continue;
      response = content;
      break;
    } else if (Array.isArray(content)) {
      const textBlocks = (content as Array<{ type: string; text?: string }>).filter((b) => b.type === 'text');
      if (textBlocks.length > 0) {
        response = textBlocks.map((b) => b.text || '').join('\n');
        break;
      }
    }
  }

  return {
    response,
    toolsUsed: (result.toolsUsed as string[]) || [],
  };
}

/**
 * Run a specific sub-agent directly (for programmatic access).
 * Useful for testing or direct invocation outside the orchestrator.
 */
export async function runSubAgent(
  agent: 'researcher' | 'communication' | 'venue' | 'vendor' | 'schedule' | 'analytics' | 'attendee' | 'whiteboard' | 'forms',
  task: string
): Promise<{ response: string }> {
  // Dynamic import to avoid circular dependencies
  let run: (task: string) => Promise<string>;

  switch (agent) {
    case 'researcher': {
      const mod = await import('@/agents/researcher');
      run = mod.run;
      break;
    }
    case 'communication': {
      const mod = await import('@/agents/communication');
      run = mod.run;
      break;
    }
    case 'venue': {
      const mod = await import('@/agents/venue');
      run = mod.run;
      break;
    }
    case 'vendor': {
      const mod = await import('@/agents/vendor');
      run = mod.run;
      break;
    }
    case 'schedule': {
      const mod = await import('@/agents/schedule');
      run = mod.run;
      break;
    }
    case 'analytics': {
      const mod = await import('@/agents/analytics');
      run = mod.run;
      break;
    }
    case 'attendee': {
      const mod = await import('@/agents/attendee');
      run = mod.run;
      break;
    }
    case 'whiteboard': {
      const mod = await import('@/agents/whiteboard');
      run = mod.run;
      break;
    }
    case 'forms': {
      const mod = await import('@/agents/forms');
      run = mod.run;
      break;
    }
    default:
      throw new Error(`Unknown sub-agent: ${agent}`);
  }

  const response = await run(task);
  return { response };
}
