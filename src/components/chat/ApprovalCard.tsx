'use client';

import { useChatStore } from '@/stores/chat-store';
import { ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { ApprovalRequest } from '@/types/chat';

interface ApprovalCardProps {
  approval: ApprovalRequest;
}

export function ApprovalCard({ approval }: ApprovalCardProps) {
  const updateApproval = useChatStore((s) => s.updateApproval);

  const handleDecision = async (decision: 'approve' | 'reject') => {
    updateApproval(approval.id, decision === 'approve' ? 'approved' : 'rejected');

    await fetch('/api/events/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, decision }),
    });
  };

  if (approval.status !== 'pending') {
    return (
      <div className="mt-2 p-3 rounded-md bg-muted/50 border text-xs">
        <span className={approval.status === 'approved' ? 'text-status-success' : 'text-status-error'}>
          {approval.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
        </span>
        <span className="text-muted-foreground ml-2">{approval.description}</span>
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-lg border-2 border-status-warning/30 bg-status-warning/5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-medium">Approval Required</div>
          <p className="text-xs text-muted-foreground mt-1">{approval.description}</p>
          
          {approval.amount && (
            <div className="text-sm font-medium mt-2">
              {formatCurrency(approval.amount, approval.currency || 'SGD')}
              {approval.recipient && <span className="text-muted-foreground"> → {approval.recipient}</span>}
            </div>
          )}

          <div className="mt-2 text-xs space-y-1">
            <div className="text-status-success">✓ Approve: {approval.consequenceApprove}</div>
            <div className="text-status-error">✗ Reject: {approval.consequenceReject}</div>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handleDecision('approve')}
              className="flex items-center gap-1 px-3 py-1.5 bg-status-success text-white rounded-md text-xs font-medium hover:bg-status-success/90 transition-colors"
            >
              <ShieldCheck className="w-3 h-3" /> Approve
            </button>
            <button
              onClick={() => handleDecision('reject')}
              className="flex items-center gap-1 px-3 py-1.5 bg-status-error text-white rounded-md text-xs font-medium hover:bg-status-error/90 transition-colors"
            >
              <ShieldX className="w-3 h-3" /> Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
