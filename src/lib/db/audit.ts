import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../dynamodb';
import { v4 as uuid } from 'uuid';

export interface AuditEntry {
  id: string;
  eventId: string;
  agentName: string;
  operation: string;
  errorType?: string;
  errorMessage?: string;
  retryTimestamps: string[];
  resolution: 'pending' | 'resolved-auto' | 'resolved-manual' | 'abandoned';
  timestamp: string;
}

export async function logAudit(
  eventId: string,
  data: Omit<AuditEntry, 'id' | 'eventId' | 'timestamp'>
): Promise<AuditEntry> {
  const now = new Date().toISOString();
  const entry: AuditEntry = {
    ...data,
    id: uuid(),
    eventId,
    timestamp: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.audit,
    Item: {
      PK: `EVENT#${eventId}`,
      SK: `AUDIT#${now}#${entry.id}`,
      ...entry,
    },
  }));

  return entry;
}

export async function getEventAuditLog(eventId: string): Promise<AuditEntry[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.audit,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}`,
      ':prefix': 'AUDIT#',
    },
    ScanIndexForward: true,
  }));

  return (result.Items || []).map(({ PK, SK, ...item }) => item as AuditEntry);
}
