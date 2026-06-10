import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '@/lib/dynamodb';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await docClient.send(new GetCommand({
    TableName: TABLES.credits, // Reuse credits table for settings
    Key: { PK: `USER#${session.user.email}`, SK: 'SETTINGS' },
  }));

  return NextResponse.json({ settings: result.Item?.settings || null });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await req.json();

  await docClient.send(new PutCommand({
    TableName: TABLES.credits,
    Item: {
      PK: `USER#${session.user.email}`,
      SK: 'SETTINGS',
      settings,
      updatedAt: new Date().toISOString(),
    },
  }));

  return NextResponse.json({ success: true });
}
