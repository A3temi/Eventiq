'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import { WhiteboardInput } from './WhiteboardInput';
import { DateSection } from './sections/DateSection';
import { VenueSection } from './sections/VenueSection';
import { CateringSection } from './sections/CateringSection';
import { AttendeesSection } from './sections/AttendeesSection';
import { ScheduleSection } from './sections/ScheduleSection';
import { BudgetSection } from './sections/BudgetSection';
import { TopicsSection } from './sections/TopicsSection';
import type { EventDetails } from '@/types/event';

interface EventState {
  details: EventDetails;
  name: string;
  status: string;
  attendeeCount: number;
  date: string;
}

export function WhiteboardView() {
  const activeEventId = useAppStore((s) => s.activeEventId);
  const [eventState, setEventState] = useState<EventState | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!activeEventId) {
      setEventState(null);
      return;
    }
    try {
      const res = await fetch(`/api/events/${activeEventId}/details`);
      if (!res.ok) return;
      const data = await res.json();
      setEventState(data);
    } catch (e) {
      console.error('Failed to fetch event details:', e);
    }
  }, [activeEventId]);

  useEffect(() => {
    setLoading(true);
    fetchDetails().finally(() => setLoading(false));
  }, [fetchDetails]);

  // Poll every 5 seconds
  useEffect(() => {
    if (!activeEventId) return;
    const interval = setInterval(fetchDetails, 5000);
    return () => clearInterval(interval);
  }, [activeEventId, fetchDetails]);

  // Empty state
  if (!activeEventId || (!loading && !eventState)) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="text-4xl mb-3">📋</div>
            <h2 className="text-lg font-semibold text-foreground mb-1">No Active Event</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Start a conversation in Chat mode to plan an event. Confirmed decisions will appear here as a visual overview.
            </p>
          </div>
        </div>
        <WhiteboardInput />
      </div>
    );
  }

  if (loading && !eventState) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground text-sm">Loading event...</div>
        </div>
        <WhiteboardInput />
      </div>
    );
  }

  const details = eventState?.details || {};
  const hasDate = !!(details.confirmedDate || details.confirmedTime);
  const hasVenue = !!details.confirmedVenue;
  const hasCatering = !!details.confirmedCatering;
  const hasContacts = !!(details.contacts && details.contacts.length > 0);
  const hasSchedule = !!(details.schedule && details.schedule.length > 0);
  const hasBudget = !!details.budget;
  const hasTopics = !!(details.topics && details.topics.length > 0);
  const hasAnySections = hasDate || hasVenue || hasCatering || hasContacts || hasSchedule || hasBudget || hasTopics;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {eventState?.name || 'Event'}
            </h1>
            {eventState?.date && (
              <p className="text-xs text-muted-foreground mt-0.5">{eventState.date}</p>
            )}
          </div>
          <StatusBadge status={eventState?.status || 'draft'} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!hasAnySections ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-3xl mb-2">🎯</div>
              <p className="text-sm text-muted-foreground max-w-xs">
                No confirmed details yet. Chat with Eventiq to make decisions — they&apos;ll appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top row: date, venue, catering, attendees */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {hasDate && (
                <DateSection date={details.confirmedDate} time={details.confirmedTime} />
              )}
              {hasVenue && (
                <VenueSection venue={details.confirmedVenue!} />
              )}
              {hasCatering && (
                <CateringSection catering={details.confirmedCatering!} />
              )}
              {hasContacts && (
                <AttendeesSection
                  contacts={details.contacts!}
                  totalCount={eventState?.attendeeCount || details.contacts!.length}
                />
              )}
            </div>

            {/* Schedule - full width */}
            {hasSchedule && (
              <ScheduleSection items={details.schedule!} />
            )}

            {/* Bottom row: budget + topics */}
            {(hasBudget || hasTopics) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {hasBudget && <BudgetSection budget={details.budget!} />}
                {hasTopics && <TopicsSection topics={details.topics!} />}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input at bottom */}
      <WhiteboardInput />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
    planning: { label: 'Planning', className: 'bg-blue-100 text-blue-700' },
    confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
    'in-progress': { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  };

  const { label, className } = config[status] || config.draft;

  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${className}`}>
      {label}
    </span>
  );
}
