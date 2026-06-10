'use client';

import { useAppStore } from '@/stores/app-store';
import { Plus, Calendar, Circle } from 'lucide-react';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import type { EventStatus } from '@/types/event';

const STATUS_COLORS: Record<EventStatus, string> = {
  draft: 'text-muted-foreground',
  planning: 'text-status-info',
  confirmed: 'text-status-success',
  'in-progress': 'text-status-warning',
  completed: 'text-status-success',
};

export function EventSidebar() {
  const { events, activeEventId, setActiveEvent } = useAppStore();
  const credits = useAppStore((s) => s.credits);

  return (
    <aside className="w-72 border-r bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-lg">Events</h1>
          <button
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Create new event"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {credits && (
          <div className="mt-2 text-xs text-muted-foreground">
            Credits: <span className="font-medium text-foreground">{credits.balance}</span>
          </div>
        )}
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {events.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No events yet. Start by describing your event in the chat.
          </div>
        ) : (
          events.map((event) => (
            <button
              key={event.id}
              onClick={() => setActiveEvent(event.id)}
              className={cn(
                'w-full text-left p-3 rounded-lg transition-colors',
                activeEventId === event.id
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-accent'
              )}
            >
              <div className="flex items-center gap-2">
                <Circle className={cn('w-2 h-2 fill-current', STATUS_COLORS[event.status])} />
                <span className="font-medium text-sm truncate">{event.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{event.date ? formatDate(event.date) : 'No date'}</span>
                <span className="ml-auto">{timeAgo(event.lastActivity)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t text-xs text-muted-foreground text-center">
        Eventiq • Singapore
      </div>
    </aside>
  );
}
