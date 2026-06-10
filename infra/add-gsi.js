const { DynamoDBClient, UpdateTableCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: 'us-east-1' });

async function main() {
  // Add GSI to events table
  try {
    await client.send(new UpdateTableCommand({
      TableName: 'eventbot-events',
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'createdAt', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexUpdates: [{
        Create: {
          IndexName: 'UserEventsIndex',
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      }],
    }));
    console.log('✓ UserEventsIndex added to eventbot-events');
  } catch (e) {
    console.log(`  events GSI: ${e.message}`);
  }

  // Add QRCode GSI to attendees table
  try {
    await client.send(new UpdateTableCommand({
      TableName: 'eventbot-attendees',
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'qrCode', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexUpdates: [{
        Create: {
          IndexName: 'QRCodeIndex',
          KeySchema: [{ AttributeName: 'qrCode', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
      }],
    }));
    console.log('✓ QRCodeIndex added to eventbot-attendees');
  } catch (e) {
    console.log(`  attendees GSI: ${e.message}`);
  }
}

main().catch(console.error);
