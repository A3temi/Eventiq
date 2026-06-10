import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEvent, updateEvent } from '@/lib/db/events';
import { deleteEvent } from '@/lib/db/events';
import { parseEventStatusForWrite } from '@/lib/event-status';

export async function DELETE(
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

    await deleteEvent(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
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

    const body = await req.json();
    const allowedFields = ['name', 'pinned', 'status', 'date', 'attendeeCount', 'type', 'location', 'details'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        if (field === 'status') {
          const status = parseEventStatusForWrite(body[field]);
          if (!status) {
            return NextResponse.json({ error: 'Invalid event status' }, { status: 400 });
          }
          updates[field] = status;
        } else {
          updates[field] = body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await updateEvent(id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Patch event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
