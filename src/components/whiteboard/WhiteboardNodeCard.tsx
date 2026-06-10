'use client';

import { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { CheckCircle, Clock, AlertCircle, Info, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WhiteboardNodeData } from '@/types/whiteboard';

const STATUS_ICONS = {
  pending: Clock,
  'in-progress': Clock,
  completed: CheckCircle,
  failed: AlertCircle,
  'awaiting-approval': Info,
};

const STATUS_BG = {
  green: 'border-status-success/30 bg-status-success/5',
  yellow: 'border-status-warning/30 bg-status-warning/5',
  red: 'border-status-error/30 bg-status-error/5',
  blue: 'border-status-info/30 bg-status-info/5',
};

interface Props {
  data: WhiteboardNodeData;
}

export function WhiteboardNodeCard({ data }: Props) {
  const [expanded, setExpanded] = useState(false);
  const Icon = STATUS_ICONS[data.status] || Clock;

  return (
    <div className={cn(
      'min-w-[200px] max-w-[300px] rounded-lg border-2 p-3 shadow-sm bg-card',
      STATUS_BG[data.statusColor]
    )}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      <div className="flex items-start gap-2">
        <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', {
          'text-status-success': data.statusColor === 'green',
          'text-status-warning': data.statusColor === 'yellow',
          'text-status-error': data.statusColor === 'red',
          'text-status-info': data.statusColor === 'blue',
        })} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{data.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{data.summary}</div>
        </div>
        {data.expandable && (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0">
            <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>

      {expanded && data.discussionHistory && (
        <div className="mt-2 pt-2 border-t space-y-1">
          {data.discussionHistory.map((entry, i) => (
            <div key={i} className="text-xs">
              <span className="font-medium">{entry.agent}</span>
              <span className="text-muted-foreground"> • {entry.action}</span>
              <div className="text-muted-foreground/70">{entry.outcome}</div>
            </div>
          ))}
        </div>
      )}

      {data.links && data.links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
