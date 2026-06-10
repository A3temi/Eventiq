import { generateText } from 'ai';
import { fastModel } from '@/lib/ai-gateway';
import { sendEmail, sendConversationEmail } from '@/lib/email';
import { logCommunication } from '@/lib/db/communications';
import type { AgentTask } from '@/types/agents';
import type { EventBrief } from '@/types/event';

interface DelegationResult {
  success: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

export async function handleCommunicationTask(
  task: AgentTask,
  event: EventBrief,
  userId: string
): Promise<DelegationResult> {
  const params = task.parameters;
  const recipient = params.recipient as string;
  const channel = (params.channel as 'email' | 'whatsapp') || 'email';
  const messageType = (params.messageType as string) || 'general';
  const previousMessageId = params.previousMessageId as string | undefined;

  // Validate contact info
  if (!recipient) {
    return {
      success: false,
      summary: 'I need a recipient email or phone number to send a message. Could you provide the contact details?',
    };
  }

  // Compose message using AI
  const { text: composedMessage } = await generateText({
    model: fastModel,
    system: `You are a professional event communication assistant. Compose messages that are friendly, concise, and include all necessary details. Always include a clear call-to-action. Sign off as "Eventiq - AI Event Assistant".`,
    prompt: `Compose a ${channel} ${messageType} message for event "${event.name}" (${event.date || 'date TBD'}).
Recipient: ${recipient}
Context: ${JSON.stringify(params)}
Event type: ${event.type}, attendees: ${event.attendeeCount}
Keep it under 300 words for email, 160 characters for WhatsApp.`,
    maxOutputTokens: 500,
  });

  // Send via appropriate channel
  let sendResult: { success: boolean; messageId?: string; error?: string };

  if (channel === 'email') {
    const subject = composeSubject(messageType, event.name);

    if (previousMessageId) {
      // Reply in thread
      sendResult = await sendConversationEmail({
        to: recipient,
        subject: `Re: ${subject}`,
        body: composedMessage,
        previousMessageId,
      });
    } else {
      // New email
      sendResult = await sendEmail({
        to: recipient,
        subject,
        text: composedMessage,
      });
    }
  } else {
    sendResult = await sendWhatsApp(recipient, composedMessage);
  }

  // Log communication
  await logCommunication(event.id, {
    recipient,
    channel,
    contentSummary: composedMessage.slice(0, 100),
    status: sendResult.success ? 'sent' : 'failed',
    relatedAgent: 'communication',
  });

  if (sendResult.success) {
    return {
      success: true,
      summary: `✉️ ${channel === 'email' ? 'Email' : 'WhatsApp'} sent to ${recipient}:\n\n"${composedMessage.slice(0, 200)}${composedMessage.length > 200 ? '...' : ''}"`,
      data: { messageId: sendResult.messageId, channel },
    };
  }

  // Suggest fallback channel
  const fallback = channel === 'email' ? 'WhatsApp' : 'email';
  return {
    success: false,
    summary: `Failed to send ${channel} message to ${recipient}: ${sendResult.error}. Would you like me to try via ${fallback} instead?`,
  };
}

function composeSubject(messageType: string, eventName: string): string {
  switch (messageType) {
    case 'vendor_inquiry': return `Event Inquiry — ${eventName}`;
    case 'speaker_confirmation': return `Speaker Confirmation — ${eventName}`;
    case 'attendee_confirmation': return `Registration Confirmed — ${eventName}`;
    case 'follow_up': return `Follow-up — ${eventName}`;
    case 'negotiation': return `Re: Pricing Discussion — ${eventName}`;
    default: return `${eventName} — Event Update`;
  }
}

async function sendWhatsApp(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const wahaUrl = process.env.WAHA_API_URL || 'http://100.53.19.175:3000';
    const apiKey = process.env.WAHA_API_KEY || 'eventiq2025';

    const response = await fetch(`${wahaUrl}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        session: process.env.WAHA_SESSION_NAME || 'default',
        chatId: `${to.replace(/[^0-9]/g, '')}@c.us`,
        text: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`WAHA API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'WhatsApp send failed' };
  }
}
