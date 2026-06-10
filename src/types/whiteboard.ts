export interface WhiteboardConfig {
  sections: WhiteboardSection[];
}

export interface WhiteboardSection {
  id: string;
  type: 'date' | 'venue' | 'catering' | 'schedule' | 'contacts' | 'budget' | 'topics' | 'custom';
  title: string;
  status: 'confirmed' | 'discussing' | 'pending';
  content: Record<string, any>;
  order: number;
}

// Legacy types kept for backwards compatibility
export type WhiteboardNodeType =
  | 'schedule-block'
  | 'vendor-card'
  | 'venue-card'
  | 'payment-status'
  | 'attendee-stats'
  | 'task-card'
  | 'communication-log'
  | 'analytics-widget';

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

export interface DiscussionEntry {
  timestamp: string;
  agent: string;
  action: string;
  outcome: string;
}
