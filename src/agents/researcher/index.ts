import { createFastLLM } from '@/lib/llm';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchExa } from '@/lib/exa';

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCHER AGENT — Autonomous web research using Exa
// ═══════════════════════════════════════════════════════════════════════════════

const searchWebTool = new DynamicStructuredTool({
  name: 'search_web',
  description: 'Search the web for any information: venues, food, activities, prices, reviews, contacts. Returns titles, descriptions, URLs, and scores.',
  schema: z.object({
    query: z.string().describe('Search query — be specific for better results'),
    numResults: z.number().optional().default(5).describe('Number of results to return'),
  }),
  func: async ({ query, numResults }) => {
    const results = await searchExa({ query, numResults });
    return JSON.stringify(results.map(r => ({
      title: r.title,
      text: r.text?.slice(0, 400) || '',
      url: r.url,
      publishedDate: r.publishedDate,
      score: r.score,
    })));
  },
});

const searchImagesTool = new DynamicStructuredTool({
  name: 'search_images',
  description: 'Search for images related to venues, food, activities, etc. Returns URLs with image-focused results.',
  schema: z.object({
    query: z.string().describe('Image search query (e.g. "Marina Bay Sands ballroom photos")'),
    numResults: z.number().optional().default(5),
  }),
  func: async ({ query, numResults }) => {
    const results = await searchExa({
      query: `${query} photos images`,
      numResults,
    });
    return JSON.stringify(results.map(r => ({
      title: r.title,
      url: r.url,
      description: r.text?.slice(0, 200) || '',
    })));
  },
});

const getDetailsTool = new DynamicStructuredTool({
  name: 'get_details',
  description: 'Get detailed information about a specific topic by searching with a focused query. Use after initial search to dig deeper into a specific result.',
  schema: z.object({
    query: z.string().describe('Focused query for specific details (e.g. "Marina Bay Sands event space pricing capacity")'),
  }),
  func: async ({ query }) => {
    const results = await searchExa({ query, numResults: 3 });
    return JSON.stringify(results.map(r => ({
      title: r.title,
      text: r.text?.slice(0, 600) || '',
      url: r.url,
      highlights: r.highlights || [],
    })));
  },
});

const tools = [searchWebTool, searchImagesTool, getDetailsTool];

const SYSTEM_PROMPT = `You are an autonomous research agent for Eventiq, an event planning platform in Singapore.

Your job: Research ANY topic thoroughly using web search until you have comprehensive, actionable information.

BEHAVIOR:
1. Search MULTIPLE TIMES if needed — first a broad search, then focused follow-ups
2. Extract: names, prices, locations, contact info, URLs, ratings, images
3. Return STRUCTURED results — numbered lists with key details
4. Always include URLs for sources
5. Singapore context (SGD currency, SGT timezone)

RULES:
- Do NOT stop after one search if you need more info (pricing, reviews, comparisons)
- Use search_images when visual information would help (venues, food, decorations)
- Use get_details to dive deeper into specific results
- ALWAYS present a final summary with structured findings
- Include price ranges when available
- Mark information as "estimated" if not confirmed from source`;

const ResearcherState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type ResearcherStateType = typeof ResearcherState.State;

function createHaiku() {
  return createFastLLM().bindTools(tools);
}

async function agentNode(state: ResearcherStateType) {
  const llm = createHaiku();
  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

function router(state: ResearcherStateType): 'tools' | '__end__' {
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

function buildResearcherGraph() {
  const toolNode = new ToolNode(tools);
  return new StateGraph(ResearcherState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', router, { tools: 'tools', __end__: '__end__' })
    .addEdge('tools', 'agent')
    .compile();
}

let compiledGraph: ReturnType<typeof buildResearcherGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildResearcherGraph();
  }
  return compiledGraph;
}

/**
 * Run the researcher agent autonomously until it has a complete answer.
 */
export async function run(task: string): Promise<string> {
  const graph = getGraph();
  const result = await graph.invoke({
    messages: [new HumanMessage(task)],
  });

  // Extract final AI response
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

  // Fallback: return last AI message with content
  for (let i = aiMessages.length - 1; i >= 0; i--) {
    const content = aiMessages[i].content;
    if (typeof content === 'string' && content.trim().length > 0) {
      return content;
    }
  }

  return 'Research completed but no structured response was generated.';
}
