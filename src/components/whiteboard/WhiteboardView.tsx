'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { WhiteboardNodeCard } from './WhiteboardNodeCard';
import { useAppStore } from '@/stores/app-store';
import type { EventDetails } from '@/types/event';

const nodeTypes: NodeTypes = {
  'schedule-block': WhiteboardNodeCard,
  'vendor-card': WhiteboardNodeCard,
  'venue-card': WhiteboardNodeCard,
  'payment-status': WhiteboardNodeCard,
  'attendee-stats': WhiteboardNodeCard,
  'task-card': WhiteboardNodeCard,
  'communication-log': WhiteboardNodeCard,
  'analytics-widget': WhiteboardNodeCard,
};

interface EventData {
  details: EventDetails;
  name: string;
  status: string;
  attendeeCount: number;
  date: string;
}

function buildNodes(data: EventData | null): Node[] {
  if (!data) {
    return [
      {
        id: 'welcome',
        type: 'task-card',
        position: { x: 300, y: 250 },
        data: {
          title: 'Event Overview',
          status: 'pending',
          statusColor: 'blue',
          statusIcon: 'info',
          summary: 'Start planning your event in the chat to see it visualized here.',
          details: {},
          expandable: false,
          lastUpdated: new Date().toISOString(),
        },
      },
    ];
  }

  const { details, name, status, attendeeCount } = data;
  const nodes: Node[] = [];

  // Center status node
  nodes.push({
    id: 'status',
    type: 'task-card',
    position: { x: 300, y: 250 },
    data: {
      title: `📋 ${name}`,
      status: status === 'confirmed' ? 'completed' : 'in-progress',
      statusColor: status === 'confirmed' ? 'green' : 'blue',
      statusIcon: 'info',
      summary: `Status: ${status}`,
      details: {},
      expandable: false,
      lastUpdated: new Date().toISOString(),
    },
  });

  // Date node (top-left)
  nodes.push({
    id: 'date',
    type: 'task-card',
    position: { x: 50, y: 50 },
    data: {
      title: '📅 Date & Time',
      status: details.confirmedDate ? 'completed' : 'pending',
      statusColor: details.confirmedDate ? 'green' : 'yellow',
      statusIcon: details.confirmedDate ? 'check' : 'clock',
      summary: details.confirmedDate
        ? `${details.confirmedDate}${details.confirmedTime ? ' at ' + details.confirmedTime : ''}`
        : 'Not yet decided',
      details: {},
      expandable: false,
      lastUpdated: new Date().toISOString(),
    },
  });

  // Venue node (top-right)
  nodes.push({
    id: 'venue',
    type: 'venue-card',
    position: { x: 550, y: 50 },
    data: {
      title: '📍 Venue',
      status: details.confirmedVenue ? 'completed' : 'pending',
      statusColor: details.confirmedVenue ? 'green' : 'yellow',
      statusIcon: details.confirmedVenue ? 'check' : 'clock',
      summary: details.confirmedVenue
        ? `${details.confirmedVenue.name}${details.confirmedVenue.price ? ' • ' + details.confirmedVenue.price : ''}`
        : 'Not yet decided',
      details: {},
      links: details.confirmedVenue?.url
        ? [{ label: 'Visit site', url: details.confirmedVenue.url }]
        : undefined,
      expandable: false,
      lastUpdated: new Date().toISOString(),
    },
  });

  // Catering node (bottom-left)
  nodes.push({
    id: 'catering',
    type: 'vendor-card',
    position: { x: 50, y: 450 },
    data: {
      title: '🍽️ Catering',
      status: details.confirmedCatering ? 'completed' : 'pending',
      statusColor: details.confirmedCatering ? 'green' : 'yellow',
      statusIcon: details.confirmedCatering ? 'check' : 'clock',
      summary: details.confirmedCatering
        ? `${details.confirmedCatering.name}${details.confirmedCatering.price ? ' • ' + details.confirmedCatering.price : ''}`
        : 'Not yet decided',
      details: {},
      links: details.confirmedCatering?.url
        ? [{ label: 'Visit site', url: details.confirmedCatering.url }]
        : undefined,
      expandable: false,
      lastUpdated: new Date().toISOString(),
    },
  });

  // Schedule node (bottom-right)
  const scheduleItems = details.schedule || [];
  nodes.push({
    id: 'schedule',
    type: 'schedule-block',
    position: { x: 550, y: 450 },
    data: {
      title: '🕐 Schedule',
      status: scheduleItems.length > 0 ? 'completed' : 'pending',
      statusColor: scheduleItems.length > 0 ? 'green' : 'yellow',
      statusIcon: scheduleItems.length > 0 ? 'check' : 'clock',
      summary: scheduleItems.length > 0
        ? scheduleItems.map((s) => `${s.time} - ${s.title}`).join(', ')
        : 'No agenda items yet',
      details: {},
      expandable: scheduleItems.length > 0,
      discussionHistory: scheduleItems.map((s) => ({
        timestamp: new Date().toISOString(),
        agent: s.time,
        action: s.title,
        outcome: s.speaker || '',
      })),
      lastUpdated: new Date().toISOString(),
    },
  });

  // Attendees node (middle-left)
  const contacts = details.contacts || [];
  nodes.push({
    id: 'attendees',
    type: 'attendee-stats',
    position: { x: 50, y: 250 },
    data: {
      title: '👥 Attendees',
      status: attendeeCount > 0 || contacts.length > 0 ? 'in-progress' : 'pending',
      statusColor: attendeeCount > 0 || contacts.length > 0 ? 'blue' : 'yellow',
      statusIcon: 'info',
      summary: attendeeCount > 0
        ? `${attendeeCount} people${contacts.length > 0 ? ` • ${contacts.length} contacts` : ''}`
        : contacts.length > 0
          ? `${contacts.length} contacts`
          : 'Not yet decided',
      details: {},
      expandable: contacts.length > 0,
      discussionHistory: contacts.map((c) => ({
        timestamp: new Date().toISOString(),
        agent: c.name || 'Contact',
        action: c.phone || c.email || '',
        outcome: '',
      })),
      lastUpdated: new Date().toISOString(),
    },
  });

  return nodes;
}

function buildEdges(data: EventData | null): Edge[] {
  if (!data) return [];

  return [
    { id: 'e-date-status', source: 'date', target: 'status', animated: true },
    { id: 'e-venue-status', source: 'venue', target: 'status', animated: true },
    { id: 'e-catering-status', source: 'catering', target: 'status' },
    { id: 'e-schedule-status', source: 'schedule', target: 'status' },
    { id: 'e-attendees-status', source: 'attendees', target: 'status' },
  ];
}

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

    // Poll every 10 seconds to pick up changes
    const interval = setInterval(fetchDetails, 10000);
    return () => clearInterval(interval);
  }, [activeEventId]);

  const nodes = useMemo(() => buildNodes(eventData), [eventData]);
  const edges = useMemo(() => buildEdges(eventData), [eventData]);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
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
            const color = node.data?.statusColor;
            switch (color) {
              case 'green': return '#22c55e';
              case 'yellow': return '#eab308';
              case 'red': return '#ef4444';
              case 'blue': return '#3b82f6';
              default: return '#94a3b8';
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}
