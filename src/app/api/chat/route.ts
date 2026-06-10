import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { orchestrate } from '@/agents/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Please sign in to use Eventiq', content: 'Please sign in with Google to start planning your event.' },
        { status: 401 }
      );
    }

    const { message, eventId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const result = await orchestrate({
      message,
      eventId: eventId || null,
      userId: session.user.email,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', content: 'Sorry, something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
