'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  CenterStatusNode,
  DateTimeNode,
  VenueNode,
  CateringNode,
  ScheduleNode,
  ContactsNode,
  TopicsNode,
} from './nodes';
import { useAppStore } from '@/stores/app-store';
import type { EventDetails } from '@/types/event';

/* ─────────────────────────────────────────────
   Node types must be defined outside the component
   to avoid re-registration on every render.
   ───────────────────────────────────────────── */

const nodeTypes: NodeTypes = {
  centerStatus: CenterStatusNode,
  dateTime: DateTimeNode,
  venue: VenueNode,
  catering: CateringNode,
  schedule: ScheduleNode,
  contacts: ContactsNode,
  topics: TopicsNode,
};

/* ─────────────────────────────────────────────
   Data shape from the API
   ───────────────────────────────────────────── */

interface EventData {
  details: EventDetails;
  name: string;
  status: string;
  attendeeCount: number;
  date: string;
}

/* ─────────────────────────────────────────────
   Layout constants
   ───────────────────────────────────────────── */

const CENTER = { x: 350, y: 300 };
const OFFSET_X = 320;
const OFFSET_Y = 240;

/* ─────────────────────────────────────────────
   Build nodes from event data
   ───────────────────────────────────────────── */

function buildNodes(data: EventData | null): Node[] {
  if (!data) return [];

  const { details, name, status } = data;
  const nodes: Node[] = [];

  // Center
  nodes.push({
    id: 'center',
    type: 'centerStatus',
    position: CENTER,
    data: {
      name,
      status,
      date: details.confirmedDate || data.date || undefined,
    },
  });

  // Top-left: Date & Time
  nodes.push({
    id: 'datetime',
    type: 'dateTime',
    position: { x: CENTER.x - OFFSET_X, y: CENTER.y - OFFSET_Y },
    data: {
      confirmedDate: details.confirmedDate,
      confirmedTime: details.confirmedTime,
    },
  });

  // Top-right: Venue
  nodes.push({
    id: 'venue',
    type: 'venue',
    position: { x: CENTER.x + OFFSET_X, y: CENTER.y - OFFSET_Y },
    data: {
      name: details.confirmedVenue?.name,
      price: details.confirmedVenue?.price,
      url: details.confirmedVenue?.url,
      confirmed: !!details.confirmedVenue,
    },
  });

  // Left: Contacts
  nodes.push({
    id: 'contacts',
    type: 'contacts',
    position: { x: CENTER.x - OFFSET_X - 20, y: CENTER.y + 10 },
    data: {
      contacts: (details.contacts || []).map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email,
        status: 'pending' as const,
      })),
      attendeeCount: data.attendeeCount,
    },
  });

  // Right: Catering
  nodes.push({
    id: 'catering',
    type: 'catering',
    position: { x: CENTER.x + OFFSET_X + 20, y: CENTER.y + 10 },
    data: {
      name: details.confirmedCatering?.name,
      price: details.confirmedCatering?.price,
      confirmed: !!details.confirmedCatering,
    },
  });

  // Bottom-left: Schedule
  nodes.push({
    id: 'schedule',
    type: 'schedule',
    position: { x: CENTER.x - OFFSET_X, y: CENTER.y + OFFSET_Y },
    data: {
      items: details.schedule || [],
    },
  });

  // Bottom-right: Topics
  nodes.push({
    id: 'topics',
    type: 'topics',
    position: { x: CENTER.x + OFFSET_X, y: CENTER.y + OFFSET_Y },
    data: {
      topics: details.topics || [],
      confirmedTopics: [],
    },
  });

  return nodes;
}

/* ─────────────────────────────────────────────
   Build edges with status-based styling
   ───────────────────────────────────────────── */

function buildEdges(data: EventData | null): Edge[] {
  if (!data) return [];

  const { details, status } = data;

  const isEventConfirmed = status === 'confirmed' || status === 'completed';

  function edgeStyle(confirmed: boolean) {
    if (confirmed) {
      return {
        animated: false,
        style: { stroke: '#22c55e', strokeWidth: 2 },
      };
    }
    if (isEventConfirmed) {
      return {
        animated: false,
        style: { stroke: '#22c55e', strokeWidth: 2 },
      };
    }
    return {
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 5' },
    };
  }

  const dateConfirmed = !!details.confirmedDate;
  const venueConfirmed = !!details.confirmedVenue;
  const cateringConfirmed = !!details.confirmedCatering;
  const scheduleReady = (details.schedule || []).length > 0;
  const contactsActive =
    (details.contacts || []).length > 0 || data.attendeeCount > 0;
  const topicsReady = (details.topics || []).length > 0;

  return [
    {
      id: 'e-datetime-center',
      source: 'datetime',
      target: 'center',
      targetHandle: undefined,
      ...edgeStyle(dateConfirmed),
    },
    {
      id: 'e-venue-center',
      source: 'venue',
      target: 'center',
      targetHandle: undefined,
      ...edgeStyle(venueConfirmed),
    },
    {
      id: 'e-contacts-center',
      source: 'contacts',
      target: 'center',
      targetHandle: 'left',
      ...edgeStyle(contactsActive),
    },
    {
      id: 'e-catering-center',
      source: 'catering',
      target: 'center',
      targetHandle: 'right',
      ...edgeStyle(cateringConfirmed),
    },
    {
      id: 'e-schedule-center',
      source: 'schedule',
      target: 'center',
      targetHandle: 'bottom',
      ...edgeStyle(scheduleReady),
    },
    {
      id: 'e-topics-center',
      source: 'topics',
      target: 'center',
      targetHandle: 'bottom',
      ...edgeStyle(topicsReady),
    },
  ];
}

/* ─────────────────────────────────────────────
   Empty state component
   ───────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-muted/20">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-primary/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Event Whiteboard
        </h3>
        <p className="text-sm text-muted-foreground">
          Select an event or start planning in the chat to see your event visualized here.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main WhiteboardView component
   ───────────────────────────────────────────── */

export function WhiteboardView() {
  const activeEventId = useAppStore((s) => s.activeEventId);
  const [eventData, setEventData] = useState<EventData | null>(null);

  useEffect(() => {
    if (!activeEventId) {
      setEventData(null);
      return;
    }

    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/events/${activeEventId}/details`);
        if (res.ok) {
          const data = await res.json();
          setEventData(data);
        }
      } catch (err) {
        console.error('Failed to load event details:', err);
      }
    };

    fetchDetails();

    // Poll every 5 seconds to pick up changes
    const interval = setInterval(fetchDetails, 5000);
    return () => clearInterval(interval);
  }, [activeEventId]);

  const nodes = useMemo(() => buildNodes(eventData), [eventData]);
  const edges = useMemo(() => buildEdges(eventData), [eventData]);

  if (!activeEventId) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={2}
      >
        <Background gap={20} size={1} color="#f0f0f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'centerStatus':
                return '#3b82f6';
              case 'dateTime':
                return '#22c55e';
              case 'venue':
                return '#22c55e';
              case 'catering':
                return '#eab308';
              case 'schedule':
                return '#22c55e';
              case 'contacts':
                return '#3b82f6';
              case 'topics':
                return '#22c55e';
              default:
                return '#94a3b8';
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}
