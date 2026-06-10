import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../dynamodb';
import type { AttendeeRecord, AttendeeStats } from '@/types/attendee';
import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';

function generateQRCode(eventId: string, attendeeId: string): string {
  return createHash('sha256').update(`${eventId}:${attendeeId}:${Date.now()}`).digest('hex').slice(0, 32);
}

export async function createAttendee(
  eventId: string,
  data: { name: string; email: string; ticketType: string; paymentStatus: AttendeeRecord['paymentStatus'] }
): Promise<AttendeeRecord> {
  const id = uuid();
  const now = new Date().toISOString();
  const qrCode = generateQRCode(eventId, id);

  const attendee: AttendeeRecord = {
    id,
    eventId,
    name: data.name,
    email: data.email,
    ticketType: data.ticketType,
    paymentStatus: data.paymentStatus,
    qrCode,
    checkedIn: false,
    registeredAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.attendees,
    Item: {
      PK: `EVENT#${eventId}`,
      SK: `ATTENDEE#${id}`,
      ...attendee,
    },
  }));

  return attendee;
}

export async function getAttendee(eventId: string, attendeeId: string): Promise<AttendeeRecord | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.attendees,
    Key: { PK: `EVENT#${eventId}`, SK: `ATTENDEE#${attendeeId}` },
  }));

  if (!result.Item) return null;
  const { PK, SK, ...attendee } = result.Item;
  return attendee as AttendeeRecord;
}

export async function findByQRCode(qrCode: string): Promise<AttendeeRecord | null> {
  // Uses GSI: QRCodeIndex
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.attendees,
    IndexName: 'QRCodeIndex',
    KeyConditionExpression: 'qrCode = :qr',
    ExpressionAttributeValues: { ':qr': qrCode },
    Limit: 1,
  }));

  if (!result.Items || result.Items.length === 0) return null;
  const { PK, SK, ...attendee } = result.Items[0];
  return attendee as AttendeeRecord;
}

export async function checkIn(eventId: string, attendeeId: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLES.attendees,
    Key: { PK: `EVENT#${eventId}`, SK: `ATTENDEE#${attendeeId}` },
    UpdateExpression: 'SET checkedIn = :true, checkedInAt = :now',
    ExpressionAttributeValues: {
      ':true': true,
      ':now': new Date().toISOString(),
    },
  }));
}

export async function getEventAttendees(eventId: string): Promise<AttendeeRecord[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.attendees,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}`,
      ':prefix': 'ATTENDEE#',
    },
  }));

  return (result.Items || []).map(({ PK, SK, ...item }) => item as AttendeeRecord);
}

export async function getAttendeeStats(eventId: string): Promise<AttendeeStats> {
  const attendees = await getEventAttendees(eventId);

  const ticketsByType: Record<string, number> = {};
  let revenue = 0;
  let checkedIn = 0;

  for (const a of attendees) {
    ticketsByType[a.ticketType] = (ticketsByType[a.ticketType] || 0) + 1;
    if (a.checkedIn) checkedIn++;
    // Revenue calculation would need price lookup - simplified here
  }

  return {
    totalRegistered: attendees.length,
    ticketsByType,
    revenue,
    currency: 'SGD',
    remainingCapacity: {}, // Would need registration config for limits
    checkedIn,
    pendingArrivals: attendees.length - checkedIn,
    checkInRate: [],
  };
}

export async function updatePaymentStatus(
  eventId: string,
  attendeeId: string,
  status: AttendeeRecord['paymentStatus'],
  stripePaymentId?: string
): Promise<void> {
  const expression = stripePaymentId
    ? 'SET paymentStatus = :status, stripePaymentId = :pid'
    : 'SET paymentStatus = :status';
  const values: Record<string, unknown> = { ':status': status };
  if (stripePaymentId) values[':pid'] = stripePaymentId;

  await docClient.send(new UpdateCommand({
    TableName: TABLES.attendees,
    Key: { PK: `EVENT#${eventId}`, SK: `ATTENDEE#${attendeeId}` },
    UpdateExpression: expression,
    ExpressionAttributeValues: values,
  }));
}
