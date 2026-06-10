import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveApproval } from '@/agents/orchestrator/approval';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { approvalId, decision } = await req.json();

    if (!approvalId || !['approve', 'reject'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const resolved = resolveApproval(approvalId, decision);

    if (!resolved) {
      return NextResponse.json({ error: 'Approval not found or already resolved' }, { status: 404 });
    }

    return NextResponse.json({ success: true, decision });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
