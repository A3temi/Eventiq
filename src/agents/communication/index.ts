import { ChatBedrockConverse } from '@langchain/aws';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNICATION AGENT — WhatsApp + Email messaging
// ═══════════════════════════════════════════════════════════════════════════════

const sendWhatsAppTool = new DynamicStructuredTool({
  name: 'send_whatsapp',
  description: 'Send a WhatsApp message to a phone number via WAHA API.',
  schema: z.object({
    phoneNumber: z.string().describe('Phone number with country code (e.g. +6512345678)'),
    message: z.string().describe('Message content to send'),
  }),
  func: async ({ phoneNumber, message }) => {
    const wahaUrl = process.env.WAHA_API_URL || 'http://localhost:3000';
    const apiKey = process.env.WAHA_API_KEY || '';
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');

    try {
      const response = await fetch(`${wahaUrl}/api/sendText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({
          session: process.env.WAHA_SESSION_NAME || 'default',
          chatId: `${cleanNumber}@c.us`,
          text: message,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify({ success: false, error: `HTTP ${response.status}: ${errorText}` });
      }
      const data = await response.json();
      return JSON.stringify({ success: true, recipient: phoneNumber, messageId: data.id });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      return JSON.stringify({ success: false, error: errMsg });
    }
  },
});

const sendEmailTool = new DynamicStructuredTool({
  name: 'send_email',
  description: 'Send an email to any address. For vendor inquiries, speaker confirmations, attendee notifications.',
  schema: z.object({
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body (plain text)'),
  }),
  func: async ({ to, subject, body }) => {
    const result = await sendEmail({ to, subject, text: body });
    return JSON.stringify(result);
  },
});

const draftMessageTool = new DynamicStructuredTool({
  name: 'draft_message',
  description: 'Draft a professional message without sending it. Returns the drafted text for review.',
  schema: z.object({
    recipient: z.string().describe('Who the message is for (name or role)'),
    purpose: z.string().describe('Purpose of the message (e.g. "venue inquiry", "invitation", "follow-up")'),
    context: z.string().describe('Event details and context to include'),
    channel: z.enum(['whatsapp', 'email']).describe('Target channel — affects tone and length'),
  }),
  func: async ({ recipient, purpose, context, channel }) => {
    return JSON.stringify({
      drafted: true,
      recipient,
      purpose,
      channel,
      note: `Draft created for ${recipient} via ${channel}. Purpose: ${purpose}. Context: ${context}`,
    });
  },
});

const tools = [sendWhatsAppTool, sendEmailTool, draftMessageTool];

const SYSTEM_PROMPT = `You are Eventiq's Communication Agent for Singapore.

Your job: Send messages via WhatsApp and Email. Draft professional, warm messages appropriate for Singapore business culture.

CAPABILITIES:
- send_whatsapp: Send WhatsApp messages (needs phone number with country code, e.g. +65...)
- send_email: Send emails (needs email address, subject, body)
- draft_message: Draft a message without sending (for review)

BEHAVIOR:
1. Parse the task to identify: recipients, channel (WhatsApp/email), purpose
2. Craft appropriate messages — professional but warm for Singapore culture
3. Send to ALL specified recipients
4. After sending, report: who was contacted, what was sent, delivery status

MESSAGE GUIDELINES:
- WhatsApp: Concise, friendly, use emojis sparingly. Include key details upfront.
- Email: Professional with proper greeting/signature. Include event name, date, headcount.
- Vendor inquiries: Ask for availability, pricing, and any package options
- Invitations: Include date, time, venue, RSVP instructions
- Follow-ups: Reference previous contact, ask specific questions

RULES:
- Phone numbers → send_whatsapp
- Email addresses → send_email
- If both are provided, send via the channel the user specifies (default: WhatsApp for individuals, email for vendors)
- NEVER fabricate recipient details — use exactly what is provided
- After sending, confirm delivery status for each recipient`;

const CommunicationState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type CommunicationStateType = typeof CommunicationState.State;

function createHaiku() {
  return new ChatBedrockConverse({
    model: 'us.anthropic.claude-3-haiku-20240307-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    temperature: 0.3,
    maxTokens: 2048,
  }).bindTools(tools);
}

async function agentNode(state: CommunicationStateType) {
  const llm = createHaiku();
  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

function router(state: CommunicationStateType): 'tools' | '__end__' {
  const last = state.messages[state.messages.length - 1];
  if (
    last &&
    'tool_calls' in last &&
    Array.isArray((last as any).tool_calls) &&
    (last as any).tool_calls.length > 0
  ) {
    return 'tools';
  }
  return '__end__';
}

function buildCommunicationGraph() {
  const toolNode = new ToolNode(tools);
  return new StateGraph(CommunicationState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', router, { tools: 'tools', __end__: '__end__' })
    .addEdge('tools', 'agent')
    .compile();
}

let compiledGraph: ReturnType<typeof buildCommunicationGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildCommunicationGraph();
  }
  return compiledGraph;
}

/**
 * Run the communication agent autonomously.
 */
export async function run(task: string): Promise<string> {
  const graph = getGraph();
  const result = await graph.invoke({
    messages: [new HumanMessage(task)],
  });

  const aiMessages = result.messages.filter((m: BaseMessage) => m._getType?.() === 'ai');
  for (let i = aiMessages.length - 1; i >= 0; i--) {
    const content = aiMessages[i].content;
    if (typeof content === 'string' && content.trim().length > 10) {
      const hasToolCalls = 'tool_calls' in aiMessages[i] &&
        Array.isArray((aiMessages[i] as any).tool_calls) &&
        (aiMessages[i] as any).tool_calls.length > 0;
      if (!hasToolCalls) return content;
    }
  }

  for (let i = aiMessages.length - 1; i >= 0; i--) {
    const content = aiMessages[i].content;
    if (typeof content === 'string' && content.trim().length > 0) {
      return content;
    }
  }

  return 'Communication agent completed but no response was generated.';
}
