'use client';

import type { VendorContact } from '@/lib/eventiq/types';
import { vendorCategoryMeta, vendorStatusMeta, toneClasses } from '@/lib/eventiq/meta';
import { Mail, Phone, Globe, Pencil, Users } from 'lucide-react';

interface Props {
  vendors: VendorContact[];
  onOpen: (id: string) => void;
}

export function VendorStrip({ vendors, onOpen }: Props) {
  return (
    <div className="card-soft p-5 animate-card-in" style={{ animationDelay: '350ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
          <Users className="h-3.5 w-3.5" /> Vendor contacts
        </div>
        <span className="text-xs text-muted-foreground">{vendors.length} vendors</span>
      </div>

      {vendors.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">
          No vendors yet — ask the agent to add one.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {vendors.map((v) => {
            const meta = vendorCategoryMeta[v.category];
            const Icon = meta.icon;
            const status = vendorStatusMeta[v.status];
            return (
              <div
                key={v.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(v.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(v.id);
                  }
                }}
                className="group relative shrink-0 w-[260px] snap-start text-left rounded-2xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 transition p-4 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary grid place-items-center">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">{meta.label}</div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClasses[status.tone]}`}
                  >
                    {status.label}
                  </span>
                </div>
                <div className="text-sm font-semibold leading-tight truncate">{v.vendorName}</div>
                <div className="text-xs text-muted-foreground truncate">{v.contactName}</div>
                <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                  <a
                    href={`tel:${v.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-7 grid place-items-center rounded-md hover:bg-primary/10 hover:text-primary"
                    aria-label="Call"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href={`mailto:${v.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-7 grid place-items-center rounded-md hover:bg-primary/10 hover:text-primary"
                    aria-label="Email"
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </a>
                  {v.website && (
                    <a
                      href={v.website}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 w-7 grid place-items-center rounded-md hover:bg-primary/10 hover:text-primary"
                      aria-label="Website"
                    >
                      <Globe className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <span className="ml-auto h-7 w-7 grid place-items-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100">
                    <Pencil className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
