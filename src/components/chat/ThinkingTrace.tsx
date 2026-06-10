'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, ExternalLink, Search, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThinkingStep } from '@/types/chat';

interface ThinkingTraceProps {
  steps: ThinkingStep[];
}

const TOOL_LABELS: Record<string, string> = {
  search_venues: 'Searched venues',
  search_vendors: 'Searched vendors',
  search_catering: 'Searched catering',
  web_search: 'Researched online',
  send_whatsapp: 'Sent WhatsApp message',
  send_email: 'Sent email',
  get_current_datetime: 'Checked date/time',
  create_schedule: 'Built schedule',
  get_budget_summary: 'Analyzed budget',
};

export function ThinkingTrace({ steps }: ThinkingTraceProps) {
  const [expanded, setExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

  const completedCount = steps.filter((s) => s.status === 'completed').length;

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors bg-muted/30"
      >
        <Brain className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium text-muted-foreground">
          {expanded ? 'Hide' : 'Show'} thinking
        </span>
        <span className="text-muted-foreground/70">
          • {completedCount} step{completedCount !== 1 ? 's' : ''}
        </span>
        <span className="ml-auto">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 space-y-2 bg-muted/20">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              <div className="mt-0.5 shrink-0">
                {step.status === 'completed' ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">
                  {TOOL_LABELS[step.tool] || step.tool}
                </div>
                {step.query && (
                  <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                    <Search className="w-3 h-3 shrink-0" />
                    <span className="font-mono text-[10px] truncate">{step.query}</span>
                  </div>
                )}
                {step.source && (
                  <div className="text-muted-foreground/70 mt-0.5">
                    via {step.source}
                  </div>
                )}
                {step.url && (
                  <a
                    href={step.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-1 mt-0.5',
                      'text-primary/70 hover:text-primary transition-colors'
                    )}
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="truncate max-w-[200px]">{step.url}</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
