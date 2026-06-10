'use client';

/**
 * View-model adapter: maps the app's REAL data (EventSummary + details payload)
 * onto the ported UI's EventModel. Read-only mapping lives in `adaptEvent`;
 * write-back helpers translate UI-level vendor patches back into the frozen
 * `details.contacts[idx]` shape consumed by PATCH /api/events/[id] {details}.
 */

import type { EventDetails, EventSummary } from '@/types/event';
import type {
  EventModel,
  EventStatus,
  EventType,
  Milestone,
  ScheduleItem,
  VendorCategory,
  VendorContact,
  VendorStatus,
} from './types';
import { eventTypeMeta } from './meta';

/** Frozen contact shape from EventDetails. */
type BaseContact = NonNullable<EventDetails['contacts']>[number];
export type ContactStatus = NonNullable<BaseContact['status']>;

/**
 * Per-contact record with ADDITIVE fields the UI persists alongside the
 * frozen fields so the round-trip is lossless:
 * - `uiStatus`: the exact UI-level VendorStatus (the frozen `status` only has 3 values)
 * - `history`: status history entries (mirrors VendorContact.statusHistory)
 * - `notes`: free-text vendor notes
 * - `website`: optional vendor website
 */
export type ContactRecord = BaseContact & {
  uiStatus?: VendorStatus;
  history?: { status: VendorStatus; timestamp: string }[];
  notes?: string;
  website?: string;
};

/** EventDetails plus the additive fields the new UI reads/writes. */
export type EventiqDetails = Omit<EventDetails, 'contacts' | 'confirmedVenue'> & {
  contacts?: ContactRecord[];
  confirmedVenue?: NonNullable<EventDetails['confirmedVenue']> & { location?: string };
  /** Additive: cover image as a data URL. */
  coverImage?: string;
};

/** Shape returned by GET /api/events/[id]/details. */
export interface DetailsPayload {
  details: EventiqDetails;
  name: string;
  status: string;
  attendeeCount: number;
  date: string;
}

/* ------------------------------------------------------------------ */
/* Status mapping                                                      */
/* ------------------------------------------------------------------ */

const EVENT_STATUSES: EventStatus[] = ['planning', 'confirmed', 'in_progress', 'completed', 'draft'];

/** Real app status ('in-progress') → UI status ('in_progress'); others pass through. */
export function mapEventStatus(status: string | undefined): EventStatus {
  if (status === 'in-progress') return 'in_progress';
  if (EVENT_STATUSES.includes(status as EventStatus)) return status as EventStatus;
  return 'draft';
}

/** Contact status (confirmed/messaging/pending) → UI VendorStatus. */
export function mapContactStatusToVendorStatus(status: ContactStatus | undefined): VendorStatus {
  switch (status) {
    case 'confirmed':
      return 'booked';
    case 'messaging':
      return 'awaiting_confirmation';
    case 'pending':
    default:
      return 'quote_requested';
  }
}

/** UI VendorStatus → contact status for write-back. */
export function mapVendorStatusToContactStatus(status: VendorStatus): ContactStatus {
  switch (status) {
    case 'booked':
    case 'delivered':
    case 'deposit_paid':
      return 'confirmed';
    case 'awaiting_confirmation':
    case 'quote_requested':
    case 'cancelled':
    default:
      return 'pending';
  }
}

/* ------------------------------------------------------------------ */
/* Type + category guessing                                            */
/* ------------------------------------------------------------------ */

/** Substring-match free text against eventTypeMeta keys; fallback 'other'. */
export function matchEventType(freeText: string | null | undefined): EventType | undefined {
  const text = (freeText ?? '').toLowerCase().trim();
  if (!text) return undefined;
  for (const key of Object.keys(eventTypeMeta) as EventType[]) {
    if (text.includes(key)) return key;
  }
  return 'other';
}

const CATEGORY_KEYWORDS: [string, VendorCategory][] = [
  ['venue', 'venue'],
  ['cater', 'catering'],
  ['photo', 'photography'],
  ['dj', 'dj'],
  ['music', 'dj'],
  ['flower', 'flowers'],
  ['cake', 'cake'],
  ['transport', 'transport'],
  ['decor', 'decoration'],
];

/** Guess a vendor category from name keywords; fallback 'other'. */
export function guessVendorCategory(name: string | undefined): VendorCategory {
  const text = (name ?? '').toLowerCase();
  for (const [keyword, category] of CATEGORY_KEYWORDS) {
    if (text.includes(keyword)) return category;
  }
  return 'other';
}

/* ------------------------------------------------------------------ */
/* Vendors                                                             */
/* ------------------------------------------------------------------ */

/** Normalized identity key for a contact (email wins, then name). */
function contactIdentityKey(contact: Pick<ContactRecord, 'name' | 'email'>): string {
  return (contact.email || contact.name || '').trim().toLowerCase();
}

/**
 * Stable, identity-based vendor id for a contact. Positional ids ('contact-N')
 * break when the agent inserts/removes/reorders contacts between polls, so the
 * id is derived from email/name; the index is only a fallback for anonymous
 * contacts and a suffix for identity collisions (`seen` keeps ids unique).
 */
export function vendorIdForContact(
  contact: Pick<ContactRecord, 'name' | 'email'>,
  idx: number,
  seen?: Set<string>
): string {
  const key = contactIdentityKey(contact);
  let id = key ? `contact-${key}` : `contact-${idx}`;
  if (seen) {
    if (seen.has(id)) id = `${id}-${idx}`;
    seen.add(id);
  }
  return id;
}

/**
 * Locate the contact a UI vendor refers to by IDENTITY (email, then name, then
 * phone) instead of by position, so write-backs land on the right record even
 * if the agent reordered/inserted contacts since the panel was opened.
 * Returns -1 when the contact no longer exists.
 */
export function findContactIndex(
  contacts: ContactRecord[] | undefined,
  vendor: Pick<VendorContact, 'email' | 'contactName' | 'vendorName' | 'phone'>
): number {
  if (!contacts || contacts.length === 0) return -1;
  const email = vendor.email.trim().toLowerCase();
  if (email) {
    const byEmail = contacts.findIndex((c) => (c.email ?? '').trim().toLowerCase() === email);
    if (byEmail !== -1) return byEmail;
  }
  const name = (vendor.contactName || vendor.vendorName).trim().toLowerCase();
  if (name) {
    const byName = contacts.findIndex((c) => (c.name ?? '').trim().toLowerCase() === name);
    if (byName !== -1) return byName;
  }
  const phone = vendor.phone.trim();
  if (phone) {
    const byPhone = contacts.findIndex((c) => (c.phone ?? '').trim() === phone);
    if (byPhone !== -1) return byPhone;
  }
  return -1;
}

function adaptContact(contact: ContactRecord, idx: number, seen: Set<string>): VendorContact {
  return {
    id: vendorIdForContact(contact, idx, seen),
    category: guessVendorCategory(contact.name),
    vendorName: contact.name || `Contact ${idx + 1}`,
    contactName: contact.name ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    website: contact.website,
    status: contact.uiStatus ?? mapContactStatusToVendorStatus(contact.status),
    notes: contact.notes,
    statusHistory: contact.history ?? [],
  };
}

/**
 * Write-back helper: apply a UI-level Partial<VendorContact> patch onto the
 * matching `details.contacts[idx]` record. Sets the frozen `status` field via
 * mapVendorStatusToContactStatus and stores the lossless UI state in the
 * additive `uiStatus` / `history` / `notes` fields.
 */
export function mapUiVendorPatchToContact(
  contact: ContactRecord | undefined,
  patch: Partial<VendorContact>
): ContactRecord {
  const next: ContactRecord = { ...(contact ?? {}) };
  if (patch.status) {
    next.status = mapVendorStatusToContactStatus(patch.status);
    next.uiStatus = patch.status;
  }
  if (patch.statusHistory) next.history = patch.statusHistory;
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.vendorName !== undefined) next.name = patch.vendorName;
  if (patch.phone !== undefined) next.phone = patch.phone;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.website !== undefined) next.website = patch.website;
  return next;
}

/* ------------------------------------------------------------------ */
/* Date normalization                                                  */
/* ------------------------------------------------------------------ */

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}/;
const HAS_YEAR = /\d{4}/;
const LEADING_WEEKDAY = /^\s*(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*,?\s*/i;
const ORDINAL_SUFFIX = /(\d{1,2})(st|nd|rd|th)\b/gi;

/** Parse "17:00", "5pm", "5:30 PM onwards" → {hours, minutes}; null if unparseable. */
function parseTimeText(text: string | undefined): { hours: number; minutes: number } | null {
  if (!text) return null;
  const match = text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (!match || (!match[2] && !match[3] && match[1].length > 2)) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (meridiem?.startsWith('p') && hours < 12) hours += 12;
  if (meridiem?.startsWith('a') && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * Lenient text → ISO conversion. ISO-like strings pass through untouched
 * (parseISO handles them; re-encoding a date-only string would shift the day
 * across timezones). Free text ("September 12, 2026", "Saturday, June 20th")
 * is cleaned and parsed; strings without a year resolve to the upcoming
 * occurrence. Returns '' when unparseable.
 */
function toIsoDate(text: string | undefined, timeText?: string): string {
  const raw = (text ?? '').trim();
  if (!raw) return '';
  if (ISO_LIKE.test(raw)) return raw;

  const cleaned = raw.replace(LEADING_WEEKDAY, '').replace(ORDINAL_SUFFIX, '$1');
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return '';

  // No explicit year ("June 20") → V8 defaults the year; assume the upcoming one.
  if (!HAS_YEAR.test(cleaned)) {
    const now = new Date();
    parsed.setFullYear(now.getFullYear());
    if (parsed.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
      parsed.setFullYear(now.getFullYear() + 1);
    }
  }

  const time = parseTimeText(timeText);
  if (time) parsed.setHours(time.hours, time.minutes, 0, 0);
  return parsed.toISOString();
}

/**
 * The event date for the UI. The top-level `event.date` wins when set, but the
 * backend initializes it to '' and NOTHING ever writes it — agents record
 * confirmed dates only in `details.confirmedDate` (whiteboard agent
 * save_event_state / orchestrator regex fallback), so that free-text field is
 * the real source for chat-created events.
 */
export function normalizeEventDate(
  topLevelDate: string | undefined,
  confirmedDate: string | undefined,
  confirmedTime?: string
): string {
  return toIsoDate(topLevelDate) || toIsoDate(confirmedDate, confirmedTime);
}

/* ------------------------------------------------------------------ */
/* Milestones                                                          */
/* ------------------------------------------------------------------ */

/**
 * DERIVED planning checklist from the real details. Powers the Checklist card
 * and the Calendar chips. Milestone date = event date; undated events get
 * dateless milestones ('' — calendar skips invalid dates, so draft events no
 * longer dump 6 chips on today's cell). Pending milestones on past-dated
 * events surface as 'overdue'.
 */
export function deriveMilestones(
  details: EventiqDetails | undefined,
  eventDate: string
): Milestone[] {
  const d = details ?? {};
  const parsed = eventDate ? Date.parse(eventDate) : NaN;
  const date = Number.isNaN(parsed) ? '' : eventDate;
  const overdue = !Number.isNaN(parsed) && parsed < Date.now();

  const entries: { id: string; title: string; category: Milestone['category']; done: boolean }[] = [
    { id: 'ms-confirm-date', title: 'Confirm date', category: 'other', done: !!d.confirmedDate },
    { id: 'ms-confirm-venue', title: 'Confirm venue', category: 'venue', done: !!d.confirmedVenue },
    {
      id: 'ms-confirm-catering',
      title: 'Confirm catering',
      category: 'catering',
      done: !!d.confirmedCatering,
    },
    {
      id: 'ms-build-day-of-schedule',
      title: 'Build day-of schedule',
      category: 'logistics',
      done: (d.schedule?.length ?? 0) > 0,
    },
    {
      id: 'ms-add-vendor-contacts',
      title: 'Add vendor contacts',
      category: 'communication',
      done: (d.contacts?.length ?? 0) > 0,
    },
    { id: 'ms-set-budget', title: 'Set budget', category: 'finance', done: !!d.budget },
  ];

  return entries.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    date,
    status: e.done ? 'done' : overdue ? 'overdue' : 'pending',
  }));
}

/* ------------------------------------------------------------------ */
/* Main adapter                                                        */
/* ------------------------------------------------------------------ */

export function adaptEvent(summary: EventSummary, payload?: DetailsPayload): EventModel {
  const details: EventiqDetails = payload?.details ?? {};
  const date = normalizeEventDate(
    payload?.date || summary.date,
    details.confirmedDate,
    details.confirmedTime
  );
  const attendeeCount = payload?.attendeeCount ?? 0;

  // type lives in the summary's free text '<type> • <N> pax'
  const typeText = (summary.summary ?? '').split('•')[0];
  const type = matchEventType(typeText);

  const venue = details.confirmedVenue
    ? {
        name: details.confirmedVenue.name,
        address: details.confirmedVenue.location || details.confirmedVenue.name,
        confirmed: details.confirmedVenue.status === 'confirmed',
      }
    : undefined;

  const catering = details.confirmedCatering
    ? {
        name: details.confirmedCatering.name,
        menu: details.confirmedCatering.price ?? '',
        confirmed: details.confirmedCatering.status === 'confirmed',
      }
    : undefined;

  // Confirmed-ness is derivable from contact statuses (the Whiteboard's
  // AttendeesSection counts confirmed contacts the same way).
  const confirmedContacts = (details.contacts ?? []).filter(
    (c) => c.status === 'confirmed'
  ).length;
  const attendees =
    attendeeCount > 0
      ? { count: attendeeCount, confirmed: Math.min(confirmedContacts, attendeeCount) }
      : undefined;

  const schedule: ScheduleItem[] | undefined = details.schedule?.map((s) => ({
    time: s.time,
    title: s.title,
    speaker: s.speaker,
    status: s.status,
  }));

  let budget: EventModel['budget'];
  if (details.budget) {
    const items = details.budget.items ?? [];
    const itemsSum = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const committed = details.budget.committed ?? itemsSum;
    // The real schema has no 'spent' figure. Derive it from items explicitly
    // marked paid instead of aliasing committed, which auto-completed the
    // 'Payments done' tracker step and showed committed money as spent.
    const paidSum = items
      .filter((item) => /paid|settled/i.test(item.status ?? ''))
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    budget = {
      total: details.budget.total ?? 0,
      committed,
      spent: paidSum,
    };
  }

  const seenVendorIds = new Set<string>();
  const vendors: VendorContact[] = (details.contacts ?? []).map((c, idx) =>
    adaptContact(c, idx, seenVendorIds)
  );

  return {
    id: summary.id,
    name: payload?.name || summary.name,
    status: mapEventStatus(payload?.status ?? summary.status),
    type,
    pinned: summary.pinned,
    date,
    updatedAt: summary.lastActivity,
    coverImage: details.coverImage,
    venue,
    catering,
    attendees,
    schedule,
    budget,
    topics: details.topics,
    vendors,
    milestones: deriveMilestones(details, date),
  };
}
