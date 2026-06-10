import { ChatBedrockConverse } from '@langchain/aws';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS AGENT — Budget tracking and cost analysis
// ═══════════════════════════════════════════════════════════════════════════════

const calculateBudgetTool = new DynamicStructuredTool({
  name: 'calculate_budget',
  description: 'Calculate a comprehensive budget summary with category breakdown, utilization rates, and warnings.',
  schema: z.object({
    totalBudget: z.number().describe('Total event budget in SGD'),
    items: z.array(z.object({
      category: z.string().describe('Budget category (venue, catering, AV, decoration, photography, transport, misc)'),
      description: z.string().describe('What this line item is for'),
      amount: z.number().describe('Cost in SGD'),
      status: z.enum(['committed', 'estimated', 'paid']).describe('Whether this cost is confirmed, estimated, or already paid'),
    })).describe('Budget line items'),
  }),
  func: async ({ totalBudget, items }) => {
    const committed = items
      .filter(i => i.status === 'committed' || i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0);
    const estimated = items
      .filter(i => i.status === 'estimated')
      .reduce((sum, i) => sum + i.amount, 0);
    const paid = items
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0);

    const byCategory = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {} as Record<string, number>);

    const remaining = totalBudget - committed - paid;
    const utilizationPercent = Math.round(((committed + paid) / totalBudget) * 100);

    const warnings: string[] = [];
    if (committed + paid > totalBudget) warnings.push('OVER BUDGET — committed costs exceed total budget');
    if (utilizationPercent > 90) warnings.push('Budget is over 90% utilized — limited flexibility remaining');
    if (committed + paid + estimated > totalBudget) warnings.push('Estimated costs would push total over budget');

    return JSON.stringify({
      totalBudget,
      committed,
      estimated,
      paid,
      remaining,
      utilizationPercent,
      byCategory,
      isOverBudget: committed + paid > totalBudget,
      warnings,
      recommendation: remaining < totalBudget * 0.1
        ? 'Consider holding 10% contingency reserve'
        : null,
    });
  },
});

const getCostBreakdownTool = new DynamicStructuredTool({
  name: 'get_cost_breakdown',
  description: 'Calculate per-person costs and category percentages for event budgeting.',
  schema: z.object({
    totalBudget: z.number().describe('Total budget in SGD'),
    attendeeCount: z.number().describe('Number of attendees'),
    categories: z.array(z.object({
      name: z.string(),
      amount: z.number(),
    })).describe('Cost categories with amounts'),
  }),
  func: async ({ totalBudget, attendeeCount, categories }) => {
    const totalSpend = categories.reduce((sum, c) => sum + c.amount, 0);
    const perPerson = attendeeCount > 0 ? Math.round(totalSpend / attendeeCount) : 0;
    const perPersonBudget = attendeeCount > 0 ? Math.round(totalBudget / attendeeCount) : 0;

    const breakdown = categories.map(c => ({
      ...c,
      percentage: Math.round((c.amount / totalSpend) * 100),
      perPerson: attendeeCount > 0 ? Math.round(c.amount / attendeeCount) : 0,
    }));

    return JSON.stringify({
      totalBudget,
      totalSpend,
      attendeeCount,
      costPerPerson: perPerson,
      budgetPerPerson: perPersonBudget,
      remaining: totalBudget - totalSpend,
      breakdown,
      insights: [
        perPerson > perPersonBudget ? `Over budget by $${perPerson - perPersonBudget}/person` : `Under budget by $${perPersonBudget - perPerson}/person`,
        ...breakdown.filter(b => b.percentage > 40).map(b => `${b.name} is ${b.percentage}% of total — consider if this is proportional`),
      ],
    });
  },
});

const tools = [calculateBudgetTool, getCostBreakdownTool];

const SYSTEM_PROMPT = `You are Eventiq's Analytics & Budget Agent for Singapore.

Your job: Track event budgets, calculate costs, provide financial insights and warnings.

CAPABILITIES:
- calculate_budget: Full budget analysis with category breakdown and warnings
- get_cost_breakdown: Per-person cost analysis and category percentages

BEHAVIOR:
1. Parse the user's budget information (total, items, categories)
2. Calculate comprehensive breakdowns
3. Provide actionable insights and warnings
4. Suggest optimizations when over budget

SINGAPORE COST BENCHMARKS:
- Venue: 20-35% of budget
- F&B/Catering: 30-45% of budget
- AV/Tech: 5-15% of budget
- Decoration: 5-10% of budget
- Photography: 5-10% of budget
- Contingency: 10% recommended

RULES:
- Currency is ALWAYS SGD
- Always recommend 10% contingency reserve
- Warn when any category exceeds typical percentages
- Calculate per-person costs for comparison
- Present clear tables/breakdowns
- Flag committed vs estimated costs separately`;

const AnalyticsState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type AnalyticsStateType = typeof AnalyticsState.State;

function createHaiku() {
  return new ChatBedrockConverse({
    model: 'us.anthropic.claude-3-haiku-20240307-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    temperature: 0.2,
    maxTokens: 4096,
  }).bindTools(tools);
}

async function agentNode(state: AnalyticsStateType) {
  const llm = createHaiku();
  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

function router(state: AnalyticsStateType): 'tools' | '__end__' {
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

function buildAnalyticsGraph() {
  const toolNode = new ToolNode(tools);
  return new StateGraph(AnalyticsState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', router, { tools: 'tools', __end__: '__end__' })
    .addEdge('tools', 'agent')
    .compile();
}

let compiledGraph: ReturnType<typeof buildAnalyticsGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildAnalyticsGraph();
  }
  return compiledGraph;
}

/**
 * Run the analytics agent autonomously.
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

  return 'Budget analysis completed but no structured response was generated.';
}
