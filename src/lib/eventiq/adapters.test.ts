import { describe, expect, it } from 'vitest';
import { normalizeEventDate } from './adapters';

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
