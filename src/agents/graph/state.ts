import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

/**
 * Shared state for the multi-agent graph.
 * The orchestrator reads user intent and routes to specialized agents.
 * Each agent writes its results back to state.
 */
export const AgentState = Annotation.Root({
  // Full conversation (accumulates across all nodes)
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Routing: which agent(s) should execute next
  nextAgent: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => 'orchestrator',
  }),

  // Event context extracted by orchestrator
  eventId: Annotation<string>({
    reducer: (_prev, next) => next || _prev,
    default: () => '',
  }),
  eventName: Annotation<string>({
    reducer: (_prev, next) => next || _prev,
    default: () => '',
  }),
  eventDate: Annotation<string>({
    reducer: (_prev, next) => next || _prev,
    default: () => '',
  }),
  attendeeCount: Annotation<number>({
    reducer: (_prev, next) => next || _prev,
    default: () => 0,
  }),
  selectedVenue: Annotation<string>({
    reducer: (_prev, next) => next || _prev,
    default: () => '',
  }),
  budgetTotal: Annotation<string>({
    reducer: (_prev, next) => next || _prev,
    default: () => '',
  }),

  // Tools that were used across all agents in this turn
  toolsUsed: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Final response to user (written by the last agent to run)
  response: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
});

export type AgentStateType = typeof AgentState.State;
