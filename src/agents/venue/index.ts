import { generateText } from 'ai';
import { fastModel } from '@/lib/ai-gateway';
import { searchExa, buildVenueQuery, isStaleResult } from '@/lib/exa';
import type { AgentTask } from '@/types/agents';
import type { EventBrief } from '@/types/event';

interface VenueResult {
  name: string;
  location: string;
  capacity: number;
  pricePerDay: number;
  amenities: string[];
  rating?: number;
  url: string;
  dataFresh: boolean;
}

interface DelegationResult {
  success: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

export async function handleVenueTask(
  task: AgentTask,
  event: EventBrief,
  userId: string
): Promise<DelegationResult> {
  const action = task.action;

  switch (action) {
    case 'search_venue':
      return searchVenues(event);
    default:
      return searchVenues(event);
  }
}

async function searchVenues(event: EventBrief): Promise<DelegationResult> {
  // Validate prerequisites
  if (!event.date || !event.attendeeCount || !event.budget?.total) {
    const missing: string[] = [];
    if (!event.date) missing.push('event date');
    if (!event.attendeeCount) missing.push('expected attendee count');
    if (!event.budget?.total) missing.push('budget');
    return {
      success: false,
      summary: `I need more information before searching for venues: ${missing.join(', ')}. Could you provide these details?`,
    };
  }

  const query = buildVenueQuery({
    eventType: event.type,
    attendeeCount: event.attendeeCount,
    location: event.location,
  });

  let results = await searchExa({ query, numResults: 10 });

  // If no results, relax parameters
  if (results.length === 0) {
    const broaderQuery = buildVenueQuery({
      eventType: event.type,
      attendeeCount: Math.ceil(event.attendeeCount * 1.25),
    });
    results = await searchExa({ query: broaderQuery, numResults: 10 });

    if (results.length === 0) {
      return {
        success: false,
        summary: 'No venues found matching your criteria. I broadened the search but found nothing. Would you like to adjust your requirements?',
      };
    }
  }

  // Parse and score venues using LLM
  const { text } = await generateText({
    model: fastModel,
    system: `You are a venue research assistant. Extract venue information and present it as a comparison table.
Score each venue on: capacity match (within 20% of ${event.attendeeCount}), budget fit (under ${Math.round(event.budget.total * 0.4)} SGD venue budget), location preference.
Format as a clear comparison with recommendations.`,
    prompt: `Event: ${event.type}, ${event.attendeeCount} people, ${event.date}, budget ${event.budget.total} SGD total.

Search results:
${results.map((r, i) => `${i + 1}. ${r.title}\n${r.text}\n${r.highlights?.join(' ')}\nURL: ${r.url}`).join('\n\n')}

Present the top venues in a comparison table with name, capacity, estimated price, amenities, and a recommendation score (1-10).`,
    maxOutputTokens: 2048,
  });

  const staleWarning = results.some((r) => isStaleResult(r.publishedDate))
    ? '\n\n⚠️ Some venue data may be outdated (>30 days old). I recommend verifying pricing and availability directly.'
    : '';

  return {
    success: true,
    summary: `Here are the venue options I found:\n\n${text}${staleWarning}`,
    data: { venues: results.map((r) => ({ title: r.title, url: r.url, score: r.score })) },
  };
}
