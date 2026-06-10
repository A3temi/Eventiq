import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchExa } from '@/lib/exa';
import { sendEmail } from '@/lib/email';

/**
 * LangChain-compatible tools for the agents.
 */

export const searchVenuesTool = new DynamicStructuredTool({
  name: 'search_venues',
  description: 'Search for event venues in Singapore. Returns real venues with details.',
  schema: z.object({
    query: z.string().describe('Search query (e.g. "meeting room 40 people Tanjong Pagar")'),
    maxResults: z.number().optional().default(5),
  }),
  func: async ({ query, maxResults }) => {
    const results = await searchExa({ query: `${query} venue Singapore`, numResults: maxResults });
    return JSON.stringify(results.map(r => ({
      name: r.title,
      description: r.text.slice(0, 150),
      url: r.url,
    })));
  },
});

export const searchVendorsTool = new DynamicStructuredTool({
  name: 'search_vendors',
  description: 'Search for event vendors/caterers in Singapore.',
  schema: z.object({
    query: z.string().describe('Search query (e.g. "halal catering 40 pax")'),
    category: z.string().describe('Category: catering, photography, AV, decoration'),
  }),
  func: async ({ query, category }) => {
    const results = await searchExa({ query: `${query} ${category} Singapore`, numResults: 5 });
    return JSON.stringify(results.map(r => ({
      name: r.title,
      description: r.text.slice(0, 150),
      url: r.url,
      category,
    })));
  },
});

export const sendWhatsAppTool = new DynamicStructuredTool({
  name: 'send_whatsapp',
  description: 'Send a WhatsApp message to a phone number.',
  schema: z.object({
    phoneNumber: z.string().describe('Phone with country code e.g. +6512345678'),
    message: z.string().describe('Message to send'),
  }),
  func: async ({ phoneNumber, message }) => {
    const wahaUrl = process.env.WAHA_API_URL || 'http://100.53.19.175:3000';
    const apiKey = process.env.WAHA_API_KEY || 'eventiq2025';
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
      if (!response.ok) return JSON.stringify({ success: false, error: `HTTP ${response.status}` });
      return JSON.stringify({ success: true, recipient: phoneNumber });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
});

export const sendEmailTool = new DynamicStructuredTool({
  name: 'send_email',
  description: 'Send an email to anyone.',
  schema: z.object({
    to: z.string().describe('Recipient email'),
    subject: z.string().describe('Subject line'),
    body: z.string().describe('Email body'),
  }),
  func: async ({ to, subject, body }) => {
    const result = await sendEmail({ to, subject, text: body });
    return JSON.stringify(result);
  },
});

export const getCurrentDateTimeTool = new DynamicStructuredTool({
  name: 'get_current_datetime',
  description: 'Get current date/time in Singapore. Use for "this weekend", "tomorrow" etc.',
  schema: z.object({}),
  func: async () => {
    const now = new Date();
    const sgTime = now.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'full', timeStyle: 'short' });
    const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
    const saturday = new Date(now.getTime() + daysUntilSat * 86400000);
    const sunday = new Date(saturday.getTime() + 86400000);
    return JSON.stringify({
      now: sgTime,
      thisSaturday: saturday.toISOString().split('T')[0],
      thisSunday: sunday.toISOString().split('T')[0],
    });
  },
});

// Tool sets per agent
export const orchestratorTools = [getCurrentDateTimeTool];
export const venueTools = [searchVenuesTool];
export const vendorTools = [searchVendorsTool];
export const communicationTools = [sendWhatsAppTool, sendEmailTool];
export const allTools = [searchVenuesTool, searchVendorsTool, sendWhatsAppTool, sendEmailTool, getCurrentDateTimeTool];
