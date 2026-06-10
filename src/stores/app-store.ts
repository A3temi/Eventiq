import { create } from 'zustand';
import type { EventSummary } from '@/types/event';
import type { CreditBalance } from '@/types/payment';

export type ViewMode = 'chat' | 'whiteboard';

interface AppState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  
  // Events
  events: EventSummary[];
  activeEventId: string | null;
  setEvents: (events: EventSummary[]) => void;
  setActiveEvent: (eventId: string | null) => void;
  
  // Credits
  credits: CreditBalance | null;
  setCredits: (credits: CreditBalance) => void;
  
  // Connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: 'chat',
  setMode: (mode) => set({ mode }),

  events: [],
  activeEventId: null,
  setEvents: (events) => set({ events }),
  setActiveEvent: (activeEventId) => set({ activeEventId }),

  credits: null,
  setCredits: (credits) => set({ credits }),

  isConnected: false,
  setConnected: (isConnected) => set({ isConnected }),
}));
