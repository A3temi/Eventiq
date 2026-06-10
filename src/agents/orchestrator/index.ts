import { runAgentGraph } from '@/agents/graph';
import { createEvent, getEvent, updateEvent } from '@/lib/db/events';
import { createMessage, getRecentMessages } from '@/lib/db/conversations';
import { getCreditBalance, deductCredits } from '@/lib/db/credits';
import type { EventBrief } from '@/types/event';
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
 * Extract a date from text. Handles multiple formats:
 * - YYYY-MM-DD (ISO)
 * - "December 14, 2025" or "Dec 14, 2025"
 * - "14 December 2025" or "14 Dec 2025"
 * - "this Saturday" style dates from get_current_datetime JSON
 */
function extractDate(text: string): string | null {
  // ISO format: 2025-12-14
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // From get_current_datetime JSON responses: "thisSaturday":"2025-12-14"
  const jsonDateMatch = text.match(/"(?:today|tomorrow|thisSaturday|thisSunday|nextMonday)"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  if (jsonDateMatch) return jsonDateMatch[1];

  // "December 14, 2025" or "Dec 14, 2025"
  const months: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  };

  const longMatch = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})\b/i);
  if (longMatch) {
    const month = months[longMatch[1].toLowerCase().slice(0, 3)];
    const day = parseInt(longMatch[2]);
    const year = parseInt(longMatch[3]);
    if (month !== undefined && day && year) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // "14 December 2025" or "14th Dec 2025"
  const revMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?),?\s*(\d{4})\b/i);
  if (revMatch) {
    const day = parseInt(revMatch[1]);
    const month = months[revMatch[2].toLowerCase().slice(0, 3)];
    const year = parseInt(revMatch[3]);
    if (month !== undefined && day && year) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
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

  // Determine base type from tools, but we'll refine per-option using content
  const lastSearchTool = searchTools[searchTools.length - 1];
  let defaultType = 'option';
  if (lastSearchTool === 'search_venues') defaultType = 'venue';
  else if (lastSearchTool === 'search_vendors') defaultType = 'vendor';
  else if (lastSearchTool === 'search_catering') defaultType = 'food';
  // For web_search, we infer per-option from content
  else if (lastSearchTool === 'web_search') defaultType = '';

  for (const line of lines) {
    // SKIP lines that look like schedule/time slots
    if (line.match(/\d{1,2}[:.]\d{2}\s*(?:[-–]\s*\d{1,2}[:.]\d{2})?\s*\|/)) continue;
    if (line.match(/^\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/)) continue;
    if (line.match(/\d{1,2}:\d{2}\s*(?:PM|AM)/i)) continue;

    // SKIP lines that are emoji headers or status lines
    if (line.match(/^[📋🎯✅🚀⏰📅🍽️🎤💬]/)) continue;

    // Match numbered items: "1. **Name** - desc" or "1. Name — desc"
    const numberedMatch = line.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*[-–—:]\s*(.+)/);
    if (numberedMatch) {
      const name = numberedMatch[1].replace(/\*+/g, '').trim();
      // Skip time slots
      if (name.match(/^\d{1,2}[:.]\d{2}/)) continue;
      if (name.match(/^Session|^Break|^Lunch|^Welcome|^Wrap|^Coffee|^Registration|^Networking/i)) continue;
      // Skip quoted titles
      if (name.match(/^[""\u201c]/) || name.match(/[""\u201d]$/)) continue;
      // Skip topic-style items without URLs
      if (name.match(/^(What|How|Why|When|Where|Building|Defining|On-Device|Opening|Interactive|Future)/i) && !line.match(/https?:\/\//)) continue;
      // Skip action items (verb-first phrases)
      if (name.match(/^(Book|Confirm|Secure|Send|Get|Find|Check|Review|Finalize|Order|Arrange|Contact|Follow|Set up|Create|Plan|Prepare|Schedule|Hire|Research|Notify|Place)/i)) continue;
      // Skip generic non-vendor phrases
      if (name.match(/^(Next|Immediate|Your|The |This |Here|Note|Option|Step|Action|Task|Todo|Tip|Duration|Date|Timeline|Proposed)/i)) continue;
      // Must start with a capital letter and be a reasonable length for a business name
      if (!name.match(/^[A-Z]/) || name.length > 60 || name.length < 3) continue;

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
      // Same filters as numbered items
      if (name.match(/^\d{1,2}[:.]\d{2}/)) continue;
      if (name.match(/^Session|^Break|^Lunch|^Welcome|^Wrap|^Coffee|^Registration|^Networking/i)) continue;
      if (name.match(/^[""\u201c]/) || name.match(/[""\u201d]$/)) continue;
      if (name.match(/^(What|How|Why|When|Where|Building|Defining|On-Device|Opening|Interactive|Future)/i) && !line.match(/https?:\/\//)) continue;
      if (name.match(/^(Book|Confirm|Secure|Send|Get|Find|Check|Review|Finalize|Order|Arrange|Contact|Follow|Set up|Create|Plan|Prepare|Schedule|Hire|Research|Notify|Place)/i)) continue;
      if (name.match(/^(Next|Immediate|Your|The |This |Here|Note|Option|Step|Action|Task|Todo|Tip|Duration|Date|Timeline|Proposed)/i)) continue;
      if (!name.match(/^[A-Z0-9]/) || name.length > 60 || name.length < 3) continue;

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

  // Cap descriptions and infer type from content if not set by tool
  const venueWords = /\b(venue|space|room|hall|hotel|resort|centre|center|auditorium|rooftop|ballroom|meeting room)\b/i;
  const foodWords = /\b(cater|food|buffet|menu|cuisine|halal|vegetarian|lunch|dinner|breakfast|meal|kitchen|chef|bento|pax)\b/i;
  const vendorWords = /\b(photograph|video|AV|audio|visual|decorator|florist|flower|entertainment|DJ|emcee|band|lighting)\b/i;

  for (const opt of options) {
    if (opt.description && opt.description.length > 200) {
      opt.description = opt.description.slice(0, 197) + '...';
    }

    // Infer type from name + description if defaultType was empty (web_search)
    if (!opt.type || opt.type === '') {
      const text = `${opt.name} ${opt.description}`;
      if (venueWords.test(text)) opt.type = 'venue';
      else if (foodWords.test(text)) opt.type = 'food';
      else if (vendorWords.test(text)) opt.type = 'vendor';
      else opt.type = 'result';
    }
  }

  // Filter out options that don't look like real venue/vendor/food results
  // (no URL and type is just 'result' = likely a topic suggestion, not actionable)
  return options.filter(opt => opt.url || opt.type !== 'result');
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
    event = await createEvent(userId, { name: eventName, status: 'planning' });
    eventId = event.id;
  }

  // Load conversation history for context
  const recentMessages = await getRecentMessages(eventId!, 10);
  const history = recentMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Update event name and status on first real message
  if (event.name === 'New Event' && history.length === 0) {
    const newName = extractEventName(message);
    if (newName !== 'New Event') {
      await updateEvent(eventId!, { name: newName, status: 'planning' });
    }
  } else if (event.status === 'draft') {
    // Always move from draft to planning once user starts chatting
    await updateEvent(eventId!, { status: 'planning' });
  }

  // Try to extract a date from the user message and update the event
  if (!event.date || event.date === '') {
    const extracted = extractDate(message);
    if (extracted) {
      await updateEvent(eventId!, { date: extracted });
      event.date = extracted;
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

    console.log('[Orchestrator] toolsUsed:', toolsUsed);

    // Deduct additional credits for tool usage
    const toolCost = toolsUsed.length;
    if (toolCost > 0) {
      await deductCredits(userId, toolCost, 'tool_calls', eventId!);
    }

    // Parse structured data from response
    const options = parseOptions(response, toolsUsed);
    const thinking = buildThinkingSteps(toolsUsed);
    const totalCost = baseCost + toolCost;

    // Extract date from agent response if event has no date
    if (!event.date || event.date === '') {
      const extracted = extractDate(response);
      if (extracted) {
        await updateEvent(eventId!, { date: extracted });
      }
    }

    // Update event with structured data extracted from messages
    const eventUpdates: Record<string, unknown> = {};

    // Extract attendee count
    const guestMatch = (message + ' ' + response).match(/(\d+)\s*(?:people|pax|guests|attendees|persons)/i);
    if (guestMatch && event.attendeeCount === 0) {
      eventUpdates.attendeeCount = parseInt(guestMatch[1]);
    }

    // Extract location ONLY from explicit confirmation messages, not from search results
    // The dashboard handles location display from user confirmations
    if (!event.location && /\b(finalize|confirmed|booked|go with)\b/i.test(message)) {
      // Only save a clean venue name, not a description
      const venueNames = ['Marina Bay Sands', 'Singapore Expo', 'Suntec', 'MIT Space', 'Changi', 'Raffles'];
      for (const name of venueNames) {
        if (message.toLowerCase().includes(name.toLowerCase())) {
          eventUpdates.location = name + ', Singapore';
          break;
        }
      }
    }

    // Extract event type
    if (!event.type) {
      const typeMatch = (message + ' ' + response).match(/\b(wedding|corporate|birthday|conference|meetup|workshop|seminar|tech talk|launch|gala|party)\b/i);
      if (typeMatch) eventUpdates.type = typeMatch[1].toLowerCase();
    }

    // Update status based on activity
    if (toolsUsed.length > 0 && event.status === 'planning') {
      const userConfirmed = /\b(finalize|confirmed|booked|go with|proceed|yes|book it)\b/i.test(message);
      if (userConfirmed) {
        eventUpdates.status = 'confirmed';
      }
    }

    if (Object.keys(eventUpdates).length > 0) {
      await updateEvent(eventId!, eventUpdates);
    }

    // Save assistant response to conversation
    await createMessage(eventId!, 'assistant', response, {
      agentName: 'Eventiq',
      creditsCost: totalCost,
      toolsUsed,
      options: options.length > 0 ? options : undefined,
      thinking: thinking.length > 0 ? thinking : undefined,
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
