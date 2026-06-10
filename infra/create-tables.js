/**
 * Script to create all DynamoDB tables for the AI Event Organizer.
 * Run: node infra/create-tables.js
 */
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const prefix = 'eventbot';

const tables = [
  {
    TableName: `${prefix}-events`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserEventsIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: `${prefix}-conversations`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: `${prefix}-tasks`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: `${prefix}-payments`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: `${prefix}-credits`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: `${prefix}-credit-transactions`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: `${prefix}-attendees`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'qrCode', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
    GlobalSecondaryIndexes: [
      {
        IndexName: 'QRCodeIndex',
        KeySchema: [{ AttributeName: 'qrCode', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: `${prefix}-communications`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: `${prefix}-audit`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

async function tableExists(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (e) {
    if (e.name === 'ResourceNotFoundException') return false;
    throw e;
  }
}

async function main() {
  console.log('Creating DynamoDB tables...\n');

  for (const table of tables) {
    const exists = await tableExists(table.TableName);
    if (exists) {
      console.log(`  ✓ ${table.TableName} (already exists)`);
      continue;
    }

    try {
      await client.send(new CreateTableCommand(table));
      console.log(`  ✓ ${table.TableName} (created)`);
    } catch (e) {
      console.error(`  ✗ ${table.TableName}: ${e.message}`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
