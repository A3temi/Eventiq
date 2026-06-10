import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../dynamodb';
import type { PaymentRecord } from '@/types/payment';
import { v4 as uuid } from 'uuid';

export async function recordPayment(payment: Omit<PaymentRecord, 'transactionId' | 'timestamp'>): Promise<PaymentRecord> {
  const now = new Date().toISOString();
  const record: PaymentRecord = {
    ...payment,
    transactionId: uuid(),
    timestamp: now,
  };

  const pk = payment.type === 'credits'
    ? `USER#${payment.recipient}`
    : `EVENT#${payment.eventId}`;

  await docClient.send(new PutCommand({
    TableName: TABLES.payments,
    Item: {
      PK: pk,
      SK: `PAY#${now}#${record.transactionId}`,
      ...record,
    },
  }));

  return record;
}

export async function getEventPayments(eventId: string): Promise<PaymentRecord[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.payments,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}`,
      ':prefix': 'PAY#',
    },
    ScanIndexForward: true,
  }));

  return (result.Items || []).map(({ PK, SK, ...item }) => item as PaymentRecord);
}

export async function updatePaymentStatus(
  eventId: string,
  transactionId: string,
  timestamp: string,
  status: PaymentRecord['status']
): Promise<void> {
  const pk = `EVENT#${eventId}`;
  const sk = `PAY#${timestamp}#${transactionId}`;

  await docClient.send(new UpdateCommand({
    TableName: TABLES.payments,
    Key: { PK: pk, SK: sk },
    UpdateExpression: 'SET #status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': status },
  }));
}
