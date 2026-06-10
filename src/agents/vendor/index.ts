import { ChatBedrockConverse } from '@langchain/aws';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchExa } from '@/lib/exa';

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR AGENT — Find and compare service providers
// ═══════════════════════════════════════════════════════════════════════════════

const searchVendorsTool = new DynamicStructuredTool({
  name: 'search_vendors',
  description: 'Search for event service vendors in Singapore: caterers, photographers, AV, decorators, entertainment, florists, transport, emcees.',
  schema: z.object({
    query: z.string().describe('Vendor search query (e.g. "corporate event photographer Singapore")'),
    category: z.string().describe('Service category: catering, photography, videography, AV, decoration, entertainment, florist, transport, emcee'),
  }),
  func: async ({ query, category }) => {
    const results = await searchExa({ query: `${query} ${category} Singapore`, numResults: 5 });
    return JSON.stringify(results.map(r => ({
      name: r.title,
      description: r.text?.slice(0, 300) || '',
      url: r.url,
      category,
      score: r.score,
    })));
  },
});

const compareVendorsTool = new DynamicStructuredTool({
  name: 'compare_vendors',
  description: 'Compare multiple vendors by searching for pricing, reviews, and service details.',
  schema: z.object({
    vendorNames: z.array(z.string()).describe('List of vendor names to compare'),
    criteria: z.string().describe('Comparison criteria (e.g. "pricing packages reviews portfolio")'),
  }),
  func: async ({ vendorNames, criteria }) => {
    const comparisons = await Promise.all(
      vendorNames.map(async (name) => {
        const results = await searchExa({ query: `${name} Singapore ${criteria}`, numResults: 2 });
        return {
          vendor: name,
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

const getVendorMenuTool = new DynamicStructuredTool({
  name: 'get_vendor_menu',
  description: 'Get menu/package details from a catering or food vendor. Search for their specific offerings.',
  schema: z.object({
    vendorName: z.string().describe('Name of the vendor/caterer'),
    requirements: z.string().optional().default('menu pricing packages').describe('What to look for (e.g. "halal menu buffet pricing")'),
  }),
  func: async ({ vendorName, requirements }) => {
    const results = await searchExa({
      query: `${vendorName} Singapore ${requirements}`,
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

const tools = [searchVendorsTool, compareVendorsTool, getVendorMenuTool];

const SYSTEM_PROMPT = `You are Eventiq's Vendor Specialist for Singapore.

Your job: Find, compare, and recommend event service vendors — caterers, photographers, AV, decorators, entertainment, florists, transport.

CAPABILITIES:
- search_vendors: Find vendors by category and requirements
- compare_vendors: Compare multiple vendors side by side
- get_vendor_menu: Get menu/package details from specific vendors

BEHAVIOR:
1. Search for vendors matching the category and requirements
2. For catering: include headcount, dietary needs, budget per pax
3. Get detailed pricing/menus for top options
4. Present structured comparisons

SINGAPORE VENDOR KNOWLEDGE:
- Catering: $15-30/pax (basic), $30-60/pax (premium), $60-100/pax (fine dining)
- Photography: $500-2000 for half-day, $1000-4000 for full-day
- AV/Tech: $500-3000 depending on setup complexity
- Decoration: $500-5000 depending on scale
- Entertainment: $800-5000 (bands, DJs, performers)

DIETARY COMMON IN SINGAPORE:
- Halal (Muslim dietary law) — very common requirement
- Vegetarian/Vegan options
- No pork/No lard (Chinese preference)
- Nut-free, Gluten-free (allergies)

RULES:
- Include pricing when available
- Note dietary accommodations
- Include contact/booking URLs
- Present as numbered list
- Search MULTIPLE TIMES for comprehensive results`;

const VendorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type VendorStateType = typeof VendorState.State;

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

async function agentNode(state: VendorStateType) {
  const llm = createHaiku();
  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

function router(state: VendorStateType): 'tools' | '__end__' {
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

function buildVendorGraph() {
  const toolNode = new ToolNode(tools);
  return new StateGraph(VendorState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', router, { tools: 'tools', __end__: '__end__' })
    .addEdge('tools', 'agent')
    .compile();
}

let compiledGraph: ReturnType<typeof buildVendorGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildVendorGraph();
  }
  return compiledGraph;
}

/**
 * Run the vendor agent autonomously.
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

  return 'Vendor search completed but no structured response was generated.';
}
