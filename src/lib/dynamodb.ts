import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

const prefix = process.env.DYNAMODB_TABLE_PREFIX || 'eventbot';

export const TABLES = {
  events: `${prefix}-events`,
  conversations: `${prefix}-conversations`,
  tasks: `${prefix}-tasks`,
  payments: `${prefix}-payments`,
  credits: `${prefix}-credits`,
  creditTransactions: `${prefix}-credit-transactions`,
  attendees: `${prefix}-attendees`,
  communications: `${prefix}-communications`,
  audit: `${prefix}-audit`,
  pages: `${prefix}-pages`,
} as const;

/** Generate a TTL 90 days from now (epoch seconds) */
export function ttl90Days(): number {
  return Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
}
