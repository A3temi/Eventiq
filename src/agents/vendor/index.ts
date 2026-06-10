import { createFastLLM } from '@/lib/llm';
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

Your job: Find vendors with REAL pricing. Never present options without price estimates.

MANDATORY SEARCH PATTERN:
1. search_vendors with category + headcount + budget
2. For top results → get_vendor_menu for detailed pricing/packages
3. If pricing unclear → compare_vendors focusing on "pricing packages per pax"

QUALITY CHECKLIST:
- At least 3 vendors with pricing? If not → search again
- Per-pax or total cost included? Calculate if you have both headcount and per-pax
- Dietary options noted? (Halal, vegetarian, vegan — common in Singapore)

SINGAPORE CATERING BENCHMARKS:
- Basic buffet: $15-25/pax
- Premium buffet: $30-50/pax
- Fine dining: $60-100/pax
- Photographer (half-day): $500-2000
- AV/Tech setup: $500-3000
- Decoration: $500-5000

OUTPUT: Numbered list with vendor name, price, dietary options, URL.
ALWAYS calculate total cost = per-pax price x headcount.
Search at least TWICE.`;

const VendorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type VendorStateType = typeof VendorState.State;

function createHaiku() {
  return createFastLLM().bindTools(tools);
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
