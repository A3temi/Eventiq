'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '@/stores/chat-store';
import { useAppStore } from '@/stores/app-store';
import { Send, Sparkles, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApprovalCard } from './ApprovalCard';
import { ReasoningTrace } from './ReasoningTrace';
import { ThinkingTrace } from './ThinkingTrace';
import { OptionCardCarousel } from './OptionCard';
import type { OptionCard } from '@/types/chat';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { data: session, status } = useSession();
  const { messages, isLoading, historyLoading, pendingApprovals } = useChatStore();
  const activeEventId = useAppStore((s) => s.activeEventId);
  const fetchEvents = useAppStore((s) => s.fetchEvents);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/credits')
        .then((r) => r.json())
        .then((d) => setCredits(d.balance))
        .catch(() => {});
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

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
    useChatStore.getState().setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          eventId: activeEventId,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        signIn('google');
        return;
      }

      if (data.eventId && !activeEventId) {
        useAppStore.getState().setActiveEvent(data.eventId);
      }

      // Always refresh events list so calendar/sidebar picks up date/status changes
      fetchEvents();

      useChatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content || data.error || 'No response',
        timestamp: new Date().toISOString(),
        metadata: data.metadata,
      });

      fetch('/api/credits')
        .then((r) => r.json())
        .then((d) => setCredits(d.balance))
        .catch(() => {});
    } catch (error) {
      useChatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Failed to process your message. Please try again.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      useChatStore.getState().setLoading(false);
    }
  };

  const handleOptionSelect = (option: OptionCard) => {
    const confirmMessage = `I'd like to go with "${option.name}"${option.price ? ` (${option.price})` : ''}. Please proceed.`;
    setInput(confirmMessage);
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSubmit(fakeEvent);
    }, 100);
  };

  const handleShuffle = () => {
    setInput('Show me more options — different alternatives please.');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
        {historyLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Loading conversation...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Eventiq</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
              Describe your event and I'll handle venues, vendors, catering, schedule, and more. Singapore-focused.
            </p>
            {!session && status !== 'loading' && (
              <button
                onClick={() => signIn('google')}
                className="mt-6 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition"
              >
                Sign in to get started
              </button>
            )}
            {session && (
              <div className="mt-4 text-xs text-muted-foreground">
                ✨ {credits ?? '...'} credits available
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3 max-w-3xl animate-card-in',
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}>
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {/* Bubble */}
              <div className={cn(
                'rounded-2xl px-4 py-3 max-w-prose',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : msg.role === 'system'
                  ? 'bg-destructive/10 border border-destructive/20'
                  : 'bg-muted/60'
              )}>
                {msg.metadata?.agentName && (
                  <div className="text-[11px] font-medium opacity-60 mb-1">
                    {msg.metadata.agentName}
                    {msg.metadata.creditsCost && (
                      <span className="ml-2">• {msg.metadata.creditsCost} credits</span>
                    )}
                  </div>
                )}

                {/* Markdown content */}
                <div className="text-sm prose prose-sm prose-neutral dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>li]:my-0.5 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&_a]:text-primary [&_a]:no-underline [&_a:hover]:underline [&_strong]:font-semibold">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {/* Thinking trace */}
                {msg.metadata?.thinking && msg.metadata.thinking.length > 0 && (
                  <ThinkingTrace steps={msg.metadata.thinking} />
                )}

                {/* Option cards */}
                {msg.metadata?.options && msg.metadata.options.length > 0 && (
                  <OptionCardCarousel
                    options={msg.metadata.options}
                    onSelect={handleOptionSelect}
                    onShuffle={handleShuffle}
                  />
                )}

                {msg.metadata?.reasoningTrace && (
                  <ReasoningTrace steps={msg.metadata.reasoningTrace} />
                )}
                {msg.metadata?.approvalRequest && (
                  <ApprovalCard approval={msg.metadata.approvalRequest} />
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3 animate-card-in">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-muted/60 rounded-2xl px-4 py-3">
              <p className="text-sm text-muted-foreground">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card/60 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-4 py-3 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/40 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={1}
              placeholder={session ? 'Describe your event or ask anything...' : 'Sign in to start planning...'}
              className="flex-1 bg-transparent resize-none outline-none text-sm py-0.5 max-h-32 placeholder:text-muted-foreground/60"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-8 w-8 grid place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition shrink-0"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          {session && credits !== null && (
            <div className="text-center text-[11px] text-muted-foreground mt-2">
              ✨ {credits} credits remaining
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
