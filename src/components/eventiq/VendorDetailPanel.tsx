'use client';

import type { VendorContact, VendorStatus } from '@/lib/eventiq/types';
import { vendorCategoryMeta, vendorStatusMeta, toneClasses } from '@/lib/eventiq/meta';
import { findContactIndex, mapUiVendorPatchToContact } from '@/lib/eventiq/adapters';
import { useEventModelsStore } from '@/stores/event-models-store';
import { X, Phone, Mail, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

interface Props {
  eventId: string;
  vendor: VendorContact;
  onClose: () => void;
  onUpdate?: (patch: Partial<VendorContact>) => void;
}

const statusOptions: VendorStatus[] = [
  'quote_requested',
  'awaiting_confirmation',
  'deposit_paid',
  'booked',
  'delivered',
  'cancelled',
];

export function VendorDetailPanel({ eventId, vendor, onClose, onUpdate }: Props) {
  const meta = vendorCategoryMeta[vendor.category];
  const Icon = meta.icon;
  const [notes, setNotes] = useState(vendor.notes ?? '');
  const patchDetails = useEventModelsStore((s) => s.patchDetails);

  useEffect(() => setNotes(vendor.notes ?? ''), [vendor.id, vendor.notes]);

  /**
   * Persist a UI-level vendor patch onto the matching `details.contacts`
   * record (frozen `status` field mapped back + additive uiStatus/history/notes)
   * via PATCH /api/events/[id] {details}. The contact is matched by IDENTITY
   * (email/name/phone) inside the mutate callback — which patchDetails runs
   * against freshly fetched details — so the write lands on the right record
   * even if the agent inserted/removed/reordered contacts since this panel
   * was opened. If the contact no longer exists, nothing is written.
   */
  const applyPatch = (patch: Partial<VendorContact>) => {
    void patchDetails(eventId, (details) => {
      const contacts = details.contacts ?? [];
      const idx = findContactIndex(contacts, vendor);
      if (idx === -1) return;
      contacts[idx] = mapUiVendorPatchToContact(contacts[idx], patch);
      details.contacts = contacts;
    });
    onUpdate?.(patch);
  };

  const handleStatusChange = (s: VendorStatus) => {
    applyPatch({
      status: s,
      statusHistory: [...vendor.statusHistory, { status: s, timestamp: new Date().toISOString() }],
    });
  };

  return (
    <aside className="fixed md:static z-50 inset-0 md:inset-auto w-full md:w-[360px] shrink-0 border-l border-border bg-card flex flex-col h-full animate-slide-in-right">
      <header className="p-5 flex items-start gap-3 border-b border-border">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{meta.label}</div>
          <div className="font-semibold leading-tight truncate">{vendor.vendorName}</div>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <section>
          <div className="text-xs uppercase font-medium text-muted-foreground tracking-wide mb-2">
            Contact
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="font-medium">{vendor.contactName}</div>
            <a href={`tel:${vendor.phone}`} className="block text-muted-foreground hover:text-primary">
              {vendor.phone}
            </a>
            <a href={`mailto:${vendor.email}`} className="block text-muted-foreground hover:text-primary truncate">
              {vendor.email}
            </a>
            {vendor.website && (
              <a
                href={vendor.website}
                target="_blank"
                rel="noreferrer"
                className="block text-muted-foreground hover:text-primary truncate"
              >
                {vendor.website}
              </a>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <a
              href={`tel:${vendor.phone}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium hover:bg-muted"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
            <a
              href={`mailto:${vendor.email}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium hover:bg-muted"
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </a>
            {vendor.website && (
              <a
                href={vendor.website}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium hover:bg-muted"
              >
                <Globe className="h-3.5 w-3.5" /> Site
              </a>
            )}
          </div>
        </section>

        <section>
          <div className="text-xs uppercase font-medium text-muted-foreground tracking-wide mb-2">
            Status
          </div>
          <select
            value={vendor.status}
            onChange={(e) => handleStatusChange(e.target.value as VendorStatus)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {vendorStatusMeta[s].label}
              </option>
            ))}
          </select>
          <div className="mt-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClasses[vendorStatusMeta[vendor.status].tone]}`}
            >
              Current: {vendorStatusMeta[vendor.status].label}
            </span>
          </div>
        </section>

        <section>
          <div className="text-xs uppercase font-medium text-muted-foreground tracking-wide mb-2">
            Notes
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => applyPatch({ notes })}
            placeholder="Add notes..."
            rows={4}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none resize-none"
          />
        </section>

        <section>
          <div className="text-xs uppercase font-medium text-muted-foreground tracking-wide mb-2">
            Activity log
          </div>
          <ol className="space-y-2.5 text-sm">
            {[...vendor.statusHistory].reverse().map((h, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 mt-1.5 rounded-full bg-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div>Status changed to <strong className="font-medium">{vendorStatusMeta[h.status].label}</strong></div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(h.timestamp), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </aside>
  );
}
