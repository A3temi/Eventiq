'use client';

import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import {
  UtensilsCrossed,
  Users,
  Wallet,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ListChecks,
  MapPin,
  Phone,
  Mail,
  ImagePlus,
  Camera,
} from 'lucide-react';
import type { EventModel } from '@/lib/eventiq/types';
import { DeliveryTracker } from './DeliveryTracker';
import { vendorCategoryMeta, vendorStatusMeta, toneClasses } from '@/lib/eventiq/meta';
import { useEventModelsStore } from '@/stores/event-models-store';

interface Props {
  event: EventModel;
  onOpenVendor: (id: string) => void;
  onUpdateEvent?: (patch: Partial<EventModel>) => void;
}

/* Cover upload constraints: canvas-compress to max 1024px JPEG q0.72, reject >280KB. */
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.72;
const MAX_BYTES = 280 * 1024;

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor((base64.length * 3) / 4);
}

async function compressImage(file: File): Promise<string> {
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image'));
    image.src = sourceUrl;
  });
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height, 1));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export function OverviewTab({ event, onOpenVendor }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const patchDetails = useEventModelsStore((s) => s.patchDetails);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      if (dataUrlBytes(dataUrl) > MAX_BYTES) {
        toast.error('Image is still over 280KB after compression. Please choose a smaller image.');
        return;
      }
      await patchDetails(event.id, (details) => {
        details.coverImage = dataUrl;
      });
    } catch {
      toast.error('Could not process that image. Please try another file.');
    } finally {
      setUploading(false);
    }
  };

  const eventDate = parseISO(event.date);

  const hasDetails =
    event.venue || event.catering || event.attendees || event.budget;

  if (!hasDetails && event.vendors.length === 0) {
    return (
      <div className="flex-1 grid place-items-center p-8">
        <div className="text-center max-w-sm">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="font-semibold mb-1">No confirmed details yet</h3>
          <p className="text-sm text-muted-foreground">
            Chat with the agent to start making decisions for this event.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Cover image header */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-muted/40 h-40 sm:h-56 group">
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImage} alt={event.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Camera className="h-8 w-8" />
              <span className="text-sm font-medium">Add a picture of your event</span>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-background/90 backdrop-blur px-3 py-1.5 text-xs font-medium border border-border shadow-sm hover:bg-background disabled:opacity-60"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {uploading ? 'Uploading…' : event.coverImage ? 'Change photo' : 'Upload photo'}
        </button>
      </div>

      <DeliveryTracker event={event} />

      {/* Key Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KeyCard
          icon={<Users className="h-5 w-5 text-primary" />}
          label="Guests"
          value={event.attendees ? `${event.attendees.confirmed} / ${event.attendees.count}` : '—'}
          sub={event.attendees ? `${event.attendees.count - event.attendees.confirmed} pending` : undefined}
        />
        <KeyCard
          icon={<Wallet className="h-5 w-5 text-primary" />}
          label="Budget"
          value={event.budget ? `S$${event.budget.spent.toLocaleString()}` : '—'}
          sub={event.budget ? `of S$${event.budget.total.toLocaleString()}` : undefined}
        />
        <KeyCard
          icon={<UtensilsCrossed className="h-5 w-5 text-primary" />}
          label="Catering"
          value={event.catering ? event.catering.name : '—'}
          sub={event.catering ? (event.catering.confirmed ? 'Confirmed' : 'Pending') : undefined}
        />
      </div>

      {/* Checklist */}
      {event.milestones && event.milestones.length > 0 && (
        <div className="card-soft p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide mb-4">
            <ListChecks className="h-3.5 w-3.5" /> Checklist
          </div>
          {/* No date column: these milestones are DERIVED and all share the
              event date (shown elsewhere), so repeating it per row is noise. */}
          <ul className="space-y-2">
            {event.milestones.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 text-sm rounded-lg px-2 py-1.5 hover:bg-muted/40"
              >
                {m.status === 'done' ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : m.status === 'overdue' ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={`flex-1 ${m.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {m.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Map + Schedule side by side */}
      {(event.venue || (event.schedule && event.schedule.length > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {event.venue && (
            <div className="card-soft p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  <MapPin className="h-3.5 w-3.5" /> Location
                </div>
                <div className="text-xs text-muted-foreground truncate text-right">
                  <span className="font-medium text-foreground">{event.venue.name}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-3 truncate">{event.venue.address}</div>
              <div className="rounded-xl overflow-hidden border border-border h-80 lg:h-[28rem]">
                <iframe
                  title="Event location"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(event.venue.address)}&output=embed`}
                  className="w-full h-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          )}

          {event.schedule && event.schedule.length > 0 && (
            <div className="card-soft p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  <Clock className="h-3.5 w-3.5" /> Schedule
                </div>
                <span className="text-xs text-muted-foreground">
                  {isValid(eventDate) ? format(eventDate, 'EEEE, MMM d') : ''}
                </span>
              </div>
              <div className="divide-y divide-border lg:max-h-[28rem] lg:overflow-y-auto flex-1">
                {event.schedule.map((s, i) => (
                  <div key={i} className="grid grid-cols-[64px_1fr] gap-4 py-3 items-start">
                    <div className="text-xs font-mono text-muted-foreground pt-1">{s.time}</div>
                    <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-3 py-2">
                      <div className="text-sm font-medium">{s.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vendor contact table */}
      {event.vendors.length > 0 && (
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
              <Users className="h-3.5 w-3.5" /> Vendor contacts
            </div>
            <span className="text-xs text-muted-foreground">{event.vendors.length} vendors</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Vendor</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 font-medium">Contact</th>
                  <th className="py-2 pr-3 font-medium hidden sm:table-cell">Phone</th>
                  <th className="py-2 pr-3 font-medium hidden md:table-cell">Email</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {event.vendors.map((v) => {
                  const cat = vendorCategoryMeta[v.category];
                  const st = vendorStatusMeta[v.status];
                  return (
                    <tr
                      key={v.id}
                      onClick={() => onOpenVendor(v.id)}
                      className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer"
                    >
                      <td className="py-2 pr-3 font-medium">{v.vendorName}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{cat.label}</td>
                      <td className="py-2 pr-3">{v.contactName}</td>
                      <td className="py-2 pr-3 hidden sm:table-cell">
                        <a
                          href={`tel:${v.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                        >
                          <Phone className="h-3 w-3" /> {v.phone}
                        </a>
                      </td>
                      <td className="py-2 pr-3 hidden md:table-cell">
                        <a
                          href={`mailto:${v.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary truncate"
                        >
                          <Mail className="h-3 w-3" /> {v.email}
                        </a>
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClasses[st.tone]}`}
                        >
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KeyCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="relative card-soft p-4 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-primary/80" />
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            {label}
          </div>
          <div className="mt-0.5 text-lg font-bold truncate">{value}</div>
          {sub && (
            <div className="text-xs text-muted-foreground truncate">{sub}</div>
          )}
        </div>
      </div>
    </div>
  );
}
