import { generateText } from 'ai';
import { primaryModel } from '@/lib/ai-gateway';
import { createEvent, getEvent, updateEvent } from '@/lib/db/events';
import { createMessage, getRecentMessages } from '@/lib/db/conversations';
import { createTask } from '@/lib/db/tasks';
import type { EventBrief } from '@/types/event';
import type { Intent, AgentType } from '@/types/agents';
import { parseIntent } from './intent-parser';
import { delegateToAgent } from './delegator';
import { checkBudgetApproval } from './approval';

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

  // Load context
  let event: EventBrief | null = null;
  if (eventId) {
    event = await getEvent(eventId);
  }

  const recentMessages = eventId ? await getRecentMessages(eventId, 10) : [];

  // Step 1: Parse intent
  const intent = await parseIntent(message, event, recentMessages);

  // Step 2: Handle event creation if needed
  if (intent.type === 'create_event' && !event) {
    event = await createEvent(userId, {
      name: (intent.parameters.name as string) || 'New Event',
      type: (intent.parameters.type as string) || '',
      date: (intent.parameters.date as string) || '',
      attendeeCount: (intent.parameters.attendeeCount as number) || 0,
      budget: intent.parameters.budget
        ? (intent.parameters.budget as EventBrief['budget'])
        : { total: 0, currency: 'SGD', categories: [] },
    });
    eventId = event.id;
  }

  if (!eventId) {
    // Create a default event for new conversations
    event = await createEvent(userId, { name: 'New Event' });
    eventId = event.id;
  }

  // Save user message
  await createMessage(eventId, 'user', message);

  // Step 3: Check for missing Event_Brief fields
  const missingFields = getMissingFields(event);
  if (missingFields.length > 0 && intent.type === 'create_event') {
    const followUp = generateFollowUpQuestions(missingFields);
    await createMessage(eventId, 'assistant', followUp);
    return { content: followUp, eventId };
  }

  // Step 4: Delegate to specialized agents
  const results: string[] = [];
  for (const agentType of intent.requiredAgents) {
    const task = await createTask(eventId, {
      type: agentType,
      action: intent.type,
      parameters: intent.parameters,
      priority: 'medium',
      requiresApproval: shouldRequireApproval(intent, agentType),
    });

    const result = await delegateToAgent(agentType, task, event!, userId);
    results.push(result.summary);
  }

  // Step 5: Compose response
  const response = results.length > 0
    ? results.join('\n\n')
    : await generateResponse(message, intent, event!);

  await createMessage(eventId, 'assistant', response);

  return {
    content: response,
    eventId,
    metadata: {
      agentName: 'Orchestrator',
      intent: intent.type,
    },
  };
}

function getMissingFields(event: EventBrief | null): string[] {
  if (!event) return ['type', 'date', 'attendeeCount', 'budget'];
  const missing: string[] = [];
  if (!event.type) missing.push('type');
  if (!event.date) missing.push('date');
  if (!event.attendeeCount) missing.push('attendeeCount');
  if (!event.budget || event.budget.total === 0) missing.push('budget');
  return missing;
}

function generateFollowUpQuestions(missingFields: string[]): string {
  const questions: string[] = ['I need a few more details to get started:'];
  
  const fieldQuestions: Record<string, string> = {
    type: '• What type of event is this? (conference, workshop, corporate dinner, meetup, party, etc.)',
    date: '• When is the event? (date and time)',
    attendeeCount: '• How many attendees are you expecting?',
    budget: '• What\'s your total budget in SGD?',
  };

  for (const field of missingFields) {
    if (fieldQuestions[field]) questions.push(fieldQuestions[field]);
  }

  return questions.join('\n');
}

function shouldRequireApproval(intent: Intent, agentType: AgentType): boolean {
  if (intent.type === 'make_payment') return true;
  if (intent.type === 'send_message' && agentType === 'communication') return true;
  return false;
}

async function generateResponse(message: string, intent: Intent, event: EventBrief): Promise<string> {
  const { text } = await generateText({
    model: primaryModel,
    system: `You are an AI event planning assistant focused on Singapore events. 
You help organize events end-to-end: venues, vendors, payments, communications, scheduling.
Be concise and actionable. Always provide next steps.
Current event: ${JSON.stringify({ name: event.name, type: event.type, date: event.date, attendees: event.attendeeCount, budget: event.budget.total })}`,
    prompt: message,
    maxOutputTokens: 1024,
  });

  return text;
}
