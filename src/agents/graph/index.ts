import { StateGraph } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { AgentState } from './state';
import { orchestratorNode, toolNode, shouldContinue } from './nodes';

/**
 * Build the LangGraph multi-agent workflow.
 * 
 * Flow: user message → orchestrator → tools (if needed) → orchestrator → end
 * The orchestrator can call tools multiple times in a loop.
 */
function buildGraph() {
  const graph = new StateGraph(AgentState)
    .addNode('orchestrator', orchestratorNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'orchestrator')
    .addConditionalEdges('orchestrator', shouldContinue, {
      tools: 'tools',
      __end__: '__end__',
    })
    .addEdge('tools', 'orchestrator');

  return graph.compile();
}

// Singleton compiled graph
let compiledGraph: ReturnType<typeof buildGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildGraph();
  }
  return compiledGraph;
}

/**
 * Run the agent graph with a user message.
 * Returns the final response text.
 */
export async function runAgentGraph(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<{ response: string; toolsUsed: string[] }> {
  const graph = getGraph();

  // Build message history
  const messages = [
    ...conversationHistory.map(m =>
      m.role === 'user' ? new HumanMessage(m.content) : new HumanMessage(m.content) // simplified
    ),
    new HumanMessage(userMessage),
  ];

  const result = await graph.invoke({ messages });

  // Extract the final AI response
  const aiMessages = result.messages.filter((m: any) => m._getType?.() === 'ai' || m.constructor?.name === 'AIMessage');
  const lastAI = aiMessages[aiMessages.length - 1];
  const response = lastAI?.content
    ? (typeof lastAI.content === 'string' ? lastAI.content : JSON.stringify(lastAI.content))
    : 'I processed your request but have no text response.';

  // Track tools used
  const toolsUsed = result.messages
    .filter((m: any) => m._getType?.() === 'tool' || m.constructor?.name === 'ToolMessage')
    .map((m: any) => m.name || 'unknown');

  return { response, toolsUsed };
}
