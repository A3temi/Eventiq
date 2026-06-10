import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../dynamodb';
import type { CreditBalance } from '@/types/payment';
import { v4 as uuid } from 'uuid';

export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.credits,
    Key: { PK: `USER#${userId}`, SK: 'CREDITS' },
  }));

  if (!result.Item) {
    // Initialize credit balance for new user
    const initial: CreditBalance = {
      userId,
      balance: 0,
      totalPurchased: 0,
      totalUsed: 0,
      lastUpdated: new Date().toISOString(),
    };
    await docClient.send(new PutCommand({
      TableName: TABLES.credits,
      Item: { PK: `USER#${userId}`, SK: 'CREDITS', ...initial },
    }));
    return initial;
  }

  const { PK, SK, ...balance } = result.Item;
  return balance as CreditBalance;
}

export async function addCredits(userId: string, amount: number, stripeSessionId: string): Promise<CreditBalance> {
  const now = new Date().toISOString();

  await docClient.send(new UpdateCommand({
    TableName: TABLES.credits,
    Key: { PK: `USER#${userId}`, SK: 'CREDITS' },
    UpdateExpression: 'SET balance = balance + :amount, totalPurchased = totalPurchased + :amount, lastUpdated = :now',
    ExpressionAttributeValues: { ':amount': amount, ':now': now },
  }));

  // Log transaction
  await docClient.send(new PutCommand({
    TableName: TABLES.creditTransactions,
    Item: {
      PK: `USER#${userId}`,
      SK: `CRTX#${now}#${uuid()}`,
      type: 'purchase',
      amount,
      operation: 'credit_purchase',
      stripeSessionId,
      timestamp: now,
    },
  }));

  return getCreditBalance(userId);
}

export async function deductCredits(
  userId: string,
  amount: number,
  operation: string,
  eventId?: string
): Promise<{ success: boolean; balance: CreditBalance }> {
  const current = await getCreditBalance(userId);

  if (current.balance < amount) {
    return { success: false, balance: current };
  }

  const now = new Date().toISOString();

  await docClient.send(new UpdateCommand({
    TableName: TABLES.credits,
    Key: { PK: `USER#${userId}`, SK: 'CREDITS' },
    UpdateExpression: 'SET balance = balance - :amount, totalUsed = totalUsed + :amount, lastUpdated = :now',
    ConditionExpression: 'balance >= :amount',
    ExpressionAttributeValues: { ':amount': amount, ':now': now },
  }));

  // Log transaction
  await docClient.send(new PutCommand({
    TableName: TABLES.creditTransactions,
    Item: {
      PK: `USER#${userId}`,
      SK: `CRTX#${now}#${uuid()}`,
      type: 'deduction',
      amount,
      operation,
      eventId,
      timestamp: now,
    },
  }));

  return { success: true, balance: await getCreditBalance(userId) };
}
