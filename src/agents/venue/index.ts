import { createFastLLM } from '@/lib/llm';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchExa } from '@/lib/exa';

// ═══════════════════════════════════════════════════════════════════════════════
// VENUE AGENT — Specialized venue finding and comparison
// ═══════════════════════════════════════════════════════════════════════════════

const searchVenuesTool = new DynamicStructuredTool({
  name: 'search_venues',
  description: 'Search for event venues in Singapore. Returns venue names, descriptions, URLs, and relevance scores.',
  schema: z.object({
    query: z.string().describe('Venue search query (e.g. "conference room 100 people CBD Singapore")'),
    maxResults: z.number().optional().default(5),
  }),
  func: async ({ query, maxResults }) => {
    const results = await searchExa({ query: `${query} venue Singapore`, numResults: maxResults });
    return JSON.stringify(results.map(r => ({
      name: r.title,
      description: r.text?.slice(0, 300) || '',
      url: r.url,
      score: r.score,
    })));
  },
});

const compareVenuesTool = new DynamicStructuredTool({
  name: 'compare_venues',
  description: 'Compare multiple venues by searching for specific details about each one.',
  schema: z.object({
    venueNames: z.array(z.string()).describe('List of venue names to compare'),
    criteria: z.string().describe('What to compare (e.g. "pricing capacity location amenities")'),
  }),
  func: async ({ venueNames, criteria }) => {
    const comparisons = await Promise.all(
      venueNames.map(async (name) => {
        const results = await searchExa({ query: `${name} Singapore ${criteria}`, numResults: 2 });
        return {
          venue: name,
          details: results.map(r => ({
            text: r.text?.slice(0, 300) || '',
            url: r.url,
          })),
        };
      })
    );
    return JSON.stringify(comparisons);
  },
});

const getVenueDetailsTool = new DynamicStructuredTool({
  name: 'get_venue_details',
  description: 'Get detailed information about a specific venue including pricing, capacity, and amenities.',
  schema: z.object({
    venueName: z.string().describe('Name of the venue to get details for'),
    infoNeeded: z.string().optional().default('pricing capacity amenities booking').describe('What information to look for'),
  }),
  func: async ({ venueName, infoNeeded }) => {
    const results = await searchExa({
      query: `${venueName} Singapore ${infoNeeded}`,
      numResults: 3,
    });
    return JSON.stringify(results.map(r => ({
      title: r.title,
      text: r.text?.slice(0, 500) || '',
      url: r.url,
      highlights: r.highlights || [],
    })));
  },
});

const tools = [searchVenuesTool, compareVenuesTool, getVenueDetailsTool];

const SYSTEM_PROMPT = `You are Eventiq's Venue Specialist for Singapore.

Your job: Find, compare, and rank venues. NEVER return results without pricing.

MANDATORY SEARCH PATTERN:
1. search_venues with specific criteria (type, capacity, area)
2. For top 3 results → get_venue_details for pricing and amenities
3. If pricing still missing → compare_venues with "pricing packages rates"

QUALITY CHECKLIST:
- At least 3 venues with capacity info? If not → broaden search
- Pricing for each venue? If not → search specifically for pricing
- Location/MRT info? Include if found

SINGAPORE VENUE KNOWLEDGE:
- CBD/Downtown: $200-500/hr, near Raffles Place/Tanjong Pagar MRT
- Sentosa/Marina: $150-400/hr, resort-style
- Heartlands: $50-150/hr, community clubs
- Hotels: $80-200/pax all-inclusive
- Co-working: $100-300/hr, tech-ready

OUTPUT: Numbered list with name, capacity, price range, location, URL.
Always search at least TWICE.`;

const VenueState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type VenueStateType = typeof VenueState.State;

function createHaiku() {
  return createFastLLM().bindTools(tools);
}

async function agentNode(state: VenueStateType) {
  const llm = createHaiku();
  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

function router(state: VenueStateType): 'tools' | '__end__' {
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

function buildVenueGraph() {
  const toolNode = new ToolNode(tools);
  return new StateGraph(VenueState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', router, { tools: 'tools', __end__: '__end__' })
    .addEdge('tools', 'agent')
    .compile();
}

let compiledGraph: ReturnType<typeof buildVenueGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildVenueGraph();
  }
  return compiledGraph;
}

/**
 * Run the venue agent autonomously.
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

  return 'Venue search completed but no structured response was generated.';
}
