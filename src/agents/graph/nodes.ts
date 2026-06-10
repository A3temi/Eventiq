import { ChatBedrockConverse } from '@langchain/aws';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { allTools, venueTools, vendorTools, communicationTools, orchestratorTools } from './tools';
import type { AgentStateType } from './state';

/**
 * Create a Bedrock LLM instance with tool binding.
 */
function createLLM(tools: any[] = []) {
  const llm = new ChatBedrockConverse({
    model: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    temperature: 0.3,
    maxTokens: 4096,
  });

  if (tools.length > 0) {
    return llm.bindTools(tools);
  }
  return llm;
}

/**
 * Orchestrator node — the brain that decides what to do and delegates.
 */
export async function orchestratorNode(state: AgentStateType) {
  const llm = createLLM(allTools);

  const systemMsg = new SystemMessage(`You are Eventiq, an autonomous AI event planning orchestrator for Singapore.

You coordinate specialized sub-agents and take REAL actions using tools:
- search_venues: Find real venues via Exa web search (returns images, location, pricing)
- search_vendors: Find real caterers, photographers, AV companies (returns images, pricing)
- send_whatsapp: Send actual WhatsApp messages to people
- send_email: Send real emails
- get_current_datetime: Check today's date for scheduling
- save_event_details: Save confirmed decisions to the event record

CRITICAL RULES:
1. ALWAYS use get_current_datetime when user says "this weekend", "tomorrow", etc.
2. Use the EXACT numbers the user gives (40 people = search for 40, not 50)
3. When user provides phone numbers, USE send_whatsapp to actually message them
4. When searching for food/venues, USE search_vendors/search_venues with real queries
5. Be proactive — take action rather than just suggesting
6. YOU CAN AND SHOULD CALL TOOLS MULTIPLE TIMES:
   - First search for catering options
   - Then search for venues separately
   - Then check the date
   - Then message people on WhatsApp
   Don't just call one tool and stop. Chain multiple searches to fully plan the event.
7. Present options as STRUCTURED NUMBERED LISTS with this format:
   N. **Name** - Short description
   Price: $XX/pax or $XX total
   Location: Address in Singapore
   URL: https://...
8. After taking actions, summarize what you did and ask for ONE next step
9. When user confirms a choice, call save_event_details to update the whiteboard

IMPORTANT: When the user CONFIRMS a choice (selects catering, picks a date, chooses a venue):
- Call save_event_details with the confirmed field and value
- This updates the whiteboard in real-time

When presenting options, ask ONE question at a time. Don't dump everything at once.
Present the most important decision first, then move to the next after user confirms.

ALWAYS include Location info in your response for venues/caterers so the map feature works.

You operate in Singapore (SGT, UTC+8). Currency is SGD.`);

  const response = await llm.invoke([systemMsg, ...state.messages]);

  return { messages: [response], response: typeof response.content === 'string' ? response.content : '' };
}

/**
 * Tool execution node — runs tools called by agents.
 */
export const toolNode = new ToolNode(allTools);

/**
 * Router — decides if we should call tools or end.
 */
export function shouldContinue(state: AgentStateType): 'tools' | '__end__' {
  const lastMessage = state.messages[state.messages.length - 1];

  // If the last message has tool calls, route to tools
  if (lastMessage && 'tool_calls' in lastMessage && (lastMessage as any).tool_calls?.length > 0) {
    return 'tools';
  }

  return '__end__';
}
