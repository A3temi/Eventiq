'use client';

import { useMemo, useState } from 'react';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { EventModel, Milestone } from '@/lib/eventiq/types';

interface Props {
  events: EventModel[];
  onSelectEvent: (id: string) => void;
}

type DayItem =
  | { kind: 'event'; eventId: string; label: string }
  | { kind: 'milestone'; eventId: string; milestone: Milestone };

const categoryDot: Record<string, string> = {
  finance: 'bg-warning',
  logistics: 'bg-info',
  catering: 'bg-success',
  venue: 'bg-primary',
  communication: 'bg-pending',
  other: 'bg-muted-foreground',
};

export function CalendarPage({ events, onSelectEvent }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const list: Date[] = [];
    for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
      list.push(new Date(d));
    }
    return list;
  }, [cursor]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (d: Date, item: DayItem) => {
      const key = format(d, 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    };
    for (const e of events) {
      const eventDate = parseISO(e.date);
      if (isValid(eventDate)) {
        push(eventDate, { kind: 'event', eventId: e.id, label: e.name });
      }
      for (const m of e.milestones) {
        const milestoneDate = parseISO(m.date);
        if (isValid(milestoneDate)) {
          push(milestoneDate, { kind: 'milestone', eventId: e.id, milestone: m });
        }
      }
    }
    return map;
  }, [events]);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{format(cursor, 'MMMM yyyy')}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Milestones and event dates across all your events</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className="h-9 w-9 grid place-items-center rounded-xl border border-border hover:bg-muted"
            aria-label="Previous month"
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
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="h-9 w-9 grid place-items-center rounded-xl border border-border hover:bg-muted"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-[10px] sm:text-xs font-medium text-muted-foreground mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-1 sm:px-2 py-1 text-center sm:text-left">
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 rounded-2xl border border-border bg-card/40 p-1">
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const items = itemsByDay.get(key) ?? [];
          const outside = !isSameMonth(d, cursor);
          const today = isToday(d);
          return (
            <div
              key={key}
              className={`min-h-[64px] sm:min-h-[112px] rounded-lg sm:rounded-xl p-1 sm:p-1.5 flex flex-col gap-1 border ${
                outside ? 'bg-transparent border-transparent text-muted-foreground/60' : 'bg-background border-border/60'
              }`}
            >
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`text-[10px] sm:text-xs font-medium grid place-items-center h-5 w-5 sm:h-6 sm:w-6 rounded-full ${
                    today ? 'bg-primary text-primary-foreground' : ''
                  }`}
                >
                  {format(d, 'd')}
                </span>
              </div>
              <div className="flex-1 space-y-0.5 sm:space-y-1 overflow-hidden">
                {items.slice(0, 3).map((it, i) => {
                  if (it.kind === 'event') {
                    return (
                      <button
                        key={i}
                        onClick={() => onSelectEvent(it.eventId)}
                        className="w-full text-left text-[9px] sm:text-[11px] font-medium truncate rounded-md bg-primary-soft text-primary px-1 sm:px-1.5 py-0.5 hover:bg-primary/15"
                      >
                        <span className="sm:hidden">★</span>
                        <span className="hidden sm:inline">★ {it.label}</span>
                      </button>
                    );
                  }
                  const dot = categoryDot[it.milestone.category] ?? 'bg-muted-foreground';
                  return (
                    <button
                      key={i}
                      onClick={() => onSelectEvent(it.eventId)}
                      className="w-full text-left text-[9px] sm:text-[11px] truncate rounded-md px-1 sm:px-1.5 py-0.5 hover:bg-muted flex items-center gap-1"
                      title={it.milestone.title}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
                      <span className="truncate hidden sm:inline">{it.milestone.title}</span>
                    </button>
                  );
                })}
                {items.length > 3 && (
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground px-1 sm:px-1.5">+{items.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// keep date-fns isSameDay imported for downstream typing (unused intentionally tolerated)
void isSameDay;
