import { create } from 'zustand';
import type { ChatMessage, ApprovalRequest } from '@/types/chat';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  historyLoading: boolean;
  loadingStatus: string;
  pendingApprovals: ApprovalRequest[];

  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setLoading: (loading: boolean) => void;
  setLoadingStatus: (status: string) => void;
  addApproval: (approval: ApprovalRequest) => void;
  updateApproval: (id: string, status: ApprovalRequest['status']) => void;
  clearMessages: () => void;
  loadConversation: (eventId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  historyLoading: false,
  loadingStatus: '',
  pendingApprovals: [],

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setLoading: (isLoading) => set({ isLoading }),

  setLoadingStatus: (loadingStatus) => set({ loadingStatus }),

  addApproval: (approval) =>
    set((state) => ({
      pendingApprovals: [...state.pendingApprovals, approval].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    })),

  updateApproval: (id, status) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.map((a) =>
        a.id === id ? { ...a, status } : a
      ),
    })),

  clearMessages: () => set({ messages: [], pendingApprovals: [] }),

  loadConversation: async (eventId: string) => {
    set({ historyLoading: true, messages: [] });
    try {
      const res = await fetch(`/api/events/${eventId}/messages`);
      if (!res.ok) {
        set({ historyLoading: false });
        return;
      }
      const data = await res.json();
      set({ messages: data.messages || [], historyLoading: false });
    } catch (e) {
      console.error('Failed to load conversation:', e);
      set({ historyLoading: false });
    }
  },
}));
