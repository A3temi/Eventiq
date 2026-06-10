'use client';

import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { useAppStore } from '@/stores/app-store';
import { Send, Paperclip, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApprovalCard } from './ApprovalCard';
import { ReasoningTrace } from './ReasoningTrace';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, pendingApprovals } = useChatStore();
  const credits = useAppStore((s) => s.credits);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

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
          eventId: useAppStore.getState().activeEventId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        useChatStore.getState().addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.content,
          timestamp: new Date().toISOString(),
          metadata: data.metadata,
        });
      }
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

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-12 h-12 text-primary/40 mb-4" />
            <h2 className="text-lg font-medium">Eventiq</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Describe your event and I&apos;ll handle venues, vendors,
              tickets, payments, and more. Singapore-focused.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3 max-w-3xl',
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
                'rounded-lg p-3 max-w-prose',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
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
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Thinking...</p>
            </div>
          </div>
        )}

        {/* Pending approvals */}
        {pendingApprovals.filter((a) => a.status === 'pending').length > 0 && (
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium mb-2">Pending Approvals</h3>
            {pendingApprovals
              .filter((a) => a.status === 'pending')
              .map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar - always visible */}
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
            placeholder="Describe your event or ask me anything..."
            className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {credits && (
          <div className="text-center text-xs text-muted-foreground mt-2">
            {credits.balance} credits remaining
          </div>
        )}
      </form>
    </div>
  );
}
