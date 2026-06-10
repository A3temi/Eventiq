import { generateObject } from 'ai';
import { z } from 'zod';
import { primaryModel } from '@/lib/ai-gateway';
import type { EventBrief } from '@/types/event';
import type { ChatMessage } from '@/types/chat';
import type { Intent, IntentType, AgentType } from '@/types/agents';

const IntentSchema = z.object({
  type: z.enum([
    'create_event', 'search_venue', 'find_vendor', 'make_payment',
    'send_message', 'manage_schedule', 'check_status', 'modify_event',
    'order_food', 'manage_attendees', 'generate_content', 'get_analytics',
    'purchase_credits', 'connect_stripe',
  ]),
  parameters: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  requiredAgents: z.array(z.enum([
    'venue', 'vendor', 'food', 'payment',
    'communication', 'attendee', 'schedule', 'analytics',
  ])),
});

const INTENT_TO_AGENTS: Record<IntentType, AgentType[]> = {
  create_event: [],
  search_venue: ['venue'],
  find_vendor: ['vendor'],
  make_payment: ['payment'],
  send_message: ['communication'],
  manage_schedule: ['schedule'],
  check_status: [],
  modify_event: [],
  order_food: ['food', 'vendor'],
  manage_attendees: ['attendee'],
  generate_content: [],
  get_analytics: ['analytics'],
  purchase_credits: ['payment'],
  connect_stripe: ['payment'],
};

export async function parseIntent(
  message: string,
  event: EventBrief | null,
  recentMessages: ChatMessage[]
): Promise<Intent> {
  try {
    const context = event
      ? `Current event: "${event.name}", type: ${event.type || 'unknown'}, date: ${event.date || 'unset'}, attendees: ${event.attendeeCount || 'unset'}, budget: ${event.budget?.total || 0} SGD`
      : 'No active event yet.';

    const history = recentMessages
      .slice(-5)
      .map((m) => `${m.role}: ${m.content.slice(0, 100)}`)
      .join('\n');

    const { object } = await generateObject({
      model: primaryModel,
      schema: IntentSchema,
      system: `You classify user messages for an AI event planning system in Singapore.
Determine the user's intent and which specialized agents should handle it.
${context}
Recent conversation:
${history}`,
      prompt: message,
    });

    return {
      type: object.type as IntentType,
      parameters: object.parameters as Record<string, unknown>,
      confidence: object.confidence,
      requiredAgents: object.requiredAgents.length > 0
        ? object.requiredAgents as AgentType[]
        : INTENT_TO_AGENTS[object.type as IntentType] || [],
    };
  } catch (error) {
    // Fallback: simple keyword matching
    return fallbackIntentParse(message);
  }
}

function fallbackIntentParse(message: string): Intent {
  const lower = message.toLowerCase();

  if (lower.includes('venue') || lower.includes('place') || lower.includes('location')) {
    return { type: 'search_venue', parameters: {}, confidence: 0.7, requiredAgents: ['venue'] };
  }
  if (lower.includes('vendor') || lower.includes('catering') || lower.includes('photographer')) {
    return { type: 'find_vendor', parameters: {}, confidence: 0.7, requiredAgents: ['vendor'] };
  }
  if (lower.includes('food') || lower.includes('meal') || lower.includes('lunch') || lower.includes('dinner')) {
    return { type: 'order_food', parameters: {}, confidence: 0.7, requiredAgents: ['food', 'vendor'] };
  }
  if (lower.includes('pay') || lower.includes('checkout') || lower.includes('invoice')) {
    return { type: 'make_payment', parameters: {}, confidence: 0.7, requiredAgents: ['payment'] };
  }
  if (lower.includes('schedule') || lower.includes('agenda') || lower.includes('speaker')) {
    return { type: 'manage_schedule', parameters: {}, confidence: 0.7, requiredAgents: ['schedule'] };
  }
  if (lower.includes('ticket') || lower.includes('register') || lower.includes('attendee')) {
    return { type: 'manage_attendees', parameters: {}, confidence: 0.7, requiredAgents: ['attendee'] };
  }
  if (lower.includes('credit') || lower.includes('top up')) {
    return { type: 'purchase_credits', parameters: {}, confidence: 0.7, requiredAgents: ['payment'] };
  }
  if (lower.includes('analytic') || lower.includes('report') || lower.includes('roi')) {
    return { type: 'get_analytics', parameters: {}, confidence: 0.7, requiredAgents: ['analytics'] };
  }

  // Default: create/modify event
  return { type: 'create_event', parameters: { description: message }, confidence: 0.5, requiredAgents: [] };
}
