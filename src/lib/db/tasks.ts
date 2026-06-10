import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES, ttl90Days } from '../dynamodb';
import type { AgentTask, TaskStatus } from '@/types/agents';
import { v4 as uuid } from 'uuid';

export async function createTask(eventId: string, task: Omit<AgentTask, 'id' | 'createdAt' | 'retryCount' | 'status' | 'reasoningTrace'>): Promise<AgentTask> {
  const fullTask: AgentTask = {
    ...task,
    id: uuid(),
    status: 'waiting',
    reasoningTrace: [],
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  await docClient.send(new PutCommand({
    TableName: TABLES.tasks,
    Item: {
      PK: `EVENT#${eventId}`,
      SK: `TASK#${fullTask.id}`,
      eventId,
      ...fullTask,
      ttl: ttl90Days(),
    },
  }));

  return fullTask;
}

export async function getTask(eventId: string, taskId: string): Promise<AgentTask | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.tasks,
    Key: { PK: `EVENT#${eventId}`, SK: `TASK#${taskId}` },
  }));

  if (!result.Item) return null;
  const { PK, SK, ttl, ...task } = result.Item;
  return task as AgentTask;
}

export async function updateTaskStatus(
  eventId: string,
  taskId: string,
  status: TaskStatus,
  result?: AgentTask['result']
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (result) updates.result = result;
  if (status === 'completed' || status === 'failed') {
    updates.completedAt = new Date().toISOString();
  }

  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  Object.entries(updates).forEach(([key, value]) => {
    expressions.push(`#${key} = :${key}`);
    names[`#${key}`] = key;
    values[`:${key}`] = value;
  });

  await docClient.send(new UpdateCommand({
    TableName: TABLES.tasks,
    Key: { PK: `EVENT#${eventId}`, SK: `TASK#${taskId}` },
    UpdateExpression: `SET ${expressions.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export async function getEventTasks(eventId: string): Promise<AgentTask[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.tasks,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}`,
      ':prefix': 'TASK#',
    },
  }));

  return (result.Items || []).map(({ PK, SK, ttl, ...item }) => item as AgentTask);
}

export async function incrementRetry(eventId: string, taskId: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLES.tasks,
    Key: { PK: `EVENT#${eventId}`, SK: `TASK#${taskId}` },
    UpdateExpression: 'SET retryCount = retryCount + :one',
    ExpressionAttributeValues: { ':one': 1 },
  }));
}
