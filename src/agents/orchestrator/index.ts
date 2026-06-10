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
 */
function extractEventName(message: string): string {
  const cleaned = message
    .replace(/^(i want to|i need to|help me|please|can you|i'd like to|let's|we need to)\s+/i, '')
    .replace(/^(plan|organize|create|set up|setup|arrange)\s+(a|an|the|my)?\s*/i, '')
    .trim();

  if (!cleaned) return 'New Event';

  const firstSentence = cleaned.split(/[.!?\n]/)[0].trim();
  if (firstSentence.length <= 50) return firstSentence;
  return firstSentence.slice(0, 47) + '...';
}

/**
 * Parse tool results from agent response to extract structured option cards.
 */
function parseOptions(response: string, toolsUsed: string[]): OptionCard[] {
  // Only generate option cards when a search tool was actually used
  const searchTools = toolsUsed.filter(t =>
    ['search_venues', 'search_vendors', 'search_catering', 'web_search'].includes(t)
  );

  // No search tools = no options to show (schedules, emails, etc. are not "options")
  if (searchTools.length === 0) return [];

  const options: OptionCard[] = [];
  const lines = response.split('\n');
  let currentOption: Partial<OptionCard> | null = null;

  // Determine type from the last search tool used
  const lastSearchTool = searchTools[searchTools.length - 1];
  let defaultType = 'option';
  if (lastSearchTool === 'search_venues') defaultType = 'venue';
  else if (lastSearchTool === 'search_vendors') defaultType = 'vendor';
  else if (lastSearchTool === 'search_catering') defaultType = 'food';
  else if (lastSearchTool === 'web_search') defaultType = 'result';

  for (const line of lines) {
    // SKIP lines that look like schedule/time slots (e.g. "3:00-3:10 | Welcome")
    if (line.match(/^\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/)) continue;
    if (line.match(/\d{1,2}:\d{2}\s*\|/)) continue;

    // SKIP lines that are just emoji headers or status lines
    if (line.match(/^[📋🎯✅🚀⏰]/)) continue;

    // Match numbered items: "1. **Name** - desc" or "1. Name — desc"
    const numberedMatch = line.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*[-–—:]\s*(.+)/);
    if (numberedMatch) {
      const name = numberedMatch[1].replace(/\*+/g, '').trim();
      // Skip if the "name" looks like a time slot or schedule item
      if (name.match(/^\d{1,2}[:.]\d{2}/) || name.match(/^Session|^Break|^Lunch|^Welcome|^Wrap/i)) continue;

      if (currentOption?.name) {
        options.push(currentOption as OptionCard);
      }
      currentOption = {
        name,
        description: numberedMatch[2].replace(/\*+/g, '').trim(),
        type: defaultType,
      };
      continue;
    }

    // Match bold-only lines: "**Name** — description"
    const boldMatch = line.match(/^\s*\*\*(.+?)\*\*\s*[-–—:]\s*(.+)/);
    if (boldMatch) {
      const name = boldMatch[1].trim();
      if (name.match(/^\d{1,2}[:.]\d{2}/) || name.match(/^Session|^Break|^Lunch|^Welcome|^Wrap/i)) continue;

      if (currentOption?.name) {
        options.push(currentOption as OptionCard);
      }
      currentOption = {
        name,
        description: boldMatch[2].trim(),
        type: defaultType,
      };
      continue;
    }

    if (currentOption) {
      // Match URLs
      const urlMatch = line.match(/(https?:\/\/[^\s)>"]+)/);
      if (urlMatch && !currentOption.url) {
        currentOption.url = urlMatch[1];
      }

      // Match price patterns
      const priceMatch = line.match(/(?:Price|Cost|From|Budget)?:?\s*(?:SGD\s*)?\$?([\d,.]+(?:\/pax|\/person|\/head)?)/i);
      if (priceMatch && !currentOption.price) {
        currentOption.price = `$${priceMatch[1]}`;
      }

      // Match category
      const catMatch = line.match(/Category:\s*(.+)/i);
      if (catMatch) {
        currentOption.category = catMatch[1].trim();
      }
    }
  }

  if (currentOption?.name) {
    options.push(currentOption as OptionCard);
  }

  // Cap descriptions
  for (const opt of options) {
    if (opt.description && opt.description.length > 200) {
      opt.description = opt.description.slice(0, 197) + '...';
    }
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
      case 'search_catering':
        step.query = 'Catering search';
        step.source = 'Exa Search';
        break;
      case 'web_search':
        step.query = 'Web research';
        step.source = 'Exa Search';
        break;
      case 'send_whatsapp':
        step.source = 'WhatsApp (WAHA)';
        break;
      case 'send_email':
        step.source = 'Email (SMTP)';
        break;
      case 'get_current_datetime':
        step.source = 'System Clock (SGT)';
        break;
      case 'create_schedule':
        step.query = 'Schedule generation';
        step.source = 'Schedule Engine';
        break;
      case 'get_budget_summary':
        step.query = 'Budget calculation';
        step.source = 'Budget Engine';
        break;
      default:
        step.source = tool;
    }

    return step;
  });
}

/**
 * Persist confirmed event details to DynamoDB by parsing the agent response.
 */
async function persistEventDetails(eventId: string, response: string, toolsUsed: string[]): Promise<void> {
  try {
    const event = await getEvent(eventId);
    if (!event) return;
    const details: EventDetails = event.details || {};
    let updated = false;

    const dateMatch = response.match(/(?:Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)[,\s]+(?:June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?/i);
    if (dateMatch && !details.confirmedDate) { details.confirmedDate = dateMatch[0]; updated = true; }

    const venueMatch = response.match(/(?:venue|location|place)\s*(?:is|:)\s*\*?\*?([^*\n]+)/i);
    if (venueMatch && !details.confirmedVenue) { details.confirmedVenue = { name: venueMatch[1].trim() }; updated = true; }

    const cateringMatch = response.match(/(?:catering|food|menu)\s*(?:is|:)\s*\*?\*?([^*\n]+)/i);
    if (cateringMatch && !details.confirmedCatering) { details.confirmedCatering = { name: cateringMatch[1].trim() }; updated = true; }

    const attendeeMatch = response.match(/(\d+)\s*(?:people|attendees|participants|pax|guests)/i);
    if (attendeeMatch) {
      const count = parseInt(attendeeMatch[1]);
      if (count > 0 && count !== event.attendeeCount) await updateEvent(eventId, { attendeeCount: count });
    }

    const topicSection = response.match(/(?:topics?|agenda)\s*(?:include|:)\s*([\s\S]*?)(?:\n\n|$)/i);
    if (topicSection && !details.topics?.length) {
      const topics = topicSection[1].split('\n').map(l => l.replace(/^[-*•\d.)\s]+/, '').replace(/\*+/g, '').trim()).filter(t => t.length > 3 && t.length < 100);
      if (topics.length > 0) { details.topics = topics; updated = true; }
    }

    if (updated) await updateEvent(eventId, { details });
  } catch (error) { console.error('Failed to persist event details:', error); }
}

/**
 * Main orchestrator — handles the full message flow:
 * 1. Check credits
 * 2. Load/create event
 * 3. Load conversation history
 * 4. Run LangGraph agent
 * 5. Parse response into structured UI data
 * 6. Save messages and deduct credits
 */
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

  // Load conversation history for context
  const recentMessages = await getRecentMessages(eventId!, 10);
  const history = recentMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Update event name if it was created with default name
  if (event.name === 'New Event' && history.length === 0) {
    const newName = extractEventName(message);
    if (newName !== 'New Event') {
      await updateEvent(eventId!, { name: newName, status: 'planning' });
    }
  }

  // Save user message to conversation
  await createMessage(eventId!, 'user', message);

  // Deduct base credits for the request
  const baseCost = 2;
  await deductCredits(userId, baseCost, 'agent_call', eventId!);

  try {
    // Run the LangGraph multi-agent system
    const { response, toolsUsed } = await runAgentGraph(message, history);

    // Deduct additional credits for tool usage
    const toolCost = toolsUsed.length;
    if (toolCost > 0) {
      await deductCredits(userId, toolCost, 'tool_calls', eventId!);
    }

    // Persist event details if save_event_details was called
    // Actually, ALWAYS try to extract and persist details from the response
    await persistEventDetails(eventId!, response, toolsUsed);

    // Parse structured data from response
    const options = parseOptions(response, toolsUsed);
    const thinking = buildThinkingSteps(toolsUsed);
    const totalCost = baseCost + toolCost;

    // Save assistant response to conversation
    await createMessage(eventId!, 'assistant', response, {
      agentName: 'Eventiq',
      creditsCost: totalCost,
      toolsUsed,
    });

    return {
      content: response,
      eventId: eventId || undefined,
      metadata: {
        agentName: 'Eventiq',
        creditsCost: totalCost,
        toolsUsed,
        options: options.length > 0 ? options : undefined,
        thinking: thinking.length > 0 ? thinking : undefined,
      },
    };
  } catch (error) {
    console.error('Agent graph error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // Save error to conversation for context
    await createMessage(eventId!, 'system', `Error: ${errorMsg}`);

    return {
      content: `I encountered an issue processing your request: ${errorMsg}. Please try rephrasing or try again.`,
      eventId: eventId || undefined,
      metadata: { agentName: 'Eventiq', error: errorMsg },
    };
  }
}
