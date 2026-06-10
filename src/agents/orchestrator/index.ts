import { runAgentGraph } from '@/agents/graph';
import { createEvent, getEvent, updateEvent } from '@/lib/db/events';
import { createMessage, getRecentMessages } from '@/lib/db/conversations';
import { getCreditBalance, deductCredits } from '@/lib/db/credits';
import type { EventBrief, EventDetails } from '@/types/event';
import type { OptionCard, ThinkingStep } from '@/types/chat';

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

/**
 * Extract event name from the user's first message.
 * Uses the first meaningful phrase (up to 50 chars) as the event name.
 */
function extractEventName(message: string): string {
  // Remove common filler words at start
  const cleaned = message
    .replace(/^(i want to|i need to|help me|please|can you|i'd like to|let's|we need to)\s+/i, '')
    .replace(/^(plan|organize|create|set up|setup|arrange)\s+(a|an|the|my)?\s*/i, '')
    .trim();

  if (!cleaned) return 'New Event';

  // Take first sentence or up to 50 chars
  const firstSentence = cleaned.split(/[.!?\n]/)[0].trim();
  if (firstSentence.length <= 50) return firstSentence;
  return firstSentence.slice(0, 47) + '...';
}

/**
 * Parse tool results from agent response to extract structured option cards.
 */
function parseOptions(response: string, toolsUsed: string[]): OptionCard[] {
  const options: OptionCard[] = [];

  // Try to find structured data in the response (numbered lists with URLs)
  const lines = response.split('\n');
  let currentOption: Partial<OptionCard> | null = null;

  for (const line of lines) {
    // Match numbered items like "1. **Name** - description"
    const numberedMatch = line.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*[-–—:]\s*(.+)/);
    if (numberedMatch) {
      if (currentOption?.name) {
        options.push(currentOption as OptionCard);
      }
      currentOption = {
        name: numberedMatch[1].replace(/\*+/g, '').trim(),
        description: numberedMatch[2].trim(),
        type: toolsUsed.includes('search_vendors') ? 'vendor' : 'venue',
      };
      continue;
    }

    // Match URLs in the current option context
    const urlMatch = line.match(/https?:\/\/[^\s)]+/);
    if (urlMatch && currentOption) {
      currentOption.url = urlMatch[0];
    }

    // Match price patterns
    const priceMatch = line.match(/\$[\d,.]+(?:\/pax)?|SGD\s*[\d,.]+/i);
    if (priceMatch && currentOption) {
      currentOption.price = priceMatch[0];
    }

    // Match location / address patterns (Singapore-specific)
    if (currentOption) {
      const locationMatch = line.match(
        /(?:(?:at|located?\s+at|address:?|📍)\s*)(.+(?:Singapore|Road|Street|Avenue|Drive|Blvd|Lane|Tanjong Pagar|Orchard|Marina|Raffles|Bugis|Clarke Quay|Sentosa|Jurong|Novena|Tampines|Changi|Bishan)[^.\n]*)/i
      );
      if (locationMatch && !currentOption.location) {
        currentOption.location = locationMatch[1].replace(/[*_`]/g, '').trim();
      }
      // Also match standalone Singapore address patterns
      const sgAddressMatch = line.match(
        /(\d+\s+[\w\s]+(?:Road|Street|Avenue|Drive|Lane|Blvd)[\w\s,#\-]*(?:Singapore\s*\d{6})?)/i
      );
      if (sgAddressMatch && !currentOption.location) {
        currentOption.location = sgAddressMatch[1].trim();
      }
    }

    // Detect category from context
    if (currentOption && !currentOption.category) {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('cater') || lowerLine.includes('food') || lowerLine.includes('menu')) {
        currentOption.category = 'catering';
      } else if (lowerLine.includes('venue') || lowerLine.includes('hall') || lowerLine.includes('ballroom')) {
        currentOption.category = 'venue';
      } else if (lowerLine.includes('photo') || lowerLine.includes('videograph')) {
        currentOption.category = 'photography';
      } else if (lowerLine.includes('music') || lowerLine.includes('dj') || lowerLine.includes('band')) {
        currentOption.category = 'music';
      } else if (lowerLine.includes('décor') || lowerLine.includes('decor') || lowerLine.includes('flower') || lowerLine.includes('floral')) {
        currentOption.category = 'decoration';
      }
    }
  }

  if (currentOption?.name) {
    options.push(currentOption as OptionCard);
  }

  return options;
}

/**
 * Build thinking steps from tools used.
 */
function buildThinkingSteps(toolsUsed: string[]): ThinkingStep[] {
  return toolsUsed.map((tool) => {
    const step: ThinkingStep = {
      tool,
      status: 'completed',
    };

    switch (tool) {
      case 'search_venues':
        step.query = 'Venue search';
        step.source = 'Exa Search';
        break;
      case 'search_vendors':
        step.query = 'Vendor search';
        step.source = 'Exa Search';
        break;
      case 'send_whatsapp':
        step.source = 'WhatsApp API';
        break;
      case 'send_email':
        step.source = 'Email (SES)';
        break;
      case 'get_current_datetime':
        step.source = 'System Clock';
        break;
      default:
        step.source = tool;
    }

    return step;
  });
}

/**
 * Persist confirmed event details to DynamoDB.
 * Parses the response for saved field/value from save_event_details tool calls.
 */
async function persistEventDetails(eventId: string, response: string): Promise<void> {
  try {
    const event = await getEvent(eventId);
    if (!event) return;

    const details: EventDetails = event.details || {};

    // Look for save_event_details results in the response context
    // The tool returns JSON like {"saved":true,"field":"confirmedVenue","value":"..."}
    const savedPattern = /\{"saved"\s*:\s*true\s*,\s*"field"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]*(?:\\.[^"]*)*)"\s*\}/g;
    let match: RegExpExecArray | null;

    while ((match = savedPattern.exec(response)) !== null) {
      const field = match[1];
      const rawValue = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');

      try {
        const parsed = JSON.parse(rawValue);
        switch (field) {
          case 'confirmedDate':
            details.confirmedDate = typeof parsed === 'string' ? parsed : String(parsed);
            break;
          case 'confirmedTime':
            details.confirmedTime = typeof parsed === 'string' ? parsed : String(parsed);
            break;
          case 'confirmedVenue':
            details.confirmedVenue = parsed;
            break;
          case 'confirmedCatering':
            details.confirmedCatering = parsed;
            break;
          case 'schedule':
            details.schedule = Array.isArray(parsed) ? parsed : [...(details.schedule || []), parsed];
            break;
          case 'contacts':
            details.contacts = Array.isArray(parsed) ? parsed : [...(details.contacts || []), parsed];
            break;
          case 'topics':
            details.topics = Array.isArray(parsed) ? parsed : [...(details.topics || []), parsed];
            break;
        }
      } catch {
        // Value is a plain string
        switch (field) {
          case 'confirmedDate':
            details.confirmedDate = rawValue;
            break;
          case 'confirmedTime':
            details.confirmedTime = rawValue;
            break;
        }
      }
    }

    await updateEvent(eventId, { details });
  } catch (error) {
    console.error('Failed to persist event details:', error);
  }
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
    const eventName = extractEventName(message);
    event = await createEvent(userId, { name: eventName });
    eventId = event.id;
  }

  // Load conversation history
  const recentMessages = await getRecentMessages(eventId!, 10);
  const history = recentMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // If this is the first real message and event is still "New Event", update name
  if (event.name === 'New Event' && history.length === 0) {
    const newName = extractEventName(message);
    if (newName !== 'New Event') {
      await updateEvent(eventId!, { name: newName, status: 'planning' });
    }
  }

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

    // Persist event details if save_event_details was called
    if (toolsUsed.includes('save_event_details')) {
      await persistEventDetails(eventId!, response);
    }

    // Parse structured data from response
    const options = parseOptions(response, toolsUsed);
    const thinking = buildThinkingSteps(toolsUsed);

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
        options: options.length > 0 ? options : undefined,
        thinking: thinking.length > 0 ? thinking : undefined,
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
