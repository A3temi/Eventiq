'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Send, Sparkles, X, Loader2, Lock } from 'lucide-react';
import { useChatStore } from '@/stores/chat-store';
import { useAppStore } from '@/stores/app-store';
import { MarkdownMessage } from '@/components/chat/MarkdownMessage';
import { ThinkingTrace } from '@/components/chat/ThinkingTrace';
import { OptionCardCarousel } from '@/components/chat/OptionCard';
import type { OptionCard } from '@/types/chat';

interface Props {
  onCancel: () => void;
  onCreated: (eventId: string) => void;
}

const STATUS_MESSAGES = [
  '🔍 Analyzing your request...',
  '🧠 Orchestrator is deciding which agents to use...',
  '📡 Delegating to specialized agents...',
  '🔎 Agents are researching...',
  '✍️ Composing response...',
];

export function NewEventChat({ onCancel, onCreated }: Props) {
  const [input, setInput] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { data: session, status } = useSession();
  const { messages, isLoading, loadingStatus } = useChatStore();

  // Fresh thread for the new event (carries into EventAgentChat afterwards)
  useEffect(() => {
    useChatStore.getState().clearMessages();
  }, []);

  // Never leak the loading-status interval
  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  const startStatusCycling = useCallback(() => {
    let index = 0;
    useChatStore.getState().setLoadingStatus(STATUS_MESSAGES[0]);
    statusIntervalRef.current = setInterval(() => {
      index = (index + 1) % STATUS_MESSAGES.length;
      useChatStore.getState().setLoadingStatus(STATUS_MESSAGES[index]);
    }, 4000);
  }, []);

  const stopStatusCycling = useCallback(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    useChatStore.getState().setLoadingStatus('');
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    inputRef.current?.focus();
  }, [messages, isLoading]);

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

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    if (!session) {
      signIn('google');
      return;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: text,
      timestamp: new Date().toISOString(),
    };

    useChatStore.getState().addMessage(userMessage);
    setInput('');
    useChatStore.getState().setLoading(true);
    startStatusCycling();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          eventId,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        signIn('google');
        return;
      }

      // Adopt the event created by the agent — critical, prevents duplicates
      if (data.eventId && !eventId) {
        setEventId(data.eventId);
        useAppStore.getState().setActiveEvent(data.eventId);
        useAppStore.getState().fetchEvents();
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
      stopStatusCycling();
      useChatStore.getState().setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary grid place-items-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">New event with Eventiq</div>
            <div className="text-xs text-muted-foreground">Chat with the agent to set up your event</div>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        <div className="flex justify-start">
          <div className="max-w-[80%] text-sm text-foreground leading-relaxed">
            Hi! I&apos;m your Eventiq planning agent. Let&apos;s set up a new event together — tell me
            what you&apos;re planning (name, type, date, guests) and I&apos;ll spin up your workspace.
          </div>
        </div>

        {!session && status !== 'loading' && (
          <div className="flex justify-start">
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Sign in with Google to get started
            </button>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'user' ? (
              <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-sm whitespace-pre-wrap">
                {m.content}
              </div>
            ) : m.role === 'system' ? (
              <div className="max-w-[80%] rounded-2xl bg-destructive/10 border border-destructive/20 px-4 py-2 text-sm">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[80%] text-sm text-foreground leading-relaxed">
                {m.metadata?.agentName && (
                  <div className="text-xs font-medium opacity-70 mb-1">
                    {m.metadata.agentName}
                    {m.metadata.creditsCost && (
                      <span className="ml-2">• {m.metadata.creditsCost} credits</span>
                    )}
                  </div>
                )}
                <MarkdownMessage content={m.content} />

                {/* The creation agent frequently returns venue/vendor option
                    cards and thinking traces — render them, don't drop them. */}
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
            <div className="flex items-center gap-2 max-w-[80%] text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{loadingStatus || 'Thinking...'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-4 space-y-3">
        {eventId && (
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Your event workspace is ready.
            </div>
            <button
              onClick={() => onCreated(eventId)}
              className="rounded-xl bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90"
            >
              Open event dashboard →
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2">
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
            placeholder={session ? 'Type your message...' : 'Sign in to start planning...'}
            className="flex-1 bg-transparent resize-none outline-none text-sm py-1.5 max-h-32"
          />
          <button
            onClick={send}
            disabled={!input.trim() || isLoading}
            className="h-8 w-8 grid place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send"
          >
            {!session ? <Lock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
