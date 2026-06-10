import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../dynamodb';
import type { CommunicationLog } from '@/types/communication';
import { v4 as uuid } from 'uuid';

export async function logCommunication(
  eventId: string,
  data: Omit<CommunicationLog, 'id' | 'eventId' | 'timestamp'>
): Promise<CommunicationLog> {
  const now = new Date().toISOString();
  const log: CommunicationLog = {
    ...data,
    id: uuid(),
    eventId,
    timestamp: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.communications,
    Item: {
      PK: `EVENT#${eventId}`,
      SK: `COMM#${now}#${log.id}`,
      ...log,
    },
  }));

  return log;
}

export async function getEventCommunications(eventId: string): Promise<CommunicationLog[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.communications,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}`,
      ':prefix': 'COMM#',
    },
    ScanIndexForward: true,
  }));

  return (result.Items || []).map(({ PK, SK, ...item }) => item as CommunicationLog);
}
