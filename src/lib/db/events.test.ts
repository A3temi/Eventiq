import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('../dynamodb', () => ({
  docClient: { send: sendMock },
  TABLES: { events: 'events' },
  ttl90Days: () => 123,
}));

vi.mock('uuid', () => ({ v4: () => 'event-1' }));

import { createEvent, getEvent, updateEvent } from './events';

describe('event db status boundaries', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('creates events as planning by default', async () => {
    sendMock.mockResolvedValueOnce({});

    const event = await createEvent('user-1', { name: 'Launch' });

    expect(event.status).toBe('planning');
    expect(sendMock.mock.calls[0][0].input.Item.status).toBe('planning');
  });

  it('normalizes legacy status values on read', async () => {
    sendMock.mockResolvedValueOnce({
      Item: {
        PK: 'EVENT#event-1',
        SK: 'METADATA',
        ttl: 123,
        id: 'event-1',
        userId: 'user-1',
        name: 'Launch',
        type: '',
        date: '',
        attendeeCount: 0,
        budget: { total: 0, currency: 'SGD', categories: [] },
        preferences: {},
        status: 'draft',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const event = await getEvent('event-1');

    expect(event?.status).toBe('planning');
  });

  it('normalizes accepted legacy write aliases', async () => {
    sendMock.mockResolvedValueOnce({});

    await updateEvent('event-1', { status: 'in_progress' as any });

    expect(sendMock.mock.calls[0][0].input.ExpressionAttributeValues[':status']).toBe('on-going');
  });

  it('rejects unsupported direct status writes', async () => {
    await expect(updateEvent('event-1', { status: 'archived' as any })).rejects.toThrow('Invalid event status');
    expect(sendMock).not.toHaveBeenCalled();
  });
});
