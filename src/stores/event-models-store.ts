'use client';

/**
 * Details store: caches GET /api/events/[id]/details payloads, writes back via
 * PATCH /api/events/[id] {details} (optimistic + refetch), and polls a single
 * event id every 5s to preserve the whiteboard-style freshness (agent/chat
 * updates appear on the Dashboard within 5s).
 *
 * Does NOT touch app-store or chat-store — it only composes app-store
 * summaries with the cached details via the useEventModel hook.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { useAppStore } from '@/stores/app-store';
import { adaptEvent, type DetailsPayload, type EventiqDetails } from '@/lib/eventiq/adapters';
import type { EventModel } from '@/lib/eventiq/types';

interface EventModelsState {
  detailsById: Record<string, DetailsPayload>;
  /** Event id currently being polled (single id at a time). */
  pollingId: string | null;
  fetchDetails: (id: string) => Promise<void>;
  fetchAllDetails: (ids: string[]) => Promise<void>;
  /**
   * Re-fetch the latest details, apply `mutate` to a deep clone of them
   * (optimistic local update), PATCH the full merged details object to the
   * server, then refetch. `mutate` may modify the draft in place or return a
   * new details object.
   */
  patchDetails: (
    id: string,
    mutate: (details: EventiqDetails) => EventiqDetails | void
  ) => Promise<void>;
  startPolling: (id: string) => void;
  stopPolling: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export const useEventModelsStore = create<EventModelsState>((set, get) => ({
  detailsById: {},
  pollingId: null,

  fetchDetails: async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/events/${id}/details`);
      if (!res.ok) return;
      const data = await res.json();
      set((state) => ({
        detailsById: {
          ...state.detailsById,
          [id]: {
            details: (data.details ?? {}) as EventiqDetails,
            name: data.name ?? '',
            status: data.status ?? 'draft',
            attendeeCount: data.attendeeCount ?? 0,
            date: data.date ?? '',
          },
        },
      }));
    } catch (e) {
      console.error('Failed to fetch event details:', e);
    }
  },

  fetchAllDetails: async (ids) => {
    await Promise.all(ids.map((id) => get().fetchDetails(id)));
  },

  patchDetails: async (id, mutate) => {
    if (!id) return;
    // Re-fetch right before mutating: the cache may be up to 5s stale (or
    // stale-forever for non-active events). The PATCH below replaces the whole
    // details object, so merging from stale data would silently clobber fields
    // the whiteboard agent wrote server-side in the meantime.
    await get().fetchDetails(id);
    const current = get().detailsById[id];
    const draft: EventiqDetails = current?.details
      ? (JSON.parse(JSON.stringify(current.details)) as EventiqDetails)
      : {};
    const result = mutate(draft);
    const nextDetails: EventiqDetails = result ?? draft;

    // Optimistic local update
    set((state) => ({
      detailsById: {
        ...state.detailsById,
        [id]: current
          ? { ...current, details: nextDetails }
          : { details: nextDetails, name: '', status: 'draft', attendeeCount: 0, date: '' },
      },
    }));

    try {
      await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details: nextDetails }),
      });
    } catch (e) {
      console.error('Failed to patch event details:', e);
    }

    // Refetch so local state converges with the server's view
    await get().fetchDetails(id);
  },

  startPolling: (id) => {
    get().stopPolling();
    if (!id) return;
    set({ pollingId: id });
    void get().fetchDetails(id);
    pollTimer = setInterval(() => {
      void get().fetchDetails(id);
    }, 5000);
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (get().pollingId !== null) set({ pollingId: null });
  },
}));

/**
 * Composes the app-store summary + cached details payload into the ported
 * UI's EventModel. Returns null when the event isn't in the summaries list.
 */
export function useEventModel(id: string | null | undefined): EventModel | null {
  const summary = useAppStore((s) => (id ? s.events.find((e) => e.id === id) : undefined));
  const payload = useEventModelsStore((s) => (id ? s.detailsById[id] : undefined));
  return useMemo(() => (summary ? adaptEvent(summary, payload) : null), [summary, payload]);
}

/** All app-store events adapted to EventModels (details applied when cached). */
export function useAllEventModels(): EventModel[] {
  const events = useAppStore((s) => s.events);
  const detailsById = useEventModelsStore((s) => s.detailsById);
  return useMemo(() => events.map((e) => adaptEvent(e, detailsById[e.id])), [events, detailsById]);
}
