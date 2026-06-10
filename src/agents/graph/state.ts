import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

/**
 * The shared state for the multi-agent graph.
 * Every node reads/writes to this state.
 */
export const AgentState = Annotation.Root({
  // Conversation messages (accumulates)
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Which agent should handle next
  nextAgent: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => 'orchestrator',
  }),

  // Event context
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
  venue: Annotation<string>({
    reducer: (_prev, next) => next || _prev,
    default: () => '',
  }),
  budget: Annotation<string>({
    reducer: (_prev, next) => next || _prev,
    default: () => '',
  }),

  // Tool results
  searchResults: Annotation<any[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // Final response to user
  response: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
});

export type AgentStateType = typeof AgentState.State;
