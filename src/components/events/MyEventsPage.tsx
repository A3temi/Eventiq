'use client';

import { Plus, Calendar, Users, Wallet, Camera, Pin } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { EventSummary, EventStatus } from '@/types/event';

interface Props {
  events: EventSummary[];
  onSelect: (id: string) => void;
  onNew: () => void;
}

const STATUS_META: Record<EventStatus, { label: string; dot: string }> = {
  draft: { label: 'Draft', dot: 'bg-muted-foreground' },
  planning: { label: 'Planning', dot: 'bg-blue-500' },
  confirmed: { label: 'Confirmed', dot: 'bg-status-success' },
  'in-progress': { label: 'In progress', dot: 'bg-status-warning' },
  completed: { label: 'Completed', dot: 'bg-status-success' },
};

export function MyEventsPage({ events, onSelect, onNew }: Props) {
  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">My events</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </p>
        </div>
        <button
          onClick={onNew}
          className="shrink-0 rounded-xl bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition"
        >
          <Plus className="h-4 w-4" /> New event
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="font-semibold mb-1">No events yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Click <span className="font-medium text-foreground">New event</span> to start planning with the AI agent.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((evt) => {
            const meta = STATUS_META[evt.status] || STATUS_META.draft;
            return (
              <button
                key={evt.id}
                onClick={() => onSelect(evt.id)}
                className="text-left rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-sm transition group animate-card-in"
              >
                {/* Cover image placeholder */}
                <div className="h-32 w-full bg-muted/40 overflow-hidden grid place-items-center border-b border-border/50">
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <Camera className="h-6 w-6" />
                    <span className="text-[11px] font-medium">Add a picture</span>
                  </div>
                </div>

                <div className="p-4">
                  {/* Status + type badges */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {evt.pinned && <Pin className="h-3 w-3 text-primary fill-primary" />}
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                      {meta.label}
                    </span>
                    {evt.summary && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {evt.summary.split('•')[0]?.trim()}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                    {evt.name}
                  </h3>

                  {/* Date */}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {evt.date ? formatDate(evt.date) : 'No date set'}
                  </p>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                      <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wide">
                        <Users className="h-3 w-3" /> Guests
                      </div>
                      <div className="font-semibold text-sm mt-0.5">
                        {evt.summary?.match(/(\d+)\s*pax/)?.[1] || '—'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                      <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wide">
                        <Wallet className="h-3 w-3" /> Budget
                      </div>
                      <div className="font-semibold text-sm mt-0.5">—</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                      <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Vendors
                      </div>
                      <div className="font-semibold text-sm mt-0.5">0</div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
