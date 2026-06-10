import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES, ttl90Days } from '../dynamodb';
import { v4 as uuid } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PageField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'textarea' | 'rating' | 'checkbox' | 'date' | 'phone';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface PageConfig {
  id: string;
  eventId: string;
  type: 'registration' | 'feedback' | 'checkin' | 'event-page' | 'custom';
  title: string;
  fields: PageField[];
  settings: {
    description?: string;
    submitButton?: string;
    successMessage?: string;
    deadline?: string;
    maxResponses?: number;
    customCss?: string;
    eventDate?: string;
    eventVenue?: string;
    eventAgenda?: string[];
    registrationLink?: string;
  };
  createdAt: string;
  submissions: number;
}

export interface PageSubmission {
  id: string;
  pageId: string;
  data: Record<string, unknown>;
  submittedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function createPage(
  config: Omit<PageConfig, 'id' | 'createdAt' | 'submissions'>
): Promise<PageConfig> {
  const page: PageConfig = {
    ...config,
    id: uuid(),
    createdAt: new Date().toISOString(),
    submissions: 0,
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.pages,
    Item: {
      PK: `PAGE#${page.id}`,
      SK: 'CONFIG',
      GSI1PK: `EVENT#${page.eventId}`,
      GSI1SK: `PAGE#${page.createdAt}`,
      ...page,
      ttl: ttl90Days(),
    },
  }));

  return page;
}

export async function getPage(pageId: string): Promise<PageConfig | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.pages,
    Key: { PK: `PAGE#${pageId}`, SK: 'CONFIG' },
  }));

  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, ttl, ...page } = result.Item;
  return page as PageConfig;
}

export async function updatePage(
  pageId: string,
  updates: Partial<Omit<PageConfig, 'id' | 'createdAt'>>
): Promise<PageConfig | null> {
  const existing = await getPage(pageId);
  if (!existing) return null;

  const merged: PageConfig = {
    ...existing,
    ...updates,
    settings: { ...existing.settings, ...updates.settings },
    fields: updates.fields || existing.fields,
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.pages,
    Item: {
      PK: `PAGE#${pageId}`,
      SK: 'CONFIG',
      GSI1PK: `EVENT#${merged.eventId}`,
      GSI1SK: `PAGE#${merged.createdAt}`,
      ...merged,
      ttl: ttl90Days(),
    },
  }));

  return merged;
}

export async function listEventPages(eventId: string): Promise<PageConfig[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.pages,
    IndexName: 'EventPagesIndex',
    KeyConditionExpression: 'GSI1PK = :epk',
    ExpressionAttributeValues: { ':epk': `EVENT#${eventId}` },
    ScanIndexForward: false,
  }));

  return (result.Items || []).map(({ PK, SK, GSI1PK, GSI1SK, ttl, ...item }) => item as PageConfig);
}

export async function saveSubmission(
  pageId: string,
  data: Record<string, unknown>
): Promise<PageSubmission> {
  const submission: PageSubmission = {
    id: uuid(),
    pageId,
    data,
    submittedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.pages,
    Item: {
      PK: `PAGE#${pageId}`,
      SK: `SUB#${submission.submittedAt}#${submission.id}`,
      ...submission,
      ttl: ttl90Days(),
    },
  }));

  // Increment submission count
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLES.pages,
      Key: { PK: `PAGE#${pageId}`, SK: 'CONFIG' },
      UpdateExpression: 'SET submissions = submissions + :inc',
      ExpressionAttributeValues: { ':inc': 1 },
    }));
  } catch {
    // Non-critical — submission is saved regardless
  }

  return submission;
}

export async function getSubmissions(pageId: string): Promise<PageSubmission[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.pages,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `PAGE#${pageId}`,
      ':prefix': 'SUB#',
    },
    ScanIndexForward: false,
  }));

  return (result.Items || []).map(({ PK, SK, ttl, ...item }) => item as PageSubmission);
}
