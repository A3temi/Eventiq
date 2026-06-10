import { create } from 'zustand';
import type { EventSummary } from '@/types/event';
import type { CreditBalance } from '@/types/payment';

interface AppState {
  // Events
  events: EventSummary[];
  activeEventId: string | null;
  eventsLoading: boolean;
  setEvents: (events: EventSummary[]) => void;
  setActiveEvent: (eventId: string | null) => void;
  fetchEvents: () => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  pinEvent: (id: string) => Promise<void>;

  // Credits
  credits: CreditBalance | null;
  setCredits: (credits: CreditBalance) => void;

  // Connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  events: [],
  activeEventId: null,
  eventsLoading: false,
  setEvents: (events) => set({ events }),
  setActiveEvent: (activeEventId) => set({ activeEventId }),

  fetchEvents: async () => {
    set({ eventsLoading: true });
    try {
      const res = await fetch('/api/events');
      if (!res.ok) return;
      const data = await res.json();
      set({ events: data.events || [] });
    } catch (e) {
      console.error('Failed to fetch events:', e);
    } finally {
      set({ eventsLoading: false });
    }
  },

  deleteEvent: async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      const { events, activeEventId } = get();
      set({
        events: events.filter((e) => e.id !== id),
        activeEventId: activeEventId === id ? null : activeEventId,
      });
    } catch (e) {
      console.error('Failed to delete event:', e);
    }
  },

  pinEvent: async (id: string) => {
    const { events } = get();
    const event = events.find((e) => e.id === id);
    if (!event) return;
    const newPinned = !event.pinned;

    set({
      events: events
        .map((e) => (e.id === id ? { ...e, pinned: newPinned } : e))
        .sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        }),
    });

    try {
      await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: newPinned }),
      });
    } catch (e) {
      console.error('Failed to pin event:', e);
    }
  },

  credits: null,
  setCredits: (credits) => set({ credits }),

  isConnected: false,
  setConnected: (isConnected) => set({ isConnected }),
}));
