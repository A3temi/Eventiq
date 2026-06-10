import { describe, expect, it } from 'vitest';
import {
  applyEventDetailsPatch,
  eventDetailsPatchFromField,
  extractEventDetailsPatch,
  hasPersistedField,
  mergeEventDetails,
} from './event-details';
import type { EventBrief } from '@/types/event';

describe('event detail extraction and guardrails', () => {
  it('extracts budget totals and line items from budget-style responses', () => {
    const patch = extractEventDetailsPatch(`Budget estimate\n- Venue: S$2,000\n- Catering: S$1,500\nTotal budget: S$3,500`);

    expect(patch.expectedFields).toContain('budget');
    expect(patch.details.budget).toMatchObject({ total: 3500, committed: 3500 });
    expect(patch.details.budget?.items).toHaveLength(2);
    expect(patch.details.visibleSections).toContain('budget');
  });

  it('extracts schedule lines from timeline responses', () => {
    const patch = extractEventDetailsPatch(`Timeline\n09:00 - Registration\n10:30 — Keynote`);

    expect(patch.expectedFields).toContain('schedule');
    expect(patch.details.schedule).toEqual([
      { time: '09:00', title: 'Registration', status: 'confirmed' },
      { time: '10:30', title: 'Keynote', status: 'confirmed' },
    ]);
  });

  it('extracts topics/plans', () => {
    const patch = extractEventDetailsPatch(`Topics include:\n- AI demos\n- Customer panel\n- Networking`);

    expect(patch.expectedFields).toContain('topics');
    expect(patch.details.topics).toEqual(['AI demos', 'Customer panel', 'Networking']);
  });

  it('does not overwrite existing details during heuristic merge', () => {
    const merged = mergeEventDetails(
      { budget: { total: 1000 }, topics: ['Existing'], visibleSections: ['budget'] },
      { budget: { total: 2000 }, topics: ['New'], schedule: [{ time: '09:00', title: 'Welcome' }], visibleSections: ['topics', 'schedule'] },
    );

    expect(merged.budget?.total).toBe(1000);
    expect(merged.topics).toEqual(['Existing']);
    expect(merged.schedule).toEqual([{ time: '09:00', title: 'Welcome' }]);
    expect(merged.visibleSections?.sort()).toEqual(['budget', 'schedule', 'topics']);
  });

  it('lets explicit tool saves replace stale details', () => {
    const patch = eventDetailsPatchFromField(
      'budget',
      JSON.stringify({ total: 2500, committed: 1800, items: [{ name: 'Venue', amount: 1800, status: 'committed' }] }),
    );
    const updated = applyEventDetailsPatch(
      { budget: { total: 1000 }, topics: ['Existing'], visibleSections: ['budget'] },
      { ...patch.details, topics: ['Updated'], visibleSections: ['budget', 'topics'] },
    );

    expect(updated.budget).toMatchObject({ total: 2500, committed: 1800 });
    expect(updated.topics).toEqual(['Updated']);
    expect(updated.visibleSections?.sort()).toEqual(['budget', 'topics']);
  });

  it('parses structured save_event_details fields', () => {
    const venuePatch = eventDetailsPatchFromField('venue', JSON.stringify({ name: 'Expo Hall', price: 'S$2,000' }));
    const attendeePatch = eventDetailsPatchFromField('attendees', '40');
    const topicsPatch = eventDetailsPatchFromField('topics', 'AI demos, Customer panel');

    expect(venuePatch.details.confirmedVenue).toMatchObject({ name: 'Expo Hall', status: 'confirmed' });
    expect(attendeePatch.attendeeCount).toBe(40);
    expect(topicsPatch.details.topics).toEqual(['AI demos', 'Customer panel']);
  });

  it('checks persisted fields for verification', () => {
    const event = {
      attendeeCount: 25,
      details: {
        budget: { total: 5000 },
        schedule: [{ time: '09:00', title: 'Welcome' }],
        topics: ['Launch'],
      },
    } as EventBrief;

    expect(hasPersistedField(event, 'attendeeCount')).toBe(true);
    expect(hasPersistedField(event, 'budget')).toBe(true);
    expect(hasPersistedField(event, 'schedule')).toBe(true);
    expect(hasPersistedField(event, 'topics')).toBe(true);
    expect(hasPersistedField(event, 'contacts')).toBe(false);
  });
});
