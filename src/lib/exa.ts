import { retryWithBackoff } from './retry';

const EXA_API_URL = 'https://api.exa.ai/search';
const EXA_API_KEY = process.env.EXA_API_KEY!;

export interface ExaSearchParams {
  query: string;
  numResults?: number;
  category?: string;
  includeDomains?: string[];
  startPublishedDate?: string;
}

export interface ExaResult {
  title: string;
  url: string;
  text: string;
  publishedDate?: string;
  score: number;
  highlights?: string[];
}

/**
 * Search Exa with Singapore location constraint and structured extraction.
 */
export async function searchExa(params: ExaSearchParams): Promise<ExaResult[]> {
  const { query, numResults = 10, category, includeDomains, startPublishedDate } = params;

  // Always include Singapore context
  const fullQuery = query.includes('Singapore') ? query : `${query} Singapore`;

  const result = await retryWithBackoff(async () => {
    const response = await fetch(EXA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': EXA_API_KEY,
      },
      body: JSON.stringify({
        query: fullQuery,
        numResults,
        type: 'neural',
        useAutoprompt: true,
        contents: { text: { maxCharacters: 1000 }, highlights: { numSentences: 3 } },
        ...(category && { category }),
        ...(includeDomains && { includeDomains }),
        ...(startPublishedDate && { startPublishedDate }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Exa API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  });

  return (result.results || []).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    text: r.text || '',
    publishedDate: r.publishedDate,
    score: r.score || 0,
    highlights: r.highlights || [],
  }));
}

/**
 * Check data freshness — flag results older than 30 days.
 */
export function isStaleResult(publishedDate?: string): boolean {
  if (!publishedDate) return true;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Date(publishedDate).getTime() < thirtyDaysAgo;
}

/**
 * Build a venue search query from Event_Brief criteria.
 */
export function buildVenueQuery(params: {
  eventType?: string;
  attendeeCount?: number;
  location?: string;
  amenities?: string[];
}): string {
  const parts = ['event venue'];
  if (params.eventType) parts.push(params.eventType);
  if (params.attendeeCount) parts.push(`${params.attendeeCount} capacity`);
  if (params.location) parts.push(params.location);
  if (params.amenities?.length) parts.push(params.amenities.join(' '));
  parts.push('Singapore');
  return parts.join(' ');
}

/**
 * Build a vendor search query.
 */
export function buildVendorQuery(params: {
  serviceCategory: string;
  location?: string;
  budget?: number;
}): string {
  const parts = [params.serviceCategory, 'vendor', 'service provider'];
  if (params.location) parts.push(params.location);
  if (params.budget) parts.push(`under ${params.budget} SGD`);
  parts.push('Singapore');
  return parts.join(' ');
}
