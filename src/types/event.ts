export interface EventBrief {
  id: string;
  userId: string;
  name: string;
  type: string;
  date: string;
  endDate?: string;
  attendeeCount: number;
  budget: {
    total: number;
    currency: 'SGD';
    categories: CategoryBudget[];
  };
  location?: string;
  preferences: Record<string, unknown>;
  status: EventStatus;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EventStatus = 'draft' | 'planning' | 'confirmed' | 'in-progress' | 'completed';

export interface EventSummary {
  id: string;
  name: string;
  date: string;
  status: EventStatus;
  lastActivity: string;
  pinned?: boolean;
  summary?: string;
}

export interface ConversationContext {
  eventId: string;
  userId: string;
  messages: ChatMessage[];
  eventBrief?: EventBrief;
  activeAgents: AgentType[];
  pendingApprovals: ApprovalRequest[];
}

export interface CategoryBudget {
  name: BudgetCategory;
  allocated: number;
  committed: number;
  spent: number;
  remaining: number;
  utilizationPercent: number;
  isOverBudget: boolean;
  isWarning: boolean;
}

export type BudgetCategory =
  | 'venue'
  | 'catering'
  | 'av'
  | 'marketing'
  | 'speakers'
  | 'contingency'
  | 'other';

// Re-exports for convenience
import type { ChatMessage } from './chat';
import type { AgentType } from './agents';
import type { ApprovalRequest } from './chat';
export type { ChatMessage, AgentType, ApprovalRequest };
