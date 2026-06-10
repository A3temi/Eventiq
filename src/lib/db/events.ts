import { PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES, ttl90Days } from '../dynamodb';
import type { EventBrief, EventStatus } from '@/types/event';
import { v4 as uuid } from 'uuid';

export async function createEvent(userId: string, data: Partial<EventBrief>): Promise<EventBrief> {
  const now = new Date().toISOString();
  const event: EventBrief = {
    id: uuid(),
    userId,
    name: data.name || 'Untitled Event',
    type: data.type || '',
    date: data.date || '',
    endDate: data.endDate,
    attendeeCount: data.attendeeCount || 0,
    budget: data.budget || { total: 0, currency: 'SGD', categories: [] },
    location: data.location,
    preferences: data.preferences || {},
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.events,
    Item: {
      PK: `EVENT#${event.id}`,
      SK: 'METADATA',
      ...event,
      ttl: ttl90Days(),
    },
  }));

  return event;
}

export async function getEvent(eventId: string): Promise<EventBrief | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.events,
    Key: { PK: `EVENT#${eventId}`, SK: 'METADATA' },
  }));

  if (!result.Item) return null;
  const { PK, SK, ttl, ...event } = result.Item;
  return event as EventBrief;
}

export async function updateEvent(eventId: string, updates: Partial<EventBrief>): Promise<void> {
  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (key === 'id' || key === 'userId') return;
    const attrName = `#${key}`;
    const attrValue = `:${key}`;
    expressions.push(`${attrName} = ${attrValue}`);
    names[attrName] = key;
    values[attrValue] = value;
  });

  expressions.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  await docClient.send(new UpdateCommand({
    TableName: TABLES.events,
    Key: { PK: `EVENT#${eventId}`, SK: 'METADATA' },
    UpdateExpression: `SET ${expressions.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export async function listUserEvents(userId: string): Promise<EventBrief[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.events,
    IndexName: 'UserEventsIndex',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false,
  }));

  return (result.Items || []).map(({ PK, SK, ttl, ...item }) => item as EventBrief);
}

export async function updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
  await updateEvent(eventId, { status });
}

export async function deleteEvent(eventId: string): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: TABLES.events,
    Key: { PK: `EVENT#${eventId}`, SK: 'METADATA' },
  }));
}
