'use client';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import { useSession, signIn } from 'next-auth/react';

export function WhiteboardInput() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  const activeEventId = useAppStore((s) => s.activeEventId);
  const fetchEvents = useAppStore((s) => s.fetchEvents);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    if (!session) {
      signIn('google');
      return;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    useChatStore.getState().addMessage(userMessage);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, eventId: activeEventId }),
      });

      const data = await response.json();

      if (response.status === 401) {
        signIn('google');
        return;
      }

      // Update active event if one was created
      if (data.eventId && !activeEventId) {
        useAppStore.getState().setActiveEvent(data.eventId);
        fetchEvents();
      }

      useChatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content || data.error || 'No response',
        timestamp: new Date().toISOString(),
        metadata: data.metadata,
      });
    } catch {
      useChatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Failed to process your message. Please try again.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t p-3 bg-card">
      <div className="flex items-center gap-2 max-w-3xl mx-auto">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell the agent what to change..."
          className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
