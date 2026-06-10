'use client';

import { Calendar } from 'lucide-react';

interface DateSectionProps {
  date?: string;
  time?: string;
}

export function DateSection({ date, time }: DateSectionProps) {
  return (
    <div className="rounded-xl border-2 border-green-200 bg-green-50/30 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-foreground">Date &amp; Time</span>
        </div>
        <StatusPill status="confirmed" />
      </div>
      <div className="space-y-1">
        {date && <p className="text-sm font-medium text-foreground">{date}</p>}
        {time && <p className="text-xs text-muted-foreground">{time}</p>}
      </div>
    </div>
  );
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
