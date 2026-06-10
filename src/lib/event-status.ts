import type { EventStatus } from '@/types/event';

export type NormalizedEventStatus = 'planning' | 'completed' | 'on-going';

const ONGOING_ALIASES = new Set(['on-going', 'ongoing', 'in-progress', 'in_progress']);
const PLANNING_ALIASES = new Set(['planning', 'draft', 'confirmed']);

function normalizeStatusText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Normalize any persisted/read event status into the only statuses the UI may see.
 * Unknown or missing read values intentionally fall back to planning so legacy rows
 * never leak draft/confirmed/in_progress labels into the dashboard.
 */
export function normalizeEventStatus(value: unknown): NormalizedEventStatus {
  const status = normalizeStatusText(value);
  if (status === 'completed') return 'completed';
  if (ONGOING_ALIASES.has(status)) return 'on-going';
  if (PLANNING_ALIASES.has(status)) return 'planning';
  return 'planning';
}

/**
 * Parse a status supplied by a write/API caller. Legacy aliases are accepted and
 * normalized; unrelated values return null so API routes can reject them.
 */
export function parseEventStatusForWrite(value: unknown): NormalizedEventStatus | null {
  const status = normalizeStatusText(value);
  if (status === 'completed') return 'completed';
  if (ONGOING_ALIASES.has(status)) return 'on-going';
  if (PLANNING_ALIASES.has(status)) return 'planning';
  return null;
}

export function normalizeEventForRead<T extends { status?: unknown }>(event: T): Omit<T, 'status'> & { status: EventStatus } {
  return {
    ...event,
    status: normalizeEventStatus(event.status),
  } as Omit<T, 'status'> & { status: EventStatus };
}
