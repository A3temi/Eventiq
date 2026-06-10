import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEvent } from '@/lib/db/events';
import { getConversation } from '@/lib/db/conversations';

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
      return NextResponse.json({ messages: [] });
    }

    const messages = await getConversation(id, 50);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json({ messages: [] });
  }
}
