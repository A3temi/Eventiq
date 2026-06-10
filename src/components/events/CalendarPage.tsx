'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { EventSummary, EventStatus } from '@/types/event';

interface Props {
  events: EventSummary[];
  onSelectEvent: (id: string) => void;
}

const STATUS_COLORS: Record<EventStatus, string> = {
  draft: 'bg-muted-foreground',
  planning: 'bg-blue-500',
  confirmed: 'bg-status-success',
  'in-progress': 'bg-status-warning',
  completed: 'bg-status-success',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function getDaysInView(cursor: Date): Date[] {
  const start = startOfMonth(cursor);
  // Get Monday of the first week
  const dayOfWeek = start.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const viewStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + mondayOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) { // 6 weeks
    days.push(new Date(viewStart.getFullYear(), viewStart.getMonth(), viewStart.getDate() + i));
  }
  return days;
}

export function CalendarPage({ events, onSelectEvent }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => getDaysInView(cursor), [cursor]);

  // Map event dates
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventSummary[]>();
    for (const evt of events) {
      if (!evt.date) continue;
      const d = new Date(evt.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) || [];
      arr.push(evt);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(c => addMonths(c, -1))}
            className="h-9 w-9 grid place-items-center rounded-xl border border-border hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="h-9 px-3 rounded-xl border border-border hover:bg-muted text-sm font-medium"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(c => addMonths(c, 1))}
            className="h-9 w-9 grid place-items-center rounded-xl border border-border hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground mb-2">
        {DAYS.map(d => (
          <div key={d} className="px-2 py-1 text-center">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 rounded-2xl border border-border bg-card/40 p-1">
        {days.map((d, i) => {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const dayEvents = eventsByDate.get(key) || [];
          const outside = !isSameMonth(d, cursor);
          const today = isToday(d);

          return (
            <div
              key={i}
              className={cn(
                'min-h-[80px] sm:min-h-[100px] rounded-xl p-1.5 flex flex-col gap-1 border',
                outside ? 'bg-transparent border-transparent text-muted-foreground/40' : 'bg-background border-border/40'
              )}
            >
              <span className={cn(
                'text-xs font-medium h-6 w-6 grid place-items-center rounded-full mx-auto',
                today && 'bg-primary text-primary-foreground'
              )}>
                {d.getDate()}
              </span>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 2).map(evt => (
                  <button
                    key={evt.id}
                    onClick={() => onSelectEvent(evt.id)}
                    className="w-full text-left text-[10px] font-medium truncate rounded-md bg-accent text-accent-foreground px-1.5 py-0.5 hover:bg-primary/15 transition flex items-center gap-1"
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_COLORS[evt.status])} />
                    <span className="truncate">{evt.name}</span>
                  </button>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[10px] text-muted-foreground px-1.5">+{dayEvents.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
