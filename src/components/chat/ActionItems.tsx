'use client';

import { useMemo } from 'react';
import type { ChatMessage } from '@/types/chat';

interface ActionItemsProps {
  messages: ChatMessage[];
  onSelect: (text: string) => void;
}

/** Icons for different action item types */
function getActionIcon(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('cater') || lower.includes('food') || lower.includes('menu')) return '🍽️';
  if (lower.includes('venue') || lower.includes('location') || lower.includes('place')) return '📍';
  if (lower.includes('date') || lower.includes('time') || lower.includes('when') || lower.includes('schedule')) return '⏰';
  if (lower.includes('whatsapp') || lower.includes('call') || lower.includes('phone') || lower.includes('contact')) return '📞';
  if (lower.includes('budget') || lower.includes('price') || lower.includes('cost') || lower.includes('pay')) return '💰';
  if (lower.includes('invite') || lower.includes('attendee') || lower.includes('people') || lower.includes('guest')) return '👥';
  return '📌';
}

/** Parse action items / next-step questions from the last assistant message */
function parseActionItems(content: string): string[] {
  const items: string[] = [];
  const lines = content.split('\n');

  // Find numbered lists at the end of the message that look like questions/actions
  let foundNextSteps = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect "next steps" or "questions" heading
    if (/^(#{1,3}\s*)?(next\s*steps?|what('s| is)?\s*(next|would)|shall\s*(i|we)|questions?|would\s*you|let\s*me\s*know)/i.test(line)) {
      foundNextSteps = true;
      continue;
    }

    // After finding next steps, collect numbered/bullet items
    if (foundNextSteps) {
      const itemMatch = line.match(/^(?:\d+[\.\)]\s*|\-\s*|\*\s*)(.+)/);
      if (itemMatch) {
        const text = itemMatch[1].replace(/\*+/g, '').trim();
        if (text.length > 5 && text.length < 80) {
          items.push(text);
        }
      }
    }
  }

  // If we didn't find explicit next steps, look for questions (lines ending with ?)
  if (items.length === 0) {
    const lastFewLines = lines.slice(-10);
    for (const line of lastFewLines) {
      const trimmed = line.trim();
      if (trimmed.endsWith('?') && trimmed.length > 10 && trimmed.length < 100) {
        // Clean up markdown formatting
        const cleaned = trimmed.replace(/^(?:\d+[\.\)]\s*|\-\s*|\*\s*)/, '').replace(/\*+/g, '').trim();
        if (cleaned.length > 5) {
          items.push(cleaned);
        }
      }
    }
  }

  return items.slice(0, 4); // Max 4 items
}

export function ActionItems({ messages, onSelect }: ActionItemsProps) {
  const actionItems = useMemo(() => {
    // Find the last assistant message
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return [];

    // Check if the user has already responded after this message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') return [];

    return parseActionItems(lastAssistant.content);
  }, [messages]);

  if (actionItems.length === 0) return null;

  return (
    <div className="px-4 pb-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Next:</span>
          {actionItems.map((item, i) => (
            <button
              key={i}
              onClick={() => onSelect(item)}
              className="px-3 py-1.5 rounded-full border bg-card text-xs hover:bg-accent cursor-pointer transition-colors truncate max-w-[220px]"
              title={item}
            >
              {getActionIcon(item)} {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
