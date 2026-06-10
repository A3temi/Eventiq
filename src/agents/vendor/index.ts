import { generateText } from 'ai';
import { fastModel } from '@/lib/ai-gateway';
import { searchExa, buildVendorQuery, isStaleResult } from '@/lib/exa';
import type { AgentTask } from '@/types/agents';
import type { EventBrief } from '@/types/event';

interface DelegationResult {
  success: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

export async function handleVendorTask(
  task: AgentTask,
  event: EventBrief,
  userId: string
): Promise<DelegationResult> {
  const action = task.action;
  const params = task.parameters;

  switch (action) {
    case 'find_vendor':
      return searchVendors(event, params);
    case 'order_food':
      return searchCatering(event, params);
    default:
      return searchVendors(event, params);
  }
}

async function searchVendors(
  event: EventBrief,
  params: Record<string, unknown>
): Promise<DelegationResult> {
  const serviceCategory = (params.category as string) || 'event services';
  const budgetForCategory = event.budget?.total
    ? Math.round(event.budget.total * 0.15)
    : undefined;

  const query = buildVendorQuery({
    serviceCategory,
    location: event.location,
    budget: budgetForCategory,
  });

  let results = await searchExa({ query, numResults: 10 });

  if (results.length === 0) {
    // Broaden: increase budget 20%, expand location
    const broaderQuery = buildVendorQuery({
      serviceCategory,
      budget: budgetForCategory ? Math.round(budgetForCategory * 1.2) : undefined,
    });
    results = await searchExa({ query: broaderQuery, numResults: 10 });

    if (results.length === 0) {
      return {
        success: false,
        summary: `No ${serviceCategory} vendors found in Singapore matching your budget. Would you like me to expand the search with a higher budget range?`,
      };
    }
  }

  const { text } = await generateText({
    model: fastModel,
    system: `You are a vendor research assistant for Singapore events. Extract vendor details and present options clearly.
Include: name, services offered, estimated pricing in SGD, ratings if available, contact method.`,
    prompt: `Find ${serviceCategory} vendors for: ${event.type} event, ${event.attendeeCount} people, budget ~${budgetForCategory || 'flexible'} SGD.

Search results:
${results.slice(0, 5).map((r, i) => `${i + 1}. ${r.title}\n${r.text}\nURL: ${r.url}`).join('\n\n')}

Present the best options with pricing and contact info.`,
    maxOutputTokens: 1500,
  });

  const staleWarning = results.some((r) => isStaleResult(r.publishedDate))
    ? '\n\n⚠️ Some vendor data may not be current. I recommend confirming pricing directly.'
    : '';

  return {
    success: true,
    summary: `Here are ${serviceCategory} vendors I found:\n\n${text}${staleWarning}\n\nWould you like me to contact any of them?`,
    data: { vendors: results.slice(0, 5).map((r) => ({ title: r.title, url: r.url })) },
  };
}

async function searchCatering(
  event: EventBrief,
  params: Record<string, unknown>
): Promise<DelegationResult> {
  const dietaryRestrictions = (params.dietary as string[]) || [];
  const mealType = (params.mealType as string) || 'lunch';
  const headcount = event.attendeeCount || (params.headcount as number) || 50;
  const cateringBudget = event.budget?.total
    ? Math.round(event.budget.total * 0.25)
    : undefined;

  const query = buildVendorQuery({
    serviceCategory: `${mealType} catering ${dietaryRestrictions.join(' ')}`,
    location: event.location,
    budget: cateringBudget,
  });

  const results = await searchExa({ query, numResults: 5 });

  if (results.length === 0) {
    return {
      success: false,
      summary: `No catering vendors found matching your requirements${dietaryRestrictions.length ? ` (${dietaryRestrictions.join(', ')})` : ''}. Would you like me to relax the budget by 20% or broaden dietary coverage?`,
    };
  }

  const { text } = await generateText({
    model: fastModel,
    system: `You are a catering specialist for Singapore events. Present catering options with per-pax pricing, dietary support, and minimum orders.`,
    prompt: `Find catering for: ${headcount} people, ${mealType}, dietary needs: ${dietaryRestrictions.join(', ') || 'none specified'}, budget: ${cateringBudget || 'flexible'} SGD.

Options found:
${results.map((r, i) => `${i + 1}. ${r.title}\n${r.text}\nURL: ${r.url}`).join('\n\n')}

Present with: vendor name, menu highlights, per-pax price, dietary categories supported, minimum order, lead time.`,
    maxOutputTokens: 1500,
  });

  return {
    success: true,
    summary: `Here are catering options for ${headcount} people:\n\n${text}\n\nShall I contact any of them with your requirements?`,
    data: { vendors: results.map((r) => ({ title: r.title, url: r.url })) },
  };
}
