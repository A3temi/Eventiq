import type { EventBrief, EventDetails } from '@/types/event';

export type PersistedEventField = keyof EventDetails | 'attendeeCount';

export interface ExtractedEventPatch {
  details: EventDetails;
  attendeeCount?: number;
  expectedFields: PersistedEventField[];
}

const MONEY = String.raw`(?:SGD\s*|S\$\s*|\$\s*)?([\d,]+(?:\.\d{1,2})?)`;
const TIME_LINE = /^\s*(?:[-*•]|\d+[.)])?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s*[-–—]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\s*(?:[:|\-–—])\s*(.+)$/i;

function uniqueFields(fields: PersistedEventField[]): PersistedEventField[] {
  return Array.from(new Set(fields));
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function amountFromText(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const amount = Number.parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(amount) ? amount : undefined;
}

function normalizeText(value: string): string {
  return value.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
}

function addVisibleSection(details: EventDetails, section: string) {
  const sections = details.visibleSections ?? [];
  if (!sections.includes(section)) details.visibleSections = [...sections, section];
}

function appendExpected(expectedFields: PersistedEventField[], field: PersistedEventField) {
  if (!expectedFields.includes(field)) expectedFields.push(field);
}

export function eventDetailsPatchFromField(
  field: string,
  rawValue: string,
  rawDetails?: string,
): ExtractedEventPatch {
  const details: EventDetails = {};
  const expectedFields: PersistedEventField[] = [];
  const parsedValue = parseJsonValue(rawValue);
  const parsedDetails = rawDetails ? parseJsonValue(rawDetails) : undefined;

  const valueObject =
    parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
      ? (parsedValue as Record<string, unknown>)
      : undefined;
  const detailsObject =
    parsedDetails && typeof parsedDetails === 'object' && !Array.isArray(parsedDetails)
      ? (parsedDetails as Record<string, unknown>)
      : undefined;

  switch (field) {
    case 'date':
      details.confirmedDate = String(parsedValue);
      appendExpected(expectedFields, 'confirmedDate');
      addVisibleSection(details, 'date');
      break;
    case 'time':
      details.confirmedTime = String(parsedValue);
      appendExpected(expectedFields, 'confirmedTime');
      addVisibleSection(details, 'date');
      break;
    case 'venue':
      details.confirmedVenue =
        valueObject
          ? {
              name: String(valueObject.name ?? valueObject.venueName ?? rawValue),
              url: typeof valueObject.url === 'string' ? valueObject.url : undefined,
              price: typeof valueObject.price === 'string' ? valueObject.price : undefined,
              status: 'confirmed',
            }
          : { name: String(parsedValue), status: 'confirmed' };
      appendExpected(expectedFields, 'confirmedVenue');
      addVisibleSection(details, 'venue');
      break;
    case 'catering':
      details.confirmedCatering =
        valueObject
          ? {
              name: String(valueObject.name ?? valueObject.vendorName ?? rawValue),
              url: typeof valueObject.url === 'string' ? valueObject.url : undefined,
              price: typeof valueObject.price === 'string' ? valueObject.price : undefined,
              status: 'confirmed',
            }
          : { name: String(parsedValue), status: 'confirmed' };
      appendExpected(expectedFields, 'confirmedCatering');
      addVisibleSection(details, 'catering');
      break;
    case 'attendeeCount':
    case 'attendees': {
      const count = typeof parsedValue === 'number' ? parsedValue : Number.parseInt(String(parsedValue), 10);
      if (Number.isFinite(count) && count > 0) {
        appendExpected(expectedFields, 'attendeeCount');
        return { details, attendeeCount: count, expectedFields };
      }
      break;
    }
    case 'schedule':
      details.schedule = Array.isArray(parsedValue)
        ? parsedValue as EventDetails['schedule']
        : [{ time: '', title: String(parsedValue), status: 'confirmed' }];
      appendExpected(expectedFields, 'schedule');
      addVisibleSection(details, 'schedule');
      break;
    case 'contacts':
    case 'vendor':
      details.contacts = Array.isArray(parsedValue)
        ? parsedValue as EventDetails['contacts']
        : [
            {
              name: String(valueObject?.name ?? valueObject?.vendorName ?? parsedValue),
              email: typeof valueObject?.email === 'string' ? valueObject.email : undefined,
              phone: typeof valueObject?.phone === 'string' ? valueObject.phone : undefined,
              status: 'pending',
            },
          ];
      appendExpected(expectedFields, 'contacts');
      addVisibleSection(details, 'contacts');
      break;
    case 'topics':
      details.topics = Array.isArray(parsedValue) ? parsedValue.map(String) : splitList(String(parsedValue));
      appendExpected(expectedFields, 'topics');
      addVisibleSection(details, 'topics');
      break;
    case 'budget': {
      const total =
        typeof parsedValue === 'number'
          ? parsedValue
          : amountFromText(String(valueObject?.total ?? valueObject?.amount ?? parsedValue));
      const committed = amountFromText(String(valueObject?.committed ?? detailsObject?.committed ?? ''));
      const items = Array.isArray(valueObject?.items)
        ? valueObject.items as NonNullable<EventDetails['budget']>['items']
        : undefined;
      details.budget = { total, committed, items };
      appendExpected(expectedFields, 'budget');
      addVisibleSection(details, 'budget');
      break;
    }
    case 'visibleSections':
      details.visibleSections = Array.isArray(parsedValue) ? parsedValue.map(String) : splitList(String(parsedValue));
      appendExpected(expectedFields, 'visibleSections');
      break;
  }

  return { details, expectedFields };
}

export function extractEventDetailsPatch(response: string): ExtractedEventPatch {
  const details: EventDetails = {};
  const expectedFields: PersistedEventField[] = [];
  let attendeeCount: number | undefined;

  const dateMatch = response.match(/(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)[,\s]+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/i);
  if (dateMatch) {
    details.confirmedDate = dateMatch[0];
    appendExpected(expectedFields, 'confirmedDate');
    addVisibleSection(details, 'date');
  }

  const timeMatch = response.match(/\b(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (timeMatch && !details.confirmedTime) {
    details.confirmedTime = timeMatch[1];
    appendExpected(expectedFields, 'confirmedTime');
    addVisibleSection(details, 'date');
  }

  const venueMatch = response.match(/(?:venue|location|place)\s*(?:is|:|-)\s*\*?\*?([^*\n]+)/i);
  if (venueMatch) {
    details.confirmedVenue = { name: normalizeText(venueMatch[1]), status: 'confirmed' };
    appendExpected(expectedFields, 'confirmedVenue');
    addVisibleSection(details, 'venue');
  }

  const cateringMatch = response.match(/(?:catering|food|menu)\s*(?:is|:|-)\s*\*?\*?([^*\n]+)/i);
  if (cateringMatch) {
    details.confirmedCatering = { name: normalizeText(cateringMatch[1]), status: 'confirmed' };
    appendExpected(expectedFields, 'confirmedCatering');
    addVisibleSection(details, 'catering');
  }

  const attendeeMatch = response.match(/(\d+)\s*(?:people|attendees|participants|pax|guests)/i);
  if (attendeeMatch) {
    const count = Number.parseInt(attendeeMatch[1], 10);
    if (Number.isFinite(count) && count > 0) {
      attendeeCount = count;
      appendExpected(expectedFields, 'attendeeCount');
    }
  }

  const schedule = extractSchedule(response);
  if (schedule.length > 0) {
    details.schedule = schedule;
    appendExpected(expectedFields, 'schedule');
    addVisibleSection(details, 'schedule');
  }

  const budget = extractBudget(response);
  if (budget) {
    details.budget = budget;
    appendExpected(expectedFields, 'budget');
    addVisibleSection(details, 'budget');
  }

  const contacts = extractContacts(response);
  if (contacts.length > 0) {
    details.contacts = contacts;
    appendExpected(expectedFields, 'contacts');
    addVisibleSection(details, 'contacts');
  }

  const topics = extractTopics(response);
  if (topics.length > 0) {
    details.topics = topics;
    appendExpected(expectedFields, 'topics');
    addVisibleSection(details, 'topics');
  }

  if (details.visibleSections?.length) appendExpected(expectedFields, 'visibleSections');

  return { details, attendeeCount, expectedFields: uniqueFields(expectedFields) };
}

export function mergeEventDetails(current: EventDetails = {}, patch: EventDetails = {}): EventDetails {
  const next: EventDetails = { ...current };

  if (!next.confirmedDate && patch.confirmedDate) next.confirmedDate = patch.confirmedDate;
  if (!next.confirmedTime && patch.confirmedTime) next.confirmedTime = patch.confirmedTime;
  if (!next.confirmedVenue && patch.confirmedVenue) next.confirmedVenue = patch.confirmedVenue;
  if (!next.confirmedCatering && patch.confirmedCatering) next.confirmedCatering = patch.confirmedCatering;
  if ((!next.schedule || next.schedule.length === 0) && patch.schedule?.length) next.schedule = patch.schedule;
  if ((!next.contacts || next.contacts.length === 0) && patch.contacts?.length) next.contacts = patch.contacts;
  if ((!next.topics || next.topics.length === 0) && patch.topics?.length) next.topics = patch.topics;
  if (!next.budget && patch.budget) next.budget = patch.budget;

  const visibleSections = new Set([...(next.visibleSections ?? []), ...(patch.visibleSections ?? [])]);
  if (visibleSections.size > 0) next.visibleSections = Array.from(visibleSections);

  return next;
}

/**
 * Apply an explicit tool save. Unlike heuristic response extraction, an explicit
 * save should be able to correct a stale venue/date/budget or replace an old
 * plan with the latest user-approved one.
 */
export function applyEventDetailsPatch(current: EventDetails = {}, patch: EventDetails = {}): EventDetails {
  const next: EventDetails = { ...current };

  if (patch.confirmedDate !== undefined) next.confirmedDate = patch.confirmedDate;
  if (patch.confirmedTime !== undefined) next.confirmedTime = patch.confirmedTime;
  if (patch.confirmedVenue !== undefined) next.confirmedVenue = patch.confirmedVenue;
  if (patch.confirmedCatering !== undefined) next.confirmedCatering = patch.confirmedCatering;
  if (patch.schedule !== undefined) next.schedule = patch.schedule;
  if (patch.contacts !== undefined) next.contacts = patch.contacts;
  if (patch.topics !== undefined) next.topics = patch.topics;
  if (patch.budget !== undefined) next.budget = patch.budget;

  const visibleSections = new Set([...(next.visibleSections ?? []), ...(patch.visibleSections ?? [])]);
  if (visibleSections.size > 0) next.visibleSections = Array.from(visibleSections);

  return next;
}

export function hasPersistedField(event: EventBrief, field: PersistedEventField): boolean {
  const details = event.details ?? {};
  switch (field) {
    case 'attendeeCount':
      return event.attendeeCount > 0;
    case 'confirmedDate':
      return Boolean(details.confirmedDate);
    case 'confirmedTime':
      return Boolean(details.confirmedTime);
    case 'confirmedVenue':
      return Boolean(details.confirmedVenue?.name);
    case 'confirmedCatering':
      return Boolean(details.confirmedCatering?.name);
    case 'schedule':
      return Boolean(details.schedule?.length);
    case 'contacts':
      return Boolean(details.contacts?.length);
    case 'topics':
      return Boolean(details.topics?.length);
    case 'budget':
      return Boolean(details.budget && (details.budget.total || details.budget.committed || details.budget.items?.length));
    case 'visibleSections':
      return Boolean(details.visibleSections?.length);
    default:
      return Boolean(details[field]);
  }
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => normalizeText(item.replace(/^[-*•\d.)\s]+/, '')))
    .filter((item) => item.length > 2 && item.length < 120);
}

function extractTopics(response: string): string[] {
  const section = response.match(/(?:topics?|agenda|plans?)\s*(?:include|:|-)\s*([\s\S]*?)(?:\n\n|$)/i);
  if (!section) return [];
  return splitList(section[1]).slice(0, 12);
}

function extractSchedule(response: string): NonNullable<EventDetails['schedule']> {
  const items: Array<NonNullable<EventDetails['schedule']>[number] | null> = response
    .split('\n')
    .map((line) => {
      const match = line.match(TIME_LINE);
      if (!match) return null;
      const title = normalizeText(match[2]);
      if (!title || title.length > 160) return null;
      return { time: normalizeText(match[1]), title, status: 'confirmed' as const };
    });

  return items
    .filter((item): item is NonNullable<EventDetails['schedule']>[number] => Boolean(item))
    .slice(0, 30);
}

function extractBudget(response: string): EventDetails['budget'] | undefined {
  if (!/\b(budget|cost|costs|estimate|estimated|expense|total|subtotal)\b/i.test(response)) return undefined;

  const totalRegex = new RegExp(String.raw`^\s*(?:total\s*(?:budget|estimate|cost)?|overall\s*budget)\s*[:\-–—]?\s*${MONEY}`, 'im');
  const total = amountFromText(response.match(totalRegex)?.[1]);
  const items: NonNullable<NonNullable<EventDetails['budget']>['items']> = [];

  const itemRegex = new RegExp(String.raw`^\s*(?:[-*•]|\d+[.)])?\s*([^:\n\-–—]{2,60}?)\s*(?:[:\-–—])\s*${MONEY}`, 'gim');
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(response)) !== null) {
    const name = normalizeText(match[1]);
    const amount = amountFromText(match[2]);
    if (!amount || /^(total|subtotal|tax|gst|budget)(?:\s|$)/i.test(name)) continue;
    items.push({ name, amount, status: /paid|settled/i.test(match[0]) ? 'paid' : 'committed' });
  }

  if (!total && items.length === 0) return undefined;
  const committed = items.reduce((sum, item) => sum + item.amount, 0);
  return {
    total: total ?? committed,
    committed: committed || undefined,
    items: items.length ? items : undefined,
  };
}

function extractContacts(response: string): NonNullable<EventDetails['contacts']> {
  const contacts: NonNullable<EventDetails['contacts']> = [];
  const emailRegex = /([^\n<>,;]{2,80})?\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
  let emailMatch: RegExpExecArray | null;
  while ((emailMatch = emailRegex.exec(response)) !== null) {
    const name = normalizeText((emailMatch[1] ?? '').replace(/^[-*•\d.)\s]+/, ''));
    contacts.push({ name: name || undefined, email: emailMatch[2], status: 'pending' });
  }

  const phoneRegex = /([^\n<>,;]{2,80})?\b(\+65\s?\d{4}\s?\d{4}|\b[689]\d{7}\b)/gi;
  let phoneMatch: RegExpExecArray | null;
  while ((phoneMatch = phoneRegex.exec(response)) !== null) {
    const phone = phoneMatch[2].replace(/\s+/g, '');
    if (contacts.some((contact) => contact.phone === phone)) continue;
    const name = normalizeText((phoneMatch[1] ?? '').replace(/^[-*•\d.)\s]+/, ''));
    contacts.push({ name: name || undefined, phone, status: 'pending' });
  }

  return contacts.slice(0, 20);
}
