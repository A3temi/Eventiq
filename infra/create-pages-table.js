/**
 * Creates the eventbot-pages DynamoDB table in us-east-1.
 * Run: node infra/create-pages-table.js
 *
 * Schema:
 *   PK: PAGE#<pageId>
 *   SK: CONFIG | SUB#<timestamp>#<submissionId>
 *
 * GSI: EventPagesIndex
 *   GSI1PK: EVENT#<eventId>
 *   GSI1SK: PAGE#<createdAt>
 */
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const prefix = 'eventbot';

const tableName = `${prefix}-pages`;

const tableDefinition = {
  TableName: tableName,
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'GSI1PK', AttributeType: 'S' },
    { AttributeName: 'GSI1SK', AttributeType: 'S' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
  GlobalSecondaryIndexes: [
    {
      IndexName: 'EventPagesIndex',
      KeySchema: [
        { AttributeName: 'GSI1PK', KeyType: 'HASH' },
        { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
  TimeToLiveSpecification: {
    AttributeName: 'ttl',
    Enabled: true,
  },
};

async function main() {
  console.log(`Creating DynamoDB table: ${tableName}...\n`);

  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`  ✓ ${tableName} (already exists)`);
    return;
  } catch (e) {
    if (e.name !== 'ResourceNotFoundException') throw e;
  }

  try {
    await client.send(new CreateTableCommand(tableDefinition));
    console.log(`  ✓ ${tableName} (created)`);
    console.log(`    PK: PAGE#<pageId>`);
    console.log(`    SK: CONFIG | SUB#<timestamp>#<id>`);
    console.log(`    GSI: EventPagesIndex (GSI1PK=EVENT#<eventId>, GSI1SK=PAGE#<createdAt>)`);
  } catch (e) {
    console.error(`  ✗ ${tableName}: ${e.message}`);
    process.exit(1);
  }

  console.log('\nDone!');
}

main().catch(console.error);
