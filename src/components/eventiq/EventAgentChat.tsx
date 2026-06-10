'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Send, MessageSquare, X, Loader2, Lock } from 'lucide-react';
import { useChatStore } from '@/stores/chat-store';
import { useAppStore } from '@/stores/app-store';
import { MarkdownMessage } from '@/components/chat/MarkdownMessage';
import { ThinkingTrace } from '@/components/chat/ThinkingTrace';
import { ReasoningTrace } from '@/components/chat/ReasoningTrace';
import { ApprovalCard } from '@/components/chat/ApprovalCard';
import { OptionCardCarousel } from '@/components/chat/OptionCard';
import { ActionItems } from '@/components/chat/ActionItems';
import { MessageActions } from '@/components/chat/MessageActions';
import type { OptionCard } from '@/types/chat';
import type { EventModel } from '@/lib/eventiq/types';

interface Props {
  event: EventModel;
  onClose: () => void;
}

const STATUS_MESSAGES = [
  '🔍 Analyzing your request...',
  '🧠 Orchestrator is deciding which agents to use...',
  '📡 Delegating to specialized agents...',
  '🔎 Agents are researching...',
  '✍️ Composing response...',
];

export function EventAgentChat({ event, onClose }: Props) {
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { data: session, status } = useSession();
  const { messages, isLoading, historyLoading, loadingStatus } = useChatStore();

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

  // Never leak the loading-status interval
  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    inputRef.current?.focus();
  }, [messages, isLoading]);

  // Load messages when switching events (same guard as ChatPanel)
  useEffect(() => {
    if (event.id && session?.user?.email) {
      fetch(`/api/events/${event.id}/messages`)
        .then((r) => (r.ok ? r.json() : { messages: [] }))
        .then((data) => {
          if (data.messages && data.messages.length > 0) {
            useChatStore.getState().setMessages(data.messages);
          }
        })
        .catch(() => {});
    }
  }, [event.id, session]);

  const sendMessage = async (text: string) => {
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: text,
      timestamp: new Date().toISOString(),
    };

    useChatStore.getState().addMessage(userMessage);
    useChatStore.getState().setLoading(true);
    startStatusCycling();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          eventId: event.id,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        signIn('google');
        return;
      }

      // Adoption guard (faithful to ChatPanel — harmless here since event exists)
      if (data.eventId && !useAppStore.getState().activeEventId) {
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

  const send = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    if (!session) {
      signIn('google');
      return;
    }
    setInput('');
    sendMessage(text);
  };

  const handleOptionSelect = (option: OptionCard) => {
    const confirmMessage = `I'd like to go with "${option.name}"${option.price ? ` (${option.price})` : ''}. Please confirm this choice.`;
    setInput(confirmMessage);
    // Don't auto-submit - let user press enter or modify
  };

  const handleShuffle = () => {
    setInput('Can you search for more options? I want to see different alternatives.');
  };

  const handleStartEdit = (messageId: string, content: string) => {
    setEditingId(messageId);
    setEditText(content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleEditSubmit = (messageId: string) => {
    const text = editText.trim();
    if (!text || isLoading) return;

    // Find the index of the edited message
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    // Remove all messages after the edited one (client-side truncation, as ChatPanel)
    const trimmedMessages = messages.slice(0, msgIndex);
    useChatStore.getState().setMessages(trimmedMessages);

    setEditingId(null);
    setEditText('');

    sendMessage(text);
  };

  const handleRetry = (messageIndex: number) => {
    // Find the preceding user message
    const precedingMessages = messages.slice(0, messageIndex);
    const lastUserMessage = [...precedingMessages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      setInput(lastUserMessage.content);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary grid place-items-center">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Event Agent</div>
            <div className="text-xs text-muted-foreground">Organizing {event.name}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {historyLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Loading conversation...</p>
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <>
                <div className="flex justify-start">
                  <div className="max-w-[80%] text-sm text-foreground leading-relaxed">
                    Hi! I&apos;m here to help you organize {event.name}. What would you like to discuss?
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
              </>
            )}

            {messages.map((msg, msgIndex) => (
              <div
                key={msg.id}
                className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'user' ? (
                  editingId === msg.id ? (
                    <div className="relative max-w-[80%] w-full rounded-2xl border border-primary/40 bg-card p-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleEditSubmit(msg.id);
                          }
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        rows={2}
                        autoFocus
                        className="w-full bg-transparent resize-none outline-none text-sm p-1"
                      />
                      <div className="flex justify-end gap-2 mt-1">
                        <button
                          onClick={handleCancelEdit}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEditSubmit(msg.id)}
                          disabled={!editText.trim() || isLoading}
                          className="text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1 disabled:opacity-40"
                        >
                          Save &amp; send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-sm whitespace-pre-wrap">
                      {msg.content}
                      <MessageActions
                        role={msg.role}
                        content={msg.content}
                        messageId={msg.id}
                        onEdit={(content) => handleStartEdit(msg.id, content)}
                      />
                    </div>
                  )
                ) : msg.role === 'system' ? (
                  <div className="max-w-[80%] rounded-2xl bg-destructive/10 border border-destructive/20 px-4 py-2 text-sm">
                    {msg.content}
                  </div>
                ) : (
                  <div className="relative max-w-[80%] text-sm text-foreground leading-relaxed">
                    {msg.metadata?.agentName && (
                      <div className="text-xs font-medium opacity-70 mb-1">
                        {msg.metadata.agentName}
                        {msg.metadata.creditsCost && (
                          <span className="ml-2">• {msg.metadata.creditsCost} credits</span>
                        )}
                      </div>
                    )}
                    <MarkdownMessage content={msg.content} />

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

                    {/* Legacy reasoning trace */}
                    {msg.metadata?.reasoningTrace && (
                      <ReasoningTrace steps={msg.metadata.reasoningTrace} />
                    )}
                    {msg.metadata?.approvalRequest && (
                      <ApprovalCard approval={msg.metadata.approvalRequest} />
                    )}

                    <MessageActions
                      role={msg.role}
                      content={msg.content}
                      messageId={msg.id}
                      onRetry={() => handleRetry(msgIndex)}
                    />
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
          </>
        )}
      </div>

      {messages.length > 0 && (
        <ActionItems messages={messages} onSelect={(text) => setInput(text)} />
      )}
      <div className="border-t border-border p-4">
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
