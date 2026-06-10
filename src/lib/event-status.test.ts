import { describe, expect, it } from 'vitest';
import { normalizeEventStatus, parseEventStatusForWrite } from './event-status';

describe('event status normalization', () => {
  it('passes through allowed statuses', () => {
    expect(normalizeEventStatus('planning')).toBe('planning');
    expect(normalizeEventStatus('completed')).toBe('completed');
    expect(normalizeEventStatus('on-going')).toBe('on-going');
  });

  it('normalizes legacy statuses for reads', () => {
    expect(normalizeEventStatus('draft')).toBe('planning');
    expect(normalizeEventStatus('confirmed')).toBe('planning');
    expect(normalizeEventStatus('in-progress')).toBe('on-going');
    expect(normalizeEventStatus('in_progress')).toBe('on-going');
    expect(normalizeEventStatus('ongoing')).toBe('on-going');
  });

  it('falls back unknown read values to planning', () => {
    expect(normalizeEventStatus(undefined)).toBe('planning');
    expect(normalizeEventStatus('archived')).toBe('planning');
  });

  it('returns null for unsupported write values', () => {
    expect(parseEventStatusForWrite('archived')).toBeNull();
    expect(parseEventStatusForWrite(null)).toBeNull();
  });

  it('accepts legacy write aliases and normalizes them', () => {
    expect(parseEventStatusForWrite('draft')).toBe('planning');
    expect(parseEventStatusForWrite('confirmed')).toBe('planning');
    expect(parseEventStatusForWrite('in_progress')).toBe('on-going');
  });
});
