'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Send, MessageSquare, X, Sparkles, Link2, Loader2, Lock } from 'lucide-react';
import { useChatStore } from '@/stores/chat-store';
import { useAppStore } from '@/stores/app-store';
import { MarkdownMessage } from '@/components/chat/MarkdownMessage';
import { ThinkingTrace } from '@/components/chat/ThinkingTrace';
import { OptionCardCarousel } from '@/components/chat/OptionCard';
import type { ChatMessage, OptionCard } from '@/types/chat';
import type { EventModel } from '@/lib/eventiq/types';

interface Props {
  events: EventModel[];
  activeEventId?: string | null;
}

const STATUS_MESSAGES = [
  '🔍 Analyzing your request...',
  '🧠 Orchestrator is deciding which agents to use...',
  '📡 Delegating to specialized agents...',
  '🔎 Agents are researching...',
  '✍️ Composing response...',
];

function detectEvent(text: string, events: EventModel[]): EventModel | null {
  const lower = text.toLowerCase();
  // Prefer longer names first to avoid partial collisions
  const sorted = [...events].sort((a, b) => b.name.length - a.name.length);
  for (const ev of sorted) {
    if (ev.name.length < 3) continue;
    if (lower.includes(ev.name.toLowerCase())) return ev;
  }
  return null;
}

export function FloatingAgentChat({ events, activeEventId }: Props) {
  const [open, setOpen] = useState(false);
  const [linkedId, setLinkedId] = useState<string | null>(activeEventId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skipLoadRef = useRef(false);
  const { data: session } = useSession();

  const linkedEvent = useMemo(
    () => events.find((e) => e.id === linkedId) ?? null,
    [events, linkedId],
  );

  const greeting = linkedEvent
    ? `Hi! I'm here to help you organize ${linkedEvent.name}. What would you like to discuss?`
    : "Hi! I'm your event assistant. Ask me anything, or mention an event by name to focus our conversation on it.";

  const startStatusCycling = useCallback(() => {
    let index = 0;
    setLoadingStatus(STATUS_MESSAGES[0]);
    statusIntervalRef.current = setInterval(() => {
      index = (index + 1) % STATUS_MESSAGES.length;
      setLoadingStatus(STATUS_MESSAGES[index]);
    }, 4000);
  }, []);

  const stopStatusCycling = useCallback(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    setLoadingStatus('');
  }, []);

  // Never leak the loading-status interval
  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  // Sync linked event when the user navigates into an event
  useEffect(() => {
    if (activeEventId) setLinkedId(activeEventId);
  }, [activeEventId]);

  // Load a linked event's thread from the server (source of truth — no localStorage)
  const loadThread = useCallback(async (id: string) => {
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/events/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  // Reload thread when the linked event changes
  useEffect(() => {
    if (skipLoadRef.current) {
      skipLoadRef.current = false;
      return;
    }
    if (linkedId) {
      loadThread(linkedId);
    } else {
      setMessages([]);
    }
  }, [linkedId, loadThread]);

  // Refetch the linked thread every time the panel opens so messages sent
  // from the main EventAgentChat surface in the meantime appear here too.
  useEffect(() => {
    if (open && linkedId && !isLoading) {
      void loadThread(linkedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    inputRef.current?.focus();
  }, [messages, isLoading, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading || threadLoading) return;

    if (!session) {
      signIn('google');
      return;
    }

    // Detect event mention to (re)link the conversation (longest match wins)
    const detected = detectEvent(text, events);
    let targetId = linkedId;
    if (detected && detected.id !== linkedId) {
      targetId = detected.id;
      skipLoadRef.current = true;
      setLinkedId(detected.id);
      await loadThread(detected.id);
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((m) => [...m, userMessage]);
    setInput('');
    setIsLoading(true);
    startStatusCycling();

    // Mirror into the main chat when the FAB is linked to the open event
    const mirror = targetId !== null && targetId === useAppStore.getState().activeEventId;
    if (mirror) useChatStore.getState().addMessage(userMessage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          eventId: targetId,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        signIn('google');
        return;
      }

      // Unlinked send created an event — adopt it by auto-linking + refreshing
      // the list so subsequent sends reuse the id (prevents duplicate events).
      // Deliberately NOT setActiveEvent: the FAB is an overlay and must not
      // side-effect-navigate the main pane into the new event's detail view.
      if (data.eventId && !targetId) {
        skipLoadRef.current = true;
        setLinkedId(data.eventId);
        useAppStore.getState().fetchEvents();
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content || data.error || 'No response',
        timestamp: new Date().toISOString(),
        metadata: data.metadata,
      };

      setMessages((m) => [...m, assistantMessage]);
      if (mirror) useChatStore.getState().addMessage(assistantMessage);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'system',
          content: 'Failed to process your message. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      stopStatusCycling();
      setIsLoading(false);
    }
  };

  const unlink = () => setLinkedId(null);

  const handleOptionSelect = (option: OptionCard) => {
    setInput(
      `I'd like to go with "${option.name}"${option.price ? ` (${option.price})` : ''}. Please confirm this choice.`
    );
    inputRef.current?.focus();
  };

  const handleShuffle = () => {
    setInput('Can you search for more options? I want to see different alternatives.');
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 h-14 w-14 grid place-items-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
          aria-label="Open event assistant"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(92vw,380px)] h-[min(80vh,560px)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary-soft text-primary grid place-items-center shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">Event Agent</div>
                <div className="text-xs text-muted-foreground truncate">
                  {linkedEvent ? `Linked to ${linkedEvent.name}` : 'General chat'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {linkedEvent && (
            <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                <Link2 className="h-3 w-3 shrink-0" />
                <span className="truncate">Conversation linked to &quot;{linkedEvent.name}&quot;</span>
              </div>
              <button
                onClick={unlink}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                Unlink
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {threadLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-2">Loading conversation...</p>
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] text-sm text-foreground leading-relaxed">{greeting}</div>
                  </div>
                )}

                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'user' ? (
                      <div className="max-w-[85%] rounded-2xl bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap">
                        {m.content}
                      </div>
                    ) : m.role === 'system' ? (
                      <div className="max-w-[85%] rounded-2xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm">
                        {m.content}
                      </div>
                    ) : (
                      <div className="max-w-[85%] text-sm text-foreground leading-relaxed">
                        {m.metadata?.agentName && (
                          <div className="text-xs font-medium opacity-70 mb-1">
                            {m.metadata.agentName}
                            {m.metadata.creditsCost && (
                              <span className="ml-2">• {m.metadata.creditsCost} credits</span>
                            )}
                          </div>
                        )}
                        <MarkdownMessage content={m.content} />
                        {m.metadata?.thinking && m.metadata.thinking.length > 0 && (
                          <ThinkingTrace steps={m.metadata.thinking} />
                        )}
                        {m.metadata?.options && m.metadata.options.length > 0 && (
                          <OptionCardCarousel
                            options={m.metadata.options}
                            onSelect={handleOptionSelect}
                            onShuffle={handleShuffle}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 max-w-[85%] text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>{loadingStatus || 'Thinking...'}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={session ? 'Mention an event by name to link it…' : 'Sign in to start planning...'}
                className="flex-1 bg-transparent resize-none outline-none text-sm py-1.5 max-h-32"
              />
              <button
                onClick={send}
                disabled={!input.trim() || isLoading || threadLoading}
                className="h-8 w-8 grid place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Send"
              >
                {!session ? <Lock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
