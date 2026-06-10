'use client';

import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { format, parseISO, isValid, isWithinInterval } from 'date-fns';
import { Plus, Pin, Users, Wallet, Filter, X, ChevronDown, Camera, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { EventModel, EventType } from '@/lib/eventiq/types';
import { eventStatusMeta, eventTypeMeta } from '@/lib/eventiq/meta';
import { useAppStore } from '@/stores/app-store';

interface Props {
  events: EventModel[];
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function MyEventsPage({ events, onSelect, onNew }: Props) {
  const [types, setTypes] = useState<EventType[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const pinEvent = useAppStore((s) => s.pinEvent);
  const deleteEvent = useAppStore((s) => s.deleteEvent);

  const toggleType = (t: EventType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const filtered = useMemo(() => {
    const list = events.filter((e) => {
      if (types.length && (!e.type || !types.includes(e.type))) return false;
      if (from || to) {
        const d = parseISO(e.date);
        const start = from ? parseISO(from) : new Date(-8640000000000000);
        const end = to ? parseISO(to) : new Date(8640000000000000);
        if (!isWithinInterval(d, { start, end })) return false;
      }
      return true;
    });
    const time = (e: EventModel) => {
      const t = parseISO(e.date).getTime();
      return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
    };
    return list.sort((a, b) => time(a) - time(b));
  }, [events, types, from, to]);

  const clearFilters = () => {
    setTypes([]);
    setFrom('');
    setTo('');
  };
  const hasFilters = types.length > 0 || from || to;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">My events</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {events.length} {events.length === 1 ? 'event' : 'events'}
          </p>
        </div>
        <button
          onClick={onNew}
          className="shrink-0 rounded-xl bg-primary text-primary-foreground text-sm font-medium px-3.5 py-2 flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New event</span>
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-3 mb-5 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1">
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted/40">
                <span className="text-muted-foreground">Type:</span>
                <span>
                  {types.length === 0
                    ? 'All types'
                    : types.length === 1
                      ? eventTypeMeta[types[0]].label
                      : `${types.length} types`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="max-h-72 overflow-auto">
                {(Object.keys(eventTypeMeta) as EventType[]).map((t) => {
                  const checked = types.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted text-sm"
                    >
                      <span
                        className={`h-4 w-4 rounded border grid place-items-center ${
                          checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                        }`}
                      >
                        {checked && <span className="text-[10px] leading-none">✓</span>}
                      </span>
                      <span className="flex-1 text-left">{eventTypeMeta[t].label}</span>
                    </button>
                  );
                })}
              </div>
              {types.length > 0 && (
                <div className="border-t border-border mt-2 pt-2">
                  <button
                    onClick={() => setTypes([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg bg-muted/60 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/30"
            />
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg bg-muted/60 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Clear filters"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((evt) => {
          const meta = eventStatusMeta[evt.status];
          const eventDate = parseISO(evt.date);
          const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(evt.id);
            }
          };
          return (
            <div
              key={evt.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(evt.id)}
              onKeyDown={handleKeyDown}
              className="text-left rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-sm transition group cursor-pointer"
            >
              <div className="relative h-28 w-full bg-muted/40 overflow-hidden">
                {evt.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={evt.coverImage} alt={evt.name} className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-primary/10 to-muted grid place-items-center">
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Camera className="h-6 w-6" />
                      <span className="text-[11px] font-medium">Add a picture</span>
                    </div>
                  </div>
                )}
                {/* Always visible below sm: — touch devices have no hover, and the
                    first tap would fire the card's onSelect before hover exists. */}
                <div className="absolute top-2 right-2 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void pinEvent(evt.id);
                    }}
                    className="h-7 w-7 grid place-items-center rounded-lg border border-border bg-background/80 backdrop-blur shadow-sm text-muted-foreground hover:text-primary hover:bg-background"
                    aria-label={evt.pinned ? 'Unpin event' : 'Pin event'}
                    title={evt.pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin className={`h-3.5 w-3.5 ${evt.pinned ? 'text-primary fill-primary' : ''}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${evt.name}"? This cannot be undone.`)) {
                        void deleteEvent(evt.id);
                      }
                    }}
                    className="h-7 w-7 grid place-items-center rounded-lg border border-border bg-background/80 backdrop-blur shadow-sm text-muted-foreground hover:text-destructive hover:bg-background"
                    aria-label="Delete event"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {evt.pinned && <Pin className="h-3 w-3 text-primary fill-primary" />}
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    {evt.type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {eventTypeMeta[evt.type].label}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{evt.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isValid(eventDate) ? format(eventDate, 'EEE, MMM d, yyyy') : 'No date yet'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat icon={<Users className="h-3.5 w-3.5" />} label="Guests" value={evt.attendees ? `${evt.attendees.confirmed}/${evt.attendees.count}` : '—'} />
                <Stat icon={<Wallet className="h-3.5 w-3.5" />} label="Budget" value={evt.budget ? `S$${(evt.budget.committed / 1000).toFixed(1)}k` : '—'} />
                <Stat label="Vendors" value={`${evt.vendors.length}`} />
              </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-sm text-muted-foreground">
            {events.length === 0
              ? <>No events yet. Click <span className="font-medium text-foreground">New event</span> to start.</>
              : 'No events match your filters.'}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
      <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="font-semibold text-sm mt-0.5 truncate">{value}</div>
    </div>
  );
}
