import type { ApprovalRequest } from '@/types/chat';
import { v4 as uuid } from 'uuid';

// In-memory approval store (in production, this would be in DynamoDB)
const pendingApprovals = new Map<string, ApprovalRequest & { resolver?: (decision: 'approve' | 'reject') => void }>();

export function createApprovalRequest(params: {
  actionType: ApprovalRequest['actionType'];
  amount?: number;
  currency?: string;
  recipient?: string;
  description: string;
  consequenceApprove: string;
  consequenceReject: string;
}): ApprovalRequest {
  const approval: ApprovalRequest = {
    id: uuid(),
    ...params,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  pendingApprovals.set(approval.id, approval);
  return approval;
}

export async function waitForApproval(approvalId: string, timeoutMs = 86400000): Promise<'approve' | 'reject'> {
  // In production: WebSocket-based real-time approval
  // For now: poll or immediate return for demo
  return new Promise((resolve) => {
    const entry = pendingApprovals.get(approvalId);
    if (entry) {
      entry.resolver = resolve;
    }
    // Auto-timeout after 24h (in production, send reminder)
    setTimeout(() => resolve('reject'), timeoutMs);
  });
}

export function resolveApproval(approvalId: string, decision: 'approve' | 'reject'): boolean {
  const entry = pendingApprovals.get(approvalId);
  if (!entry) return false;

  entry.status = decision === 'approve' ? 'approved' : 'rejected';
  if (entry.resolver) {
    entry.resolver(decision);
  }
  return true;
}

export function getPendingApprovals(): ApprovalRequest[] {
  return Array.from(pendingApprovals.values())
    .filter((a) => a.status === 'pending')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function checkBudgetApproval(amount: number): boolean {
  return amount > 50; // Require approval for payments > 50 SGD
}
