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

Your job: Research ANY topic THOROUGHLY. Do NOT stop after one search.

MANDATORY BEHAVIOR:
1. FIRST SEARCH: Broad query to find options
2. SECOND SEARCH: Get pricing/details for the top 3 results from first search
3. THIRD SEARCH (if needed): Find reviews, images, or comparisons
4. ONLY THEN: Compile and return structured results

QUALITY CHECKLIST (verify before returning):
- At least 3 options presented? If not → search again
- Pricing included for each option? If not → use get_details on specific results
- URLs/sources included? If not → they must be in the search results
- Singapore-specific results? If not → add "Singapore" to query and retry

OUTPUT FORMAT:
Present as numbered list with:
- Name (bold)
- Price/price range in SGD
- Key features (1-2 lines)
- Source URL
- Location (if applicable)

RULES:
- MINIMUM 2 searches per task (broad + focused)
- Always include pricing — even if estimated
- Mark estimates as "~$X (estimated)"
- Singapore context (SGD currency, SGT timezone)
- If first search gives poor results, reformulate query and try again
- Use search_images when visual info helps (venues, food, decor)`;

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
