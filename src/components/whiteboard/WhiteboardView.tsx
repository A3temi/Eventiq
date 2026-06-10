'use client';

import { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { WhiteboardNodeCard } from './WhiteboardNodeCard';
import { useChatStore } from '@/stores/chat-store';
import type { WhiteboardNodeData } from '@/types/whiteboard';
import type { ChatMessage } from '@/types/chat';

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

// ─── Planning categories ────────────────────────────────────────────────────

interface PlanningCategory {
  id: string;
  label: string;
  nodeType: string;
  tools: string[];
}

const CATEGORIES: PlanningCategory[] = [
  { id: 'venue', label: '📍 Venue', nodeType: 'venue-card', tools: ['search_venues'] },
  { id: 'catering', label: '🍽️ Catering', nodeType: 'vendor-card', tools: ['search_catering'] },
  { id: 'vendors', label: '🎯 Vendors', nodeType: 'vendor-card', tools: ['search_vendors'] },
  { id: 'schedule', label: '📅 Schedule', nodeType: 'schedule-block', tools: ['create_schedule'] },
  { id: 'comms', label: '💬 Communications', nodeType: 'communication-log', tools: ['send_whatsapp', 'send_email'] },
  { id: 'research', label: '🔍 Research', nodeType: 'task-card', tools: ['web_search'] },
  { id: 'budget', label: '💰 Budget', nodeType: 'analytics-widget', tools: ['get_budget_summary'] },
];

type CategoryStatus = 'not-started' | 'in-progress' | 'completed';

function buildNodesAndEdges(messages: ChatMessage[]): { nodes: Node[]; edges: Edge[] } {
  // Track state per category
  const catState: Record<string, { status: CategoryStatus; count: number; summary: string; links: { label: string; url: string }[] }> = {};
  for (const cat of CATEGORIES) {
    catState[cat.id] = { status: 'not-started', count: 0, summary: 'Not started yet', links: [] };
  }

  // Keywords that indicate a decision/confirmation was made
  const confirmKeywords = /\b(finalize|confirmed|booked|selected|chosen|locked in|done|completed|approved|go with|proceed with)\b/i;
  const venueKeywords = /\b(venue|location|space|room|hall|auditorium)\b/i;
  const cateringKeywords = /\b(cater|food|buffet|lunch|dinner|meal|menu|cuisine|halal|vegetarian)\b/i;
  const vendorKeywords = /\b(photographer|videographer|AV|decorator|florist|entertainment|emcee|DJ)\b/i;
  const scheduleKeywords = /\b(schedule|agenda|timeline|session|programme|program|run.?of.?show)\b/i;
  const commsKeywords = /\b(sent|messaged|emailed|whatsapp|contacted|reached out|notified)\b/i;
  const budgetKeywords = /\b(budget|cost|expense|price|payment|invoice|quote)\b/i;

  // Analyze messages
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.metadata) continue;
    const toolsUsed = (msg.metadata.toolsUsed as string[]) || [];
    const content = msg.content || '';

    // Tool-based tracking
    if (toolsUsed.length > 0) {
      for (const cat of CATEGORIES) {
        const matched = toolsUsed.filter(t => cat.tools.includes(t));
        if (matched.length === 0) continue;

        const s = catState[cat.id];
        s.count += matched.length;
        if (s.status === 'not-started') s.status = 'in-progress';
        s.summary = content.slice(0, 100).replace(/\n/g, ' ').trim();
        if (s.summary.length >= 100) s.summary = s.summary.slice(0, 97) + '...';

        if (msg.metadata.options && Array.isArray(msg.metadata.options)) {
          for (const opt of msg.metadata.options as any[]) {
            if (opt.url && s.links.length < 3) {
              s.links.push({ label: opt.name || 'Link', url: opt.url });
            }
          }
        }
      }
    }

    // Content-based tracking — detect confirmations and decisions
    if (confirmKeywords.test(content)) {
      if (venueKeywords.test(content) && catState.venue.status !== 'not-started') {
        catState.venue.status = 'completed';
        catState.venue.summary = content.slice(0, 100).replace(/\n/g, ' ').trim();
      }
      if (cateringKeywords.test(content)) {
        if (catState.catering.status === 'not-started') catState.catering.count++;
        catState.catering.status = 'completed';
        catState.catering.summary = content.slice(0, 100).replace(/\n/g, ' ').trim();
      }
      if (vendorKeywords.test(content) && catState.vendors.status !== 'not-started') {
        catState.vendors.status = 'completed';
        catState.vendors.summary = content.slice(0, 100).replace(/\n/g, ' ').trim();
      }
      if (scheduleKeywords.test(content)) {
        if (catState.schedule.status === 'not-started') catState.schedule.count++;
        catState.schedule.status = 'completed';
        catState.schedule.summary = content.slice(0, 100).replace(/\n/g, ' ').trim();
      }
      if (budgetKeywords.test(content)) {
        if (catState.budget.status === 'not-started') catState.budget.count++;
        catState.budget.status = 'completed';
        catState.budget.summary = content.slice(0, 100).replace(/\n/g, ' ').trim();
      }
    }

    // Comms are completed if any were sent (tool-based)
    if (commsKeywords.test(content) || toolsUsed.includes('send_whatsapp') || toolsUsed.includes('send_email')) {
      if (catState.comms.status === 'not-started') catState.comms.count++;
      catState.comms.status = 'completed';
      if (content) catState.comms.summary = content.slice(0, 100).replace(/\n/g, ' ').trim();
    }
  }

  // Also check USER messages for confirmations (e.g. "finalize Yum Cha Buffet")
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const content = msg.content || '';

    if (confirmKeywords.test(content)) {
      if (cateringKeywords.test(content)) {
        if (catState.catering.status === 'not-started') catState.catering.count++;
        catState.catering.status = 'completed';
        catState.catering.summary = `✓ ${content.slice(0, 80)}`;
      }
      if (venueKeywords.test(content)) {
        if (catState.venue.status === 'not-started') catState.venue.count++;
        catState.venue.status = 'completed';
        catState.venue.summary = `✓ ${content.slice(0, 80)}`;
      }
      if (vendorKeywords.test(content)) {
        if (catState.vendors.status === 'not-started') catState.vendors.count++;
        catState.vendors.status = 'completed';
        catState.vendors.summary = `✓ ${content.slice(0, 80)}`;
      }
      if (scheduleKeywords.test(content)) {
        if (catState.schedule.status === 'not-started') catState.schedule.count++;
        catState.schedule.status = 'completed';
        catState.schedule.summary = `✓ ${content.slice(0, 80)}`;
      }
    }
  }

  // Build nodes
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const totalActions = Object.values(catState).reduce((sum, s) => sum + s.count, 0);
  const completedCount = Object.values(catState).filter(s => s.status === 'completed').length;
  const inProgressCount = Object.values(catState).filter(s => s.status === 'in-progress').length;

  // Overview node
  nodes.push({
    id: 'overview',
    type: 'task-card',
    position: { x: 250, y: 20 },
    data: {
      title: '🎪 Event Planning Status',
      status: totalActions === 0 ? 'pending' : 'in-progress',
      statusColor: totalActions === 0 ? 'blue' : completedCount >= 5 ? 'green' : 'yellow',
      statusIcon: 'info',
      summary: totalActions === 0
        ? 'Chat with Eventiq to start planning. Progress appears here in real time.'
        : `${completedCount} done · ${inProgressCount} in progress · ${totalActions} total actions`,
      details: {},
      expandable: false,
      lastUpdated: new Date().toISOString(),
    } as WhiteboardNodeData,
  });

  // Category nodes
  const active = CATEGORIES.filter(c => catState[c.id].status !== 'not-started');
  const pending = CATEGORIES.filter(c => catState[c.id].status === 'not-started');

  const COL_WIDTH = 280;
  const ROW_HEIGHT = 180;
  const START_Y = 160;

  active.forEach((cat, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const s = catState[cat.id];
    const statusColor = s.status === 'completed' ? 'green' : 'yellow';

    nodes.push({
      id: `cat-${cat.id}`,
      type: cat.nodeType,
      position: { x: 50 + col * COL_WIDTH, y: START_Y + row * ROW_HEIGHT },
      data: {
        title: cat.label,
        status: s.status === 'completed' ? 'completed' : 'in-progress',
        statusColor,
        statusIcon: s.status === 'completed' ? 'check' : 'clock',
        summary: s.summary,
        details: { actionCount: s.count },
        expandable: false,
        links: s.links,
        lastUpdated: new Date().toISOString(),
      } as WhiteboardNodeData,
    });

    edges.push({
      id: `e-overview-${cat.id}`,
      source: 'overview',
      target: `cat-${cat.id}`,
      animated: s.status === 'in-progress',
      style: { stroke: statusColor === 'green' ? '#22c55e' : '#eab308', strokeWidth: 2 },
    });
  });

  // Pending categories at the bottom
  if (pending.length > 0 && active.length > 0) {
    const pendingY = START_Y + Math.ceil(active.length / 3) * ROW_HEIGHT + 30;
    pending.forEach((cat, idx) => {
      nodes.push({
        id: `cat-${cat.id}`,
        type: 'task-card',
        position: { x: 50 + idx * 180, y: pendingY },
        data: {
          title: cat.label,
          status: 'pending',
          statusColor: 'blue',
          statusIcon: 'clock',
          summary: 'Not started',
          details: {},
          expandable: false,
          lastUpdated: new Date().toISOString(),
        } as WhiteboardNodeData,
      });
    });
  }

  return { nodes, edges };
}

export function WhiteboardView() {
  const messages = useChatStore((s) => s.messages);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Rebuild whenever messages change
  useEffect(() => {
    const result = buildNodesAndEdges(messages);
    setNodes(result.nodes);
    setEdges(result.edges);
  }, [messages, messages.length, setNodes, setEdges]);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
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
