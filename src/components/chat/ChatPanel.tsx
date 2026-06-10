'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '@/stores/chat-store';
import { useAppStore } from '@/stores/app-store';
import { Send, Paperclip, Bot, User, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApprovalCard } from './ApprovalCard';
import { ReasoningTrace } from './ReasoningTrace';
import { ThinkingTrace } from './ThinkingTrace';
import { OptionCardCarousel } from './OptionCard';
import { MarkdownMessage } from './MarkdownMessage';
import { ActionItems } from './ActionItems';
import { MessageActions } from './MessageActions';
import type { OptionCard } from '@/types/chat';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
  const { messages, isLoading, historyLoading, pendingApprovals } = useChatStore();
  const activeEventId = useAppStore((s) => s.activeEventId);
  const fetchEvents = useAppStore((s) => s.fetchEvents);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when switching events
  useEffect(() => {
    if (activeEventId && session?.user?.email) {
      fetch(`/api/events/${activeEventId}/messages`)
        .then((r) => r.ok ? r.json() : { messages: [] })
        .then((data) => {
          if (data.messages && data.messages.length > 0) {
            useChatStore.getState().setMessages(data.messages);
          }
        })
        .catch(() => {});
    }
  }, [activeEventId, session]);

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
      useChatStore.getState().setLoading(false);
    }
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

  const handleEditSubmit = async (messageId: string) => {
    if (!editText.trim() || isLoading) return;

    // Find the index of the edited message
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    // Remove all messages after the edited one
    const trimmedMessages = messages.slice(0, msgIndex);
    useChatStore.getState().setMessages(trimmedMessages);

    // Clear editing state
    setEditingId(null);

    // Submit the edited message as a new message
    setInput(editText.trim());
    setEditText('');

    // Trigger submit with the edited text
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: editText.trim(),
      timestamp: new Date().toISOString(),
    };

    useChatStore.getState().addMessage(userMessage);
    useChatStore.getState().setLoading(true);
    setInput('');

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
      useChatStore.getState().setLoading(false);
    }
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
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {historyLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Loading conversation...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Eventiq</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Describe your event and I&apos;ll handle venues, vendors,
              tickets, payments, and more. Singapore-focused.
            </p>
            {!session && status !== 'loading' && (
              <button
                onClick={() => signIn('google')}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                Sign in with Google to get started
              </button>
            )}
          </div>
        ) : (
          messages.map((msg, msgIndex) => (
            <div
              key={msg.id}
              className={cn(
                'group relative flex gap-3 max-w-3xl',
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={cn(
                'relative rounded-xl p-3 max-w-prose',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : msg.role === 'system'
                  ? 'bg-destructive/10 border border-destructive/20'
                  : 'bg-muted'
              )}>
                {msg.metadata?.agentName && (
                  <div className="text-xs font-medium opacity-70 mb-1">
                    {msg.metadata.agentName}
                    {msg.metadata.creditsCost && (
                      <span className="ml-2">• {msg.metadata.creditsCost} credits</span>
                    )}
                  </div>
                )}
                <div className="text-sm prose prose-sm prose-neutral max-w-none dark:prose-invert [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0.5 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&_a]:text-primary [&_a]:underline">
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

                {/* Legacy reasoning trace */}
                {msg.metadata?.reasoningTrace && (
                  <ReasoningTrace steps={msg.metadata.reasoningTrace} />
                )}
                {msg.metadata?.approvalRequest && (
                  <ApprovalCard approval={msg.metadata.approvalRequest} />
                )}

                {/* Message actions */}
                {msg.role !== 'system' && editingId !== msg.id && (
                  <MessageActions
                    role={msg.role}
                    content={msg.content}
                    messageId={msg.id}
                    onEdit={msg.role === 'user' ? (content) => handleStartEdit(msg.id, content) : undefined}
                    onRetry={msg.role === 'assistant' ? () => handleRetry(msgIndex) : undefined}
                  />
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-sm text-muted-foreground">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar - always visible */}
      {messages.length > 0 && (
        <ActionItems messages={messages} onSelect={(text) => setInput(text)} />
      )}
      <form onSubmit={handleSubmit} className="border-t p-4 bg-card">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <button
            type="button"
            className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground"
            aria-label="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={session ? 'Describe your event or ask me anything...' : 'Sign in to start planning...'}
            className="flex-1 px-4 py-2.5 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            aria-label="Send message"
          >
            {!session ? <Lock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
