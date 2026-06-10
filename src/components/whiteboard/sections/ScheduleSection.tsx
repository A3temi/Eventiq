'use client';

import { Clock } from 'lucide-react';

interface ScheduleSectionProps {
  items: Array<{
    time: string;
    title: string;
    speaker?: string;
    status?: 'confirmed' | 'discussing' | 'pending';
  }>;
}

export function ScheduleSection({ items }: ScheduleSectionProps) {
  return (
    <div className="rounded-xl border-2 border-green-200 bg-green-50/30 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-foreground">Schedule</span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 ml-auto">
          {items.length} items
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-green-200/50">
              <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground w-20">Time</th>
              <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Title</th>
              <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground w-24">Speaker</th>
              <th className="text-right py-1.5 font-medium text-muted-foreground w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-green-100/50 last:border-0">
                <td className="py-2 pr-4 font-mono text-muted-foreground whitespace-nowrap">
                  {item.time}
                </td>
                <td className="py-2 pr-4 text-foreground font-medium">
                  {item.title}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {item.speaker || '—'}
                </td>
                <td className="py-2 text-right">
                  <StatusPill status={item.status || 'pending'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${className}`}>{label}</span>;
}
