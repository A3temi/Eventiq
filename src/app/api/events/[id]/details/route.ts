import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEvent } from '@/lib/db/events';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const event = await getEvent(id);
    if (!event || event.userId !== session.user.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      details: event.details || {},
      name: event.name,
      status: event.status,
      attendeeCount: event.attendeeCount,
      date: event.date,
    });
  } catch (error) {
    console.error('Get event details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
