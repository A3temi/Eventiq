import { create } from 'zustand';
import type { ChatMessage, ApprovalRequest } from '@/types/chat';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  pendingApprovals: ApprovalRequest[];

  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setLoading: (loading: boolean) => void;
  addApproval: (approval: ApprovalRequest) => void;
  updateApproval: (id: string, status: ApprovalRequest['status']) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  pendingApprovals: [],

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setLoading: (isLoading) => set({ isLoading }),

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
}));
