'use client';

import { MapPin, ExternalLink } from 'lucide-react';

interface VenueSectionProps {
  venue: {
    name: string;
    url?: string;
    price?: string;
    status?: 'confirmed' | 'discussing' | 'pending';
  };
}

export function VenueSection({ venue }: VenueSectionProps) {
  const status = venue.status || 'confirmed';

  return (
    <div className={`rounded-xl border-2 p-4 shadow-sm ${borderColor(status)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-foreground">Venue</span>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{venue.name}</p>
        {venue.price && (
          <p className="text-xs text-muted-foreground">{venue.price}</p>
        )}
        {venue.url && (
          <a
            href={venue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            View <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function borderColor(status: string) {
  switch (status) {
    case 'confirmed': return 'border-green-200 bg-green-50/30';
    case 'discussing': return 'border-yellow-200 bg-yellow-50/30';
    default: return 'border-gray-200 bg-gray-50/30';
  }
}

function StatusPill({ status }: { status: 'confirmed' | 'discussing' | 'pending' }) {
  const config = {
    confirmed: { label: 'Confirmed ✓', className: 'bg-green-100 text-green-700' },
    discussing: { label: 'Discussing', className: 'bg-yellow-100 text-yellow-700' },
    pending: { label: 'Pending', className: 'bg-gray-100 text-gray-600' },
  };
  const { label, className } = config[status];
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${className}`}>{label}</span>;
}
