'use client';

import { useMemo } from 'react';
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
import { useChatStore } from '@/stores/chat-store';
import { useAppStore } from '@/stores/app-store';
import type { WhiteboardNodeData } from '@/types/whiteboard';

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

/**
 * Derive whiteboard nodes from chat messages.
 * Each assistant message with tools/options becomes a card on the board.
 */
function deriveNodesFromMessages(messages: typeof useChatStore.prototype['messages']): Node[] {
  const nodes: Node[] = [];
  let x = 50;
  let y = 50;
  const COL_WIDTH = 320;
  const ROW_HEIGHT = 180;
  const COLS = 3;
  let idx = 0;

  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.metadata) continue;

    const meta = msg.metadata;

    // Determine node type and data based on tools used
    const toolsUsed = (meta.toolsUsed as string[]) || [];
    let nodeType: string = 'task-card';
    let statusColor: 'green' | 'yellow' | 'blue' | 'red' = 'green';

    if (toolsUsed.includes('search_venues')) {
      nodeType = 'venue-card';
      statusColor = 'blue';
    } else if (toolsUsed.includes('search_vendors') || toolsUsed.includes('search_catering') || toolsUsed.includes('web_search')) {
      nodeType = 'vendor-card';
      statusColor = 'blue';
    } else if (toolsUsed.includes('send_whatsapp') || toolsUsed.includes('send_email')) {
      nodeType = 'communication-log';
      statusColor = 'green';
    } else if (toolsUsed.includes('create_schedule')) {
      nodeType = 'schedule-block';
      statusColor = 'yellow';
    } else if (toolsUsed.includes('get_budget_summary')) {
      nodeType = 'analytics-widget';
      statusColor = 'yellow';
    }

    // Only add nodes for messages that had tool activity
    if (toolsUsed.length === 0 && !meta.options) continue;

    const col = idx % COLS;
    const row = Math.floor(idx / COLS);

    const nodeData: WhiteboardNodeData = {
      title: meta.agentName as string || 'Eventiq',
      status: 'completed',
      statusColor,
      statusIcon: 'check',
      summary: msg.content.slice(0, 120) + (msg.content.length > 120 ? '...' : ''),
      details: {
        toolsUsed,
        creditsCost: meta.creditsCost,
        optionsCount: (meta.options as any[])?.length || 0,
      },
      expandable: true,
      discussionHistory: toolsUsed.map(tool => ({
        timestamp: msg.timestamp,
        agent: meta.agentName as string || 'Eventiq',
        action: tool,
        outcome: 'completed',
      })),
      lastUpdated: msg.timestamp,
    };

    // Add option links if available
    if (meta.options && Array.isArray(meta.options)) {
      nodeData.links = (meta.options as any[])
        .filter((o: any) => o.url)
        .slice(0, 3)
        .map((o: any) => ({ label: o.name, url: o.url }));
    }

    nodes.push({
      id: msg.id,
      type: nodeType,
      position: { x: 50 + col * COL_WIDTH, y: 50 + row * ROW_HEIGHT },
      data: nodeData,
    });

    idx++;
  }

  // If no activity yet, show welcome card
  if (nodes.length === 0) {
    nodes.push({
      id: 'welcome',
      type: 'task-card',
      position: { x: 200, y: 150 },
      data: {
        title: 'Event Whiteboard',
        status: 'pending',
        statusColor: 'blue',
        statusIcon: 'info',
        summary: 'Chat with Eventiq to plan your event. Actions and findings will appear here as cards.',
        details: {},
        expandable: false,
        lastUpdated: new Date().toISOString(),
      },
    });
  }

  return nodes;
}

function deriveEdges(nodes: Node[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 1; i < nodes.length; i++) {
    edges.push({
      id: `edge-${nodes[i - 1].id}-${nodes[i].id}`,
      source: nodes[i - 1].id,
      target: nodes[i].id,
      animated: true,
    });
  }
  return edges;
}

export function WhiteboardView() {
  const messages = useChatStore((s) => s.messages);

  const nodes = useMemo(() => deriveNodesFromMessages(messages), [messages]);
  const edges = useMemo(() => deriveEdges(nodes), [nodes]);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
