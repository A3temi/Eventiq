import type { ReasoningStep } from './agents';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: FileAttachment[];
  metadata?: MessageMetadata;
}

export interface OptionCard {
  type: string;
  name: string;
  price?: string;
  description: string;
  url?: string;
  score?: number;
  category?: string;
}

export interface ThinkingStep {
  tool: string;
  query?: string;
  source?: string;
  url?: string;
  status: 'completed' | 'failed';
}

export interface MessageMetadata {
  agentName?: string;
  reasoningTrace?: ReasoningStep[];
  approvalRequest?: ApprovalRequest;
  statusUpdate?: AgentStatusUpdate;
  comparisonTable?: ComparisonData;
  creditsCost?: number;
  options?: OptionCard[];
  thinking?: ThinkingStep[];
  toolsUsed?: string[];
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

export interface ApprovalRequest {
  id: string;
  actionType: 'payment' | 'communication' | 'booking' | 'checkout';
  amount?: number;
  currency?: string;
  recipient?: string;
  description: string;
  consequenceApprove: string;
  consequenceReject: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AgentStatusUpdate {
  agentName: string;
  taskId: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  message: string;
  timestamp: string;
}

export interface ComparisonData {
  headers: string[];
  rows: ComparisonRow[];
  highlightBest?: number;
}

export interface ComparisonRow {
  cells: string[];
  score?: number;
  recommended?: boolean;
}
