export type AgentType =
  | 'venue'
  | 'vendor'
  | 'food'
  | 'payment'
  | 'communication'
  | 'attendee'
  | 'schedule'
  | 'analytics';

export interface AgentTask {
  id: string;
  type: AgentType;
  action: string;
  parameters: Record<string, unknown>;
  priority: 'high' | 'medium' | 'low';
  dependsOn?: string[];
  requiresApproval: boolean;
  status: TaskStatus;
  result?: TaskResult;
  reasoningTrace: ReasoningStep[];
  createdAt: string;
  completedAt?: string;
  retryCount: number;
}

export type TaskStatus =
  | 'waiting'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'awaiting-approval';

export interface Intent {
  type: IntentType;
  parameters: Record<string, unknown>;
  confidence: number;
  requiredAgents: AgentType[];
}

export type IntentType =
  | 'create_event'
  | 'search_venue'
  | 'find_vendor'
  | 'make_payment'
  | 'send_message'
  | 'manage_schedule'
  | 'check_status'
  | 'modify_event'
  | 'order_food'
  | 'manage_attendees'
  | 'generate_content'
  | 'get_analytics'
  | 'purchase_credits'
  | 'connect_stripe';

export interface TaskResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  suggestedAlternatives?: string[];
}

export interface ReasoningStep {
  stepId: string;
  agentName: string;
  action: string;
  rationale: string;
  dataSources: string[];
  timestamp: string;
  status: 'in-progress' | 'completed' | 'failed';
  duration?: number;
}

/** Model routing config per agent for cost optimization */
export const AGENT_MODEL_MAP: Record<AgentType | 'orchestrator', string> = {
  orchestrator: 'bedrock/claude-sonnet',
  venue: 'bedrock/claude-haiku',
  vendor: 'bedrock/claude-haiku',
  food: 'bedrock/claude-haiku',
  payment: 'none', // Pure logic, no LLM needed
  communication: 'bedrock/claude-haiku',
  attendee: 'none', // Pure logic
  schedule: 'bedrock/claude-haiku',
  analytics: 'bedrock/claude-haiku',
};
