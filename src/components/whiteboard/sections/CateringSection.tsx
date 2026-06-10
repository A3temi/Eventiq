'use client';

import { Utensils, ExternalLink } from 'lucide-react';

interface CateringSectionProps {
  catering: {
    name: string;
    url?: string;
    price?: string;
    status?: 'confirmed' | 'discussing' | 'pending';
  };
}

export function CateringSection({ catering }: CateringSectionProps) {
  const status = catering.status || 'confirmed';

  return (
    <div className={`rounded-xl border-2 p-4 shadow-sm ${borderColor(status)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Utensils className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-foreground">Catering</span>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{catering.name}</p>
        {catering.price && (
          <p className="text-xs text-muted-foreground">{catering.price}</p>
        )}
        {catering.url && (
          <a
            href={catering.url}
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
