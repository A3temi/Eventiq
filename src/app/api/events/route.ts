import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listUserEvents } from '@/lib/db/events';
import type { EventSummary } from '@/types/event';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const events = await listUserEvents(session.user.email);

    const summaries: EventSummary[] = events.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status,
      lastActivity: e.updatedAt,
      pinned: e.pinned ?? false,
      summary: e.type ? `${e.type} • ${e.attendeeCount} pax` : undefined,
    }));

    // Sort: pinned first, then by lastActivity descending
    summaries.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    return NextResponse.json({ events: summaries });
  } catch (error) {
    console.error('Events API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
