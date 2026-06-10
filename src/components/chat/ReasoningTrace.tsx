'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReasoningStep } from '@/types/agents';

interface ReasoningTraceProps {
  steps: ReasoningStep[];
}

export function ReasoningTrace({ steps }: ReasoningTraceProps) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  const lastStep = steps[steps.length - 1];
  const allCompleted = steps.every((s) => s.status === 'completed');
  const hasFailed = steps.some((s) => s.status === 'failed');

  return (
    <div className="mt-2 border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-2 text-xs hover:bg-muted/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="font-medium">{lastStep.agentName}</span>
        <span className="text-muted-foreground">• {lastStep.action}</span>
        <span className="ml-auto">
          {hasFailed ? (
            <XCircle className="w-3 h-3 text-status-error" />
          ) : allCompleted ? (
            <CheckCircle className="w-3 h-3 text-status-success" />
          ) : (
            <Loader2 className="w-3 h-3 animate-spin text-status-info" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2 bg-muted/20">
          {steps.map((step) => (
            <div key={step.stepId} className="flex items-start gap-2 text-xs">
              <div className="mt-0.5">
                {step.status === 'completed' ? (
                  <CheckCircle className="w-3 h-3 text-status-success" />
                ) : step.status === 'failed' ? (
                  <XCircle className="w-3 h-3 text-status-error" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin text-status-info" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium">{step.action}</div>
                <div className="text-muted-foreground">{step.rationale}</div>
                {step.dataSources.length > 0 && (
                  <div className="text-muted-foreground/70 mt-0.5">
                    Sources: {step.dataSources.join(', ')}
                  </div>
                )}
                {step.duration && (
                  <span className="text-muted-foreground/50">{step.duration}s</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
