'use client';

import { Users } from 'lucide-react';

interface AttendeesSectionProps {
  contacts: Array<{ name?: string; phone?: string; email?: string; status?: 'confirmed' | 'pending' | 'messaging' }>;
  totalCount: number;
}

export function AttendeesSection({ contacts, totalCount }: AttendeesSectionProps) {
  const confirmed = contacts.filter((c) => c.status === 'confirmed').length;
  const pending = contacts.length - confirmed;

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50/30 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-foreground">Attendees</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          {totalCount} people
        </span>
      </div>
      <div className="space-y-1">
        {confirmed > 0 && (
          <p className="text-xs text-green-700">
            <span className="font-medium">{confirmed}</span> confirmed
          </p>
        )}
        {pending > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{pending}</span> pending
          </p>
        )}
      </div>
      {contacts.length > 0 && contacts.length <= 6 && (
        <div className="mt-2 space-y-1">
          {contacts.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{c.status === 'confirmed' ? '✓' : c.status === 'messaging' ? '📱' : '⏳'}</span>
              <span className="truncate">{c.name || c.phone || c.email || 'Unknown'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
