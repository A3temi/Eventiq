'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import { Plus, Calendar, Circle, Pin, Trash2, MoreHorizontal } from 'lucide-react';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { UserMenu } from './UserMenu';
import type { EventStatus } from '@/types/event';

const STATUS_COLORS: Record<EventStatus, string> = {
  draft: 'text-muted-foreground',
  planning: 'text-blue-500',
  confirmed: 'text-green-500',
  'in-progress': 'text-yellow-500',
  completed: 'text-green-500',
};

function SkeletonEvent() {
  return (
    <div className="p-3 rounded-lg animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
        <div className="h-4 bg-muted-foreground/20 rounded w-3/4" />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="h-3 bg-muted-foreground/10 rounded w-1/3" />
        <div className="h-3 bg-muted-foreground/10 rounded w-1/4 ml-auto" />
      </div>
    </div>
  );
}

export function EventSidebar() {
  const { data: session } = useSession();
  const { events, activeEventId, setActiveEvent, eventsLoading, fetchEvents, deleteEvent, pinEvent } = useAppStore();
  const clearMessages = useChatStore((s) => s.clearMessages);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Fetch events on mount when user is authenticated
  useEffect(() => {
    if (session?.user?.email) {
      fetchEvents();
    }
  }, [session, fetchEvents]);

  const handleNewEvent = () => {
    setActiveEvent(null);
    clearMessages();
  };

  const handleDelete = async (id: string) => {
    await deleteEvent(id);
    setConfirmDeleteId(null);
    setMenuOpenId(null);
  };

  const handlePin = async (id: string) => {
    await pinEvent(id);
    setMenuOpenId(null);
  };

  return (
    <aside className="w-72 border-r bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">E</span>
            </div>
            <h1 className="font-semibold text-lg">Eventiq</h1>
          </div>
          <button
            onClick={handleNewEvent}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Create new event"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {eventsLoading ? (
          <>
            <SkeletonEvent />
            <SkeletonEvent />
            <SkeletonEvent />
          </>
        ) : events.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No events yet. Start by describing your event in the chat.
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="relative group">
              <button
                onClick={() => {
                  setActiveEvent(event.id);
                  clearMessages();
                }}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-colors',
                  activeEventId === event.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-accent'
                )}
              >
                <div className="flex items-center gap-2">
                  {event.pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                  <Circle className={cn('w-2 h-2 fill-current shrink-0', STATUS_COLORS[event.status])} />
                  <span className="font-medium text-sm truncate">{event.name}</span>
                </div>
                {event.summary && (
                  <p className="text-xs text-muted-foreground mt-1 truncate pl-4">
                    {event.summary}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground pl-4">
                  <Calendar className="w-3 h-3" />
                  <span>{event.date ? formatDate(event.date) : 'No date'}</span>
                  <span className="ml-auto">{timeAgo(event.lastActivity)}</span>
                </div>
              </button>

              {/* Context menu trigger */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === event.id ? null : event.id);
                }}
                className={cn(
                  'absolute top-2 right-2 p-1 rounded-md transition-opacity',
                  'opacity-0 group-hover:opacity-100 hover:bg-accent',
                  menuOpenId === event.id && 'opacity-100'
                )}
                aria-label="Event menu"
              >
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Dropdown menu */}
              {menuOpenId === event.id && (
                <div className="absolute top-8 right-2 z-50 bg-popover border rounded-lg shadow-md py-1 min-w-[120px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePin(event.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  >
                    <Pin className="w-3 h-3" />
                    {event.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(event.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              )}

              {/* Delete confirmation */}
              {confirmDeleteId === event.id && (
                <div className="absolute top-8 right-2 z-50 bg-popover border rounded-lg shadow-md p-3 min-w-[180px]">
                  <p className="text-xs font-medium mb-2">Delete this event?</p>
                  <p className="text-xs text-muted-foreground mb-3">This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(null);
                        setMenuOpenId(null);
                      }}
                      className="flex-1 px-2 py-1 text-xs rounded border hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(event.id);
                      }}
                      className="flex-1 px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* User Menu (bottom) */}
      <UserMenu />
    </aside>
  );
}
