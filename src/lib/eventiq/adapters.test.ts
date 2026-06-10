import { describe, expect, it } from 'vitest';
import { adaptEvent, mapEventStatus, normalizeEventDate, type DetailsPayload } from './adapters';
import type { EventSummary } from '@/types/event';

/** Local-time components of a normalized result, for timezone-safe asserts. */
function localYmd(iso: string) {
  const d = new Date(iso);
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), hh: d.getHours(), mm: d.getMinutes() };
}

describe('normalizeEventDate', () => {
  it('keeps a parseable top-level date untouched', () => {
    expect(normalizeEventDate('2026-03-01T10:00:00Z', 'September 12, 2026')).toBe(
      '2026-03-01T10:00:00Z'
    );
  });

  it('passes ISO-like confirmedDate through without re-encoding (no timezone day shift)', () => {
    expect(normalizeEventDate('', '2026-09-12')).toBe('2026-09-12');
  });

  it('parses free-text confirmedDate from the agent', () => {
    const iso = normalizeEventDate('', 'September 12, 2026');
    expect(localYmd(iso)).toMatchObject({ y: 2026, m: 9, d: 12 });
  });

  it('handles weekday prefix and ordinal suffix', () => {
    const iso = normalizeEventDate('', 'Saturday, June 20th, 2026');
    expect(localYmd(iso)).toMatchObject({ y: 2026, m: 6, d: 20 });
  });

  it('merges a parseable confirmedTime into a free-text date', () => {
    const iso = normalizeEventDate('', 'September 12, 2026', '5:30 PM');
    expect(localYmd(iso)).toMatchObject({ y: 2026, m: 9, d: 12, hh: 17, mm: 30 });
  });

  it('ignores unparseable confirmedTime', () => {
    const iso = normalizeEventDate('', 'September 12, 2026', 'evening');
    expect(localYmd(iso)).toMatchObject({ y: 2026, m: 9, d: 12, hh: 0, mm: 0 });
  });

  it('resolves a yearless date to the upcoming occurrence', () => {
    const now = new Date();
    const iso = normalizeEventDate('', 'June 20');
    const parsed = new Date(iso);
    expect(parsed.getMonth() + 1).toBe(6);
    expect(parsed.getDate()).toBe(20);
    expect(parsed.getTime()).toBeGreaterThan(now.getTime() - 24 * 60 * 60 * 1000);
    expect([now.getFullYear(), now.getFullYear() + 1]).toContain(parsed.getFullYear());
  });

  it('returns empty string when nothing parses', () => {
    expect(normalizeEventDate('', 'sometime in summer')).toBe('');
    expect(normalizeEventDate('', undefined)).toBe('');
    expect(normalizeEventDate(undefined, undefined)).toBe('');
  });
});

describe('event status and budget adaptation', () => {
  const summary: EventSummary = {
    id: 'evt-1',
    name: 'Launch',
    date: '',
    status: 'planning',
    lastActivity: '2026-01-01T00:00:00.000Z',
  };

  it('never returns legacy event statuses', () => {
    expect(mapEventStatus('draft')).toBe('planning');
    expect(mapEventStatus('confirmed')).toBe('planning');
    expect(mapEventStatus('in_progress')).toBe('on-going');
    expect(mapEventStatus('in-progress')).toBe('on-going');
    expect(mapEventStatus('completed')).toBe('completed');
  });

  it('uses details.budget when present', () => {
    const event = adaptEvent(summary, {
      details: { budget: { total: 5000, committed: 1200, items: [{ name: 'Venue', amount: 1200, status: 'committed' }] } },
      name: 'Launch',
      status: 'planning',
      attendeeCount: 0,
      date: '',
      budget: { total: 9000, currency: 'SGD', categories: [{ name: 'venue', allocated: 9000, committed: 9000, spent: 0, remaining: 0, utilizationPercent: 100, isOverBudget: false, isWarning: false }] },
    } satisfies DetailsPayload);

    expect(event.budget).toEqual({ total: 5000, committed: 1200, spent: 0 });
  });

  it('derives budget from top-level payload budget when details budget is absent', () => {
    const event = adaptEvent(summary, {
      details: {},
      name: 'Launch',
      status: 'planning',
      attendeeCount: 0,
      date: '',
      budget: {
        total: 8000,
        currency: 'SGD',
        categories: [
          { name: 'venue', allocated: 5000, committed: 3000, spent: 1000, remaining: 2000, utilizationPercent: 60, isOverBudget: false, isWarning: false },
          { name: 'catering', allocated: 3000, committed: 1500, spent: 500, remaining: 1500, utilizationPercent: 50, isOverBudget: false, isWarning: false },
        ],
      },
    } satisfies DetailsPayload);

    expect(event.budget).toEqual({ total: 8000, committed: 4500, spent: 1500 });
  });

  it('ignores the default empty top-level budget', () => {
    const event = adaptEvent(summary, {
      details: {},
      name: 'Launch',
      status: 'planning',
      attendeeCount: 0,
      date: '',
      budget: { total: 0, currency: 'SGD', categories: [] },
    } satisfies DetailsPayload);

    expect(event.budget).toBeUndefined();
  });

  it('adapts persisted details into dashboard fields', () => {
    const event = adaptEvent(summary, {
      details: {
        confirmedVenue: { name: 'Expo Hall', status: 'confirmed' },
        budget: { total: 5000, committed: 2500, items: [{ name: 'Venue', amount: 2500, status: 'paid' }] },
        schedule: [{ time: '09:00', title: 'Registration' }],
        topics: ['AI demos'],
      },
      name: 'Launch',
      status: 'on-going',
      attendeeCount: 40,
      date: '',
    } satisfies DetailsPayload);

    expect(event.status).toBe('on-going');
    expect(event.venue?.name).toBe('Expo Hall');
    expect(event.attendees).toEqual({ count: 40, confirmed: 0 });
    expect(event.budget).toEqual({ total: 5000, committed: 2500, spent: 2500 });
    expect(event.schedule).toEqual([{ time: '09:00', title: 'Registration' }]);
    expect(event.topics).toEqual(['AI demos']);
  });
});
