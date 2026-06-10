import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runAgentGraph: vi.fn(),
  createEvent: vi.fn(),
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  createMessage: vi.fn(),
  getRecentMessages: vi.fn(),
  getCreditBalance: vi.fn(),
  deductCredits: vi.fn(),
}));

vi.mock('@/agents/graph', () => ({ runAgentGraph: mocks.runAgentGraph }));
vi.mock('@/lib/db/events', () => ({
  createEvent: mocks.createEvent,
  getEvent: mocks.getEvent,
  updateEvent: mocks.updateEvent,
}));
vi.mock('@/lib/db/conversations', () => ({
  createMessage: mocks.createMessage,
  getRecentMessages: mocks.getRecentMessages,
}));
vi.mock('@/lib/db/credits', () => ({
  getCreditBalance: mocks.getCreditBalance,
  deductCredits: mocks.deductCredits,
}));

import { orchestrate } from './index';

describe('orchestrator persistence guardrails', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getCreditBalance.mockResolvedValue({ balance: 100 });
    mocks.deductCredits.mockResolvedValue({ success: true, balance: { balance: 98 } });
    mocks.createMessage.mockResolvedValue({});
    mocks.getRecentMessages.mockResolvedValue([]);
    mocks.getEvent.mockResolvedValue({
      id: 'evt-1',
      userId: 'user-1',
      name: 'Launch Event',
      type: '',
      date: '',
      attendeeCount: 0,
      budget: { total: 0, currency: 'SGD', categories: [] },
      preferences: {},
      status: 'planning',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      details: {},
    });
  });

  it('does not persist unconfirmed recommendation text from the assistant response', async () => {
    mocks.runAgentGraph.mockResolvedValue({
      response: 'Budget estimate\n- Venue: S$2,000\n- Catering: S$1,500\nTotal budget: S$3,500\nVenue: Expo Hall',
      toolsUsed: [],
    });

    const result = await orchestrate({ message: 'Plan my event budget', userId: 'user-1', eventId: 'evt-1' });

    expect(result.content).toContain('Budget estimate');
    expect(mocks.runAgentGraph).toHaveBeenCalledWith('Plan my event budget', [], { eventId: 'evt-1' });
    expect(mocks.updateEvent).not.toHaveBeenCalled();
  });
});
