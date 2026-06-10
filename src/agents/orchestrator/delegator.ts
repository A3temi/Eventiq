import type { AgentTask, AgentType, TaskResult } from '@/types/agents';
import type { EventBrief } from '@/types/event';
import { updateTaskStatus } from '@/lib/db/tasks';
import { deductCredits } from '@/lib/db/credits';
import { CREDIT_COSTS } from '@/types/payment';
import { logAudit } from '@/lib/db/audit';
import { retryWithBackoff } from '@/lib/retry';

// Agent imports
import { handleVenueTask } from '@/agents/venue';
import { handleVendorTask } from '@/agents/vendor';
import { handlePaymentTask } from '@/agents/payment';
import { handleCommunicationTask } from '@/agents/communication';
import { handleAttendeeTask } from '@/agents/attendee';
import { handleScheduleTask } from '@/agents/schedule';
import { handleAnalyticsTask } from '@/agents/analytics';

interface DelegationResult {
  success: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

const AGENT_HANDLERS: Record<AgentType, (task: AgentTask, event: EventBrief, userId: string) => Promise<DelegationResult>> = {
  venue: handleVenueTask,
  vendor: handleVendorTask,
  food: handleVendorTask, // Food uses vendor agent with catering specialization
  payment: handlePaymentTask,
  communication: handleCommunicationTask,
  attendee: handleAttendeeTask,
  schedule: handleScheduleTask,
  analytics: handleAnalyticsTask,
};

export async function delegateToAgent(
  agentType: AgentType,
  task: AgentTask,
  event: EventBrief,
  userId: string
): Promise<DelegationResult> {
  const handler = AGENT_HANDLERS[agentType];
  if (!handler) {
    return { success: false, summary: `Unknown agent type: ${agentType}` };
  }

  // Deduct credits for LLM-using agents
  if (agentType !== 'payment' && agentType !== 'attendee') {
    const creditResult = await deductCredits(userId, CREDIT_COSTS.llm_call, `${agentType}_task`, event.id);
    if (!creditResult.success) {
      return {
        success: false,
        summary: 'You\'re out of credits. Please purchase more to continue.',
      };
    }
  }

  // Update task to in-progress
  await updateTaskStatus(event.id, task.id, 'in-progress');

  try {
    const result = await retryWithBackoff(
      () => handler(task, event, userId),
      3,
      [1000, 2000, 4000]
    );

    await updateTaskStatus(event.id, task.id, 'completed', {
      success: result.success,
      data: result.data,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await updateTaskStatus(event.id, task.id, 'failed', {
      success: false,
      error: errorMessage,
      suggestedAlternatives: ['Try again', 'Adjust parameters'],
    });

    await logAudit(event.id, {
      agentName: agentType,
      operation: task.action,
      errorType: 'agent_failure',
      errorMessage,
      retryTimestamps: [],
      resolution: 'pending',
    });

    return {
      success: false,
      summary: `${agentType} agent encountered an error: ${errorMessage}. I'll suggest alternatives.`,
    };
  }
}
