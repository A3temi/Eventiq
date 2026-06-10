import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  runAgent: vi.fn(),
}));

vi.mock('@/lib/db/events', () => ({
  getEvent: mocks.getEvent,
  updateEvent: mocks.updateEvent,
}));

vi.mock('@/agents/researcher', () => ({ run: mocks.runAgent }));
vi.mock('@/agents/communication', () => ({ run: mocks.runAgent }));
vi.mock('@/agents/venue', () => ({ run: mocks.runAgent }));
vi.mock('@/agents/vendor', () => ({ run: mocks.runAgent }));
vi.mock('@/agents/schedule', () => ({ run: mocks.runAgent }));
vi.mock('@/agents/analytics', () => ({ run: mocks.runAgent }));
vi.mock('@/agents/attendee', () => ({ run: mocks.runAgent }));
vi.mock('@/agents/whiteboard', () => ({ run: mocks.runAgent }));
vi.mock('@/agents/forms', () => ({ run: mocks.runAgent }));

import { createOrchestratorTools } from './tools';

function saveTool(eventId?: string) {
  const tool = createOrchestratorTools({ eventId }).find((item) => item.name === 'save_event_details');
  if (!tool) throw new Error('save_event_details tool not found');
  return tool;
}

describe('createOrchestratorTools save_event_details', () => {
  beforeEach(() => {
    mocks.getEvent.mockReset();
    mocks.updateEvent.mockReset();
    mocks.runAgent.mockReset();
  });

  it('refuses to write without server-provided eventId', async () => {
    const result = JSON.parse(await saveTool().invoke({ field: 'budget', value: '1000' }) as string);

    expect(result).toMatchObject({ saved: false, error: 'save_event_details requires an active eventId' });
    expect(mocks.updateEvent).not.toHaveBeenCalled();
  });

  it('writes structured budget details and verifies persistence', async () => {
    mocks.getEvent
      .mockResolvedValueOnce({ id: 'evt-1', attendeeCount: 0, details: { budget: { total: 1000 } } })
      .mockResolvedValueOnce({ id: 'evt-1', attendeeCount: 0, details: { budget: { total: 2500, committed: 1800 } } });

    const result = JSON.parse(await saveTool('evt-1').invoke({
      field: 'budget',
      value: JSON.stringify({ total: 2500, committed: 1800 }),
    }) as string);

    expect(mocks.updateEvent).toHaveBeenCalledWith('evt-1', {
      details: { budget: { total: 2500, committed: 1800 }, visibleSections: ['budget'] },
    });
    expect(result).toMatchObject({ saved: true, field: 'budget', missingFields: [] });
  });

  it('writes attendeeCount for attendee saves', async () => {
    mocks.getEvent
      .mockResolvedValueOnce({ id: 'evt-1', attendeeCount: 0, details: {} })
      .mockResolvedValueOnce({ id: 'evt-1', attendeeCount: 40, details: {} });

    const result = JSON.parse(await saveTool('evt-1').invoke({ field: 'attendees', value: '40' }) as string);

    expect(mocks.updateEvent).toHaveBeenCalledWith('evt-1', {
      details: {},
      attendeeCount: 40,
    });
    expect(result).toMatchObject({ saved: true, missingFields: [] });
  });

  it('reports verification failures when persisted fields are missing', async () => {
    mocks.getEvent
      .mockResolvedValueOnce({ id: 'evt-1', attendeeCount: 0, details: {} })
      .mockResolvedValueOnce({ id: 'evt-1', attendeeCount: 0, details: {} });

    const result = JSON.parse(await saveTool('evt-1').invoke({ field: 'budget', value: '1000' }) as string);

    expect(result.saved).toBe(false);
    expect(result.missingFields).toContain('budget');
  });
});
