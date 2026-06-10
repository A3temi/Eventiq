'use client';

import { useMemo, useState } from 'react';
import { Mail, Phone, Globe, Search, ChevronDown, X } from 'lucide-react';
import type { EventModel, VendorCategory } from '@/lib/eventiq/types';
import { vendorCategoryMeta, vendorStatusMeta, toneClasses } from '@/lib/eventiq/meta';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  events: EventModel[];
  onOpenEvent: (id: string) => void;
}

type Row = {
  vendorId: string;
  eventId: string;
  eventName: string;
  vendor: EventModel['vendors'][number];
};

export function ProvidersPage({ events, onOpenEvent }: Props) {
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<VendorCategory[]>([]);

  const toggleCategory = (c: VendorCategory) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    for (const e of events) {
      for (const v of e.vendors) {
        list.push({ vendorId: v.id, eventId: e.id, eventName: e.name, vendor: v });
      }
    }
    return list;
  }, [events]);

  const filtered = rows.filter((r) => {
    if (categories.length && !categories.includes(r.vendor.category)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      r.vendor.vendorName.toLowerCase().includes(q) ||
      r.vendor.contactName.toLowerCase().includes(q) ||
      r.vendor.email.toLowerCase().includes(q) ||
      r.eventName.toLowerCase().includes(q)
    );
  });

  const allCategories = Object.keys(vendorCategoryMeta) as VendorCategory[];
  const summary =
    categories.length === 0
      ? 'All categories'
      : categories.length === 1
        ? vendorCategoryMeta[categories[0]].label
        : `${categories.length} categories`;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Providers</h2>
        <p className="text-sm text-muted-foreground">All vendor contacts across your events</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search providers, contacts or events..."
            className="w-full rounded-xl bg-muted/60 pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium hover:bg-muted/40">
                <span className="text-muted-foreground">Category:</span>
                <span>{summary}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <div className="max-h-72 overflow-auto">
                {allCategories.map((c) => {
                  const checked = categories.includes(c);
                  const Icon = vendorCategoryMeta[c].icon;
                  return (
                    <button
                      key={c}
                      onClick={() => toggleCategory(c)}
                      className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted text-sm"
                    >
                      <span
                        className={`h-4 w-4 rounded border grid place-items-center ${
                          checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                        }`}
                      >
                        {checked && <span className="text-[10px] leading-none">✓</span>}
                      </span>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-left">{vendorCategoryMeta[c].label}</span>
                    </button>
                  );
                })}
              </div>
              {categories.length > 0 && (
                <div className="border-t border-border mt-2 pt-2">
                  <button
                    onClick={() => setCategories([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          {categories.length > 0 && (
            <button
              onClick={() => setCategories([])}
              className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Clear category filter"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="hidden md:grid grid-cols-12 text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-4 py-2.5 border-b border-border bg-muted/30">
          <div className="col-span-4">Provider</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-3">Event</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((r) => {
            const cat = vendorCategoryMeta[r.vendor.category];
            const Icon = cat.icon;
            const status = vendorStatusMeta[r.vendor.status];
            return (
              <div
                key={`${r.eventId}-${r.vendorId}`}
                className="grid grid-cols-1 md:grid-cols-12 md:items-center px-4 py-3 hover:bg-muted/30 transition gap-2"
              >
                <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary-soft text-primary grid place-items-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.vendor.vendorName}</div>
                    <div className="text-xs text-muted-foreground">{cat.label}</div>
                  </div>
                  <span className={`md:hidden ml-auto text-[11px] px-2 py-1 rounded-full font-medium ${toneClasses[status.tone]}`}>
                    {status.label}
                  </span>
                </div>
                <div className="md:col-span-3 min-w-0 text-xs">
                  <div className="font-medium text-foreground truncate">{r.vendor.contactName}</div>
                  <div className="flex items-center gap-3 text-muted-foreground mt-0.5">
                    <a href={`mailto:${r.vendor.email}`} className="flex items-center gap-1 hover:text-primary truncate">
                      <Mail className="h-3 w-3" /> <span className="truncate">{r.vendor.email}</span>
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground mt-0.5">
                    <a href={`tel:${r.vendor.phone}`} className="flex items-center gap-1 hover:text-primary">
                      <Phone className="h-3 w-3" /> {r.vendor.phone}
                    </a>
                    {r.vendor.website && (
                      <a href={r.vendor.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary">
                        <Globe className="h-3 w-3" /> site
                      </a>
                    )}
                  </div>
                </div>
                <div className="md:col-span-3 min-w-0">
                  <button
                    onClick={() => onOpenEvent(r.eventId)}
                    className="text-xs font-medium text-primary hover:underline truncate"
                  >
                    {r.eventName}
                  </button>
                </div>
                <div className="hidden md:flex col-span-2 justify-end">
                  <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${toneClasses[status.tone]}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No providers match your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
