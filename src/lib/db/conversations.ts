import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES, ttl90Days } from '../dynamodb';
import type { ChatMessage } from '@/types/chat';
import { v4 as uuid } from 'uuid';

export async function saveMessage(eventId: string, message: ChatMessage): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLES.conversations,
    Item: {
      PK: `EVENT#${eventId}`,
      SK: `MSG#${message.timestamp}#${message.id}`,
      ...message,
      ttl: ttl90Days(),
    },
  }));
}

export async function createMessage(
  eventId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: ChatMessage['metadata']
): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: uuid(),
    role,
    content,
    timestamp: new Date().toISOString(),
    metadata,
  };

  await saveMessage(eventId, message);
  return message;
}

export async function getConversation(
  eventId: string,
  limit = 50
): Promise<ChatMessage[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.conversations,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}`,
      ':prefix': 'MSG#',
    },
    ScanIndexForward: true,
    Limit: limit,
  }));

  return (result.Items || []).map(({ PK, SK, ttl, ...item }) => item as ChatMessage);
}

export async function getRecentMessages(
  eventId: string,
  count = 20
): Promise<ChatMessage[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.conversations,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}`,
      ':prefix': 'MSG#',
    },
    ScanIndexForward: false,
    Limit: count,
  }));

  return (result.Items || []).map(({ PK, SK, ttl, ...item }) => item as ChatMessage).reverse();
}
