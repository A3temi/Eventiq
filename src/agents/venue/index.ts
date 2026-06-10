import { ChatBedrockConverse } from '@langchain/aws';
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

Your job: Find, compare, and recommend event venues. You search autonomously until you have enough information.

CAPABILITIES:
- search_venues: Find venues matching criteria
- compare_venues: Compare multiple venues side by side
- get_venue_details: Dive deep into a specific venue's details

BEHAVIOR:
1. First search broadly based on the requirements (type, capacity, location, budget)
2. If results lack pricing/details, use get_venue_details for top options
3. Compare top 3-5 options when presenting recommendations
4. Present structured results with: name, capacity, location, price range, key features, URL

SINGAPORE VENUE KNOWLEDGE:
- CBD/Downtown: Premium pricing ($200-500/hr), convenient MRT access
- Sentosa/Marina: Resort-style, good for team building ($150-400/hr)
- Heartlands: Budget-friendly ($50-150/hr), community clubs
- Hotels: All-in packages, F&B inclusive, $80-200/pax
- Co-working: Modern, tech-ready, $100-300/hr

RULES:
- ALWAYS include capacity information
- Include MRT station proximity when available
- Note if venue has in-house catering or allows external
- Present as numbered list with key details
- Search MULTIPLE TIMES if first results are incomplete`;

const VenueState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type VenueStateType = typeof VenueState.State;

function createHaiku() {
  return new ChatBedrockConverse({
    model: 'us.anthropic.claude-3-haiku-20240307-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    temperature: 0.2,
    maxTokens: 2048,
  }).bindTools(tools);
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
