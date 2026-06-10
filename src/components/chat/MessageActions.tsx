'use client';

import { useState } from 'react';
import { Copy, Pencil, ThumbsUp, ThumbsDown, RefreshCw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageActionsProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageId: string;
  onEdit?: (content: string) => void;
  onRetry?: () => void;
}

export function MessageActions({ role, content, messageId, onEdit, onRetry }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(content);
    }
  };

  return (
    <div
      className={cn(
        'absolute opacity-0 group-hover:opacity-100 transition-opacity z-10',
        'flex gap-1 items-center bg-card border rounded-md px-1 py-0.5 shadow-sm',
        role === 'user' ? '-bottom-5 right-0' : '-bottom-5 left-10'
      )}
    >
      {/* Copy - available for all messages */}
      <button
        onClick={handleCopy}
        className="p-0.5 rounded hover:bg-accent transition-colors"
        aria-label="Copy message"
        title="Copy"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
        )}
      </button>

      {/* Edit - user messages only */}
      {role === 'user' && onEdit && (
        <button
          onClick={handleEdit}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          aria-label="Edit message"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
        </button>
      )}

      {/* Feedback - assistant messages only */}
      {role === 'assistant' && (
        <>
          <button
            onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            aria-label="Good response"
            title="Good response"
          >
            <ThumbsUp
              className={cn(
                'w-3.5 h-3.5 transition-colors',
                feedback === 'up'
                  ? 'text-green-500'
                  : 'text-muted-foreground/50 hover:text-muted-foreground'
              )}
            />
          </button>
          <button
            onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            aria-label="Bad response"
            title="Bad response"
          >
            <ThumbsDown
              className={cn(
                'w-3.5 h-3.5 transition-colors',
                feedback === 'down'
                  ? 'text-red-500'
                  : 'text-muted-foreground/50 hover:text-muted-foreground'
              )}
            />
          </button>
        </>
      )}

      {/* Retry - assistant messages only */}
      {role === 'assistant' && onRetry && (
        <button
          onClick={onRetry}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          aria-label="Retry"
          title="Retry"
        >
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
