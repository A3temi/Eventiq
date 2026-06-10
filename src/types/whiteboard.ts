import type { Node, Viewport } from 'reactflow';

export interface WhiteboardState {
  eventId: string;
  nodes: WhiteboardNode[];
  edges: WhiteboardEdge[];
  viewport: Viewport;
}

export type WhiteboardNodeType =
  | 'schedule-block'
  | 'vendor-card'
  | 'venue-card'
  | 'payment-status'
  | 'attendee-stats'
  | 'task-card'
  | 'communication-log'
  | 'analytics-widget';

export interface WhiteboardNode extends Node {
  id: string;
  type: WhiteboardNodeType;
  position: { x: number; y: number };
  data: WhiteboardNodeData;
}

export interface WhiteboardNodeData {
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'awaiting-approval';
  statusColor: 'green' | 'yellow' | 'red' | 'blue';
  statusIcon: string;
  summary: string;
  details: Record<string, unknown>;
  links?: { label: string; url: string }[];
  expandable: boolean;
  discussionHistory?: DiscussionEntry[];
  lastUpdated: string;
}

export interface WhiteboardEdge {
  id: string;
  source: string;
  target: string;
  from: string;
  to: string;
  label?: string;
  animated?: boolean;
}

export interface DiscussionEntry {
  timestamp: string;
  agent: string;
  action: string;
  outcome: string;
}
