'use client';

import { useCallback, useMemo } from 'react';
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

export function WhiteboardView() {
  // In production this would come from the whiteboard store connected to WebSocket
  const nodes: Node[] = useMemo(() => [
    {
      id: 'welcome',
      type: 'task-card',
      position: { x: 250, y: 200 },
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
  ], []);

  const edges: Edge[] = useMemo(() => [], []);

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
