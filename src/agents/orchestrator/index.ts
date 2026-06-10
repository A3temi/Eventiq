import { runAgentGraph } from '@/agents/graph';
import { createEvent, getEvent } from '@/lib/db/events';
import { createMessage, getRecentMessages } from '@/lib/db/conversations';
import { getCreditBalance, deductCredits } from '@/lib/db/credits';
import type { EventBrief } from '@/types/event';

interface OrchestrateInput {
  message: string;
  eventId: string | null;
  userId: string;
}

interface OrchestrateResult {
  content: string;
  eventId?: string;
  metadata?: Record<string, unknown>;
}

export async function orchestrate(input: OrchestrateInput): Promise<OrchestrateResult> {
  const { message, userId } = input;
  let { eventId } = input;

  // Check credits
  const creditBalance = await getCreditBalance(userId);
  if (creditBalance.balance <= 0) {
    return {
      content: "You're out of credits. Head to Settings to purchase more — plans start at $5 for 500 credits.",
      eventId: eventId || undefined,
      metadata: { agentName: 'Eventiq' },
    };
  }

  // Load or create event
  let event: EventBrief | null = null;
  if (eventId) {
    event = await getEvent(eventId);
  }
  if (!event) {
    event = await createEvent(userId, { name: 'New Event' });
    eventId = event.id;
  }

  // Load conversation history
  const recentMessages = await getRecentMessages(eventId!, 10);
  const history = recentMessages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Save user message
  await createMessage(eventId!, 'user', message);

  // Deduct credits
  await deductCredits(userId, 2, 'agent_call', eventId!);

  try {
    // Run the LangGraph multi-agent system
    const { response, toolsUsed } = await runAgentGraph(message, history);

    // Deduct extra for tool usage
    if (toolsUsed.length > 0) {
      await deductCredits(userId, toolsUsed.length, 'tool_calls', eventId!);
    }

    // Save response
    await createMessage(eventId!, 'assistant', response, {
      agentName: 'Eventiq',
      creditsCost: 2 + toolsUsed.length,
    });

    return {
      content: response,
      eventId: eventId || undefined,
      metadata: {
        agentName: 'Eventiq',
        creditsCost: 2 + toolsUsed.length,
        toolsUsed,
      },
    };
  } catch (error) {
    console.error('Agent graph error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    return {
      content: `I encountered an issue: ${errorMsg}. Please try rephrasing your request.`,
      eventId: eventId || undefined,
      metadata: { agentName: 'Eventiq', error: errorMsg },
    };
  }
}
