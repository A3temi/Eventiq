import { NextRequest, NextResponse } from 'next/server';
import { orchestrate } from '@/agents/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const { message, eventId, userId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const result = await orchestrate({
      message,
      eventId: eventId || null,
      userId: userId || 'demo-user', // In production, from session
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
