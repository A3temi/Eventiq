import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchExa } from '@/lib/exa';
import { sendEmail } from '@/lib/email';

// ═══════════════════════════════════════════════════════════════════════════════
// VENUE AGENT TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

export const searchVenuesTool = new DynamicStructuredTool({
  name: 'search_venues',
  description: 'Search for event venues in Singapore. Returns real venues with names, descriptions, and URLs.',
  schema: z.object({
    query: z.string().describe('Venue search query (e.g. "meeting room 40 people Tanjong Pagar")'),
    maxResults: z.number().optional().default(5),
  }),
  func: async ({ query, maxResults }) => {
    const results = await searchExa({ query: `${query} venue Singapore`, numResults: maxResults });
    return JSON.stringify(results.map(r => ({
      name: r.title,
      description: r.text.slice(0, 200),
      url: r.url,
      score: r.score,
    })));
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR AGENT TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

export const searchVendorsTool = new DynamicStructuredTool({
  name: 'search_vendors',
  description: 'Search for event service vendors in Singapore (NOT food/catering). Use for: photographers, videographers, AV equipment, decorators, entertainment, florists, transport, emcees, event planners.',
  schema: z.object({
    query: z.string().describe('Vendor search query (e.g. "event photographer corporate Singapore")'),
    category: z.string().describe('Service category: photography, videography, AV, decoration, entertainment, florist, transport, emcee'),
  }),
  func: async ({ query, category }) => {
    const results = await searchExa({ query: `${query} ${category} Singapore`, numResults: 5 });
    return JSON.stringify(results.map(r => ({
      name: r.title,
      description: r.text.slice(0, 200),
      url: r.url,
      category,
      score: r.score,
    })));
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// FOOD AGENT TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

export const searchCateringTool = new DynamicStructuredTool({
  name: 'search_catering',
  description: 'Search ONLY for food catering services in Singapore. Use ONLY when the user specifically asks about food, catering, meals, or dining for their event. Do NOT use for venues, activities, or general event services.',
  schema: z.object({
    query: z.string().describe('Catering search (e.g. "vegetarian buffet 50 pax corporate lunch")'),
    dietaryRequirements: z.string().optional().describe('Dietary needs: halal, vegetarian, vegan, kosher, nut-free'),
    budgetPerPax: z.number().optional().describe('Max budget per person in SGD'),
  }),
  func: async ({ query, dietaryRequirements, budgetPerPax }) => {
    let fullQuery = `${query} catering food Singapore`;
    if (dietaryRequirements) fullQuery += ` ${dietaryRequirements}`;
    if (budgetPerPax) fullQuery += ` under $${budgetPerPax} per pax`;
    const results = await searchExa({ query: fullQuery, numResults: 5 });
    return JSON.stringify(results.map(r => ({
      name: r.title,
      description: r.text.slice(0, 200),
      url: r.url,
      score: r.score,
    })));
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNICATION AGENT TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

export const sendWhatsAppTool = new DynamicStructuredTool({
  name: 'send_whatsapp',
  description: 'Send a WhatsApp message to a phone number. Use when user provides a phone number and wants to contact someone.',
  schema: z.object({
    phoneNumber: z.string().describe('Phone number with country code e.g. +6512345678'),
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
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
});

export const sendEmailTool = new DynamicStructuredTool({
  name: 'send_email',
  description: 'Send an email to any address. Use for vendor inquiries, speaker confirmations, attendee notifications.',
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

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE AGENT TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

export const createScheduleTool = new DynamicStructuredTool({
  name: 'create_schedule',
  description: 'Generate a structured event agenda/timeline. Handles session ordering, transition buffers, and conflict detection.',
  schema: z.object({
    eventName: z.string().describe('Name of the event'),
    date: z.string().describe('Event date (YYYY-MM-DD)'),
    startTime: z.string().describe('Start time (HH:MM, 24h format)'),
    endTime: z.string().describe('End time (HH:MM, 24h format)'),
    sessions: z.array(z.object({
      topic: z.string(),
      speaker: z.string().optional(),
      durationMinutes: z.number(),
      type: z.enum(['keynote', 'talk', 'workshop', 'break', 'networking', 'meal']),
    })).describe('Sessions to schedule in order'),
  }),
  func: async ({ eventName, date, startTime, endTime, sessions }) => {
    const scheduled: any[] = [];
    let currentTime = new Date(`${date}T${startTime}:00+08:00`);
    const endDateTime = new Date(`${date}T${endTime}:00+08:00`);

    for (const session of sessions) {
      const sessionEnd = new Date(currentTime.getTime() + session.durationMinutes * 60000);
      scheduled.push({
        ...session,
        startTime: currentTime.toTimeString().slice(0, 5),
        endTime: sessionEnd.toTimeString().slice(0, 5),
      });
      // 5-minute transition buffer between sessions
      currentTime = new Date(sessionEnd.getTime() + 5 * 60000);
    }

    const overflow = currentTime > endDateTime;
    return JSON.stringify({
      eventName,
      date,
      scheduledSessions: scheduled,
      totalDuration: `${startTime} – ${endTime}`,
      sessionsCount: scheduled.length,
      fitsInTimeSlot: !overflow,
      warning: overflow ? 'Schedule exceeds the end time. Consider shortening sessions.' : null,
    });
  },
});

export const getCurrentDateTimeTool = new DynamicStructuredTool({
  name: 'get_current_datetime',
  description: 'Get current date/time in Singapore (SGT). ALWAYS use this when user mentions relative dates like "this weekend", "tomorrow", "next Friday".',
  schema: z.object({}),
  func: async () => {
    const now = new Date();
    const sgOptions: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Singapore', dateStyle: 'full', timeStyle: 'short' };
    const sgTime = now.toLocaleString('en-SG', sgOptions);
    const sgNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
    const dayOfWeek = sgNow.getDay();

    const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
    const saturday = new Date(sgNow.getTime() + daysUntilSat * 86400000);
    const sunday = new Date(saturday.getTime() + 86400000);
    const tomorrow = new Date(sgNow.getTime() + 86400000);
    const nextMonday = new Date(sgNow.getTime() + ((8 - dayOfWeek) % 7 || 7) * 86400000);

    return JSON.stringify({
      now: sgTime,
      today: sgNow.toISOString().split('T')[0],
      tomorrow: tomorrow.toISOString().split('T')[0],
      thisSaturday: saturday.toISOString().split('T')[0],
      thisSunday: sunday.toISOString().split('T')[0],
      nextMonday: nextMonday.toISOString().split('T')[0],
      timezone: 'Asia/Singapore (SGT, UTC+8)',
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS AGENT TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

export const getBudgetSummaryTool = new DynamicStructuredTool({
  name: 'get_budget_summary',
  description: 'Calculate a budget summary with category breakdown, utilization rates, and over-budget warnings.',
  schema: z.object({
    totalBudget: z.number().describe('Total event budget in SGD'),
    items: z.array(z.object({
      category: z.string(),
      description: z.string(),
      amount: z.number(),
      status: z.enum(['committed', 'estimated', 'paid']),
    })).describe('Budget line items'),
  }),
  func: async ({ totalBudget, items }) => {
    const committed = items.filter(i => i.status === 'committed' || i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0);
    const estimated = items.filter(i => i.status === 'estimated')
      .reduce((sum, i) => sum + i.amount, 0);

    const byCategory = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {} as Record<string, number>);

    return JSON.stringify({
      totalBudget,
      committed,
      estimated,
      remaining: totalBudget - committed,
      utilizationPercent: Math.round((committed / totalBudget) * 100),
      byCategory,
      isOverBudget: committed > totalBudget,
      warning: committed > totalBudget * 0.9 ? 'Budget is over 90% utilized' : null,
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// GENERAL WEB SEARCH — any agent can look up public information
// ═══════════════════════════════════════════════════════════════════════════════

export const webSearchTool = new DynamicStructuredTool({
  name: 'web_search',
  description: 'General internet search for any publicly available information. Use this as your DEFAULT research tool for: pricing, reviews, availability, directions, opening hours, contact details, event ideas, team building activities, comparisons, or anything not specifically venue/vendor/catering. Prefer this over search_catering or search_vendors when the query is general or exploratory.',
  schema: z.object({
    query: z.string().describe('Search query — be specific (e.g. "Marina Bay Sands event space pricing 2025" or "best team building activities Singapore")'),
    numResults: z.number().optional().default(5),
  }),
  func: async ({ query, numResults }) => {
    const results = await searchExa({ query, numResults });
    return JSON.stringify(results.map(r => ({
      title: r.title,
      text: r.text.slice(0, 300),
      url: r.url,
      publishedDate: r.publishedDate,
    })));
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL SETS — each agent gets domain tools + web_search for research
// ═══════════════════════════════════════════════════════════════════════════════

export const venueAgentTools = [searchVenuesTool, getCurrentDateTimeTool, webSearchTool];
export const vendorAgentTools = [searchVendorsTool, webSearchTool];
export const foodAgentTools = [searchCateringTool, webSearchTool];
export const communicationAgentTools = [sendWhatsAppTool, sendEmailTool, webSearchTool];
export const scheduleAgentTools = [createScheduleTool, getCurrentDateTimeTool, webSearchTool];
export const analyticsAgentTools = [getBudgetSummaryTool, webSearchTool];

// Orchestrator has all tools EXCEPT search_catering (which is food-agent only)
// This prevents the orchestrator from mis-categorizing general searches as food
export const allTools = [
  searchVenuesTool,
  searchVendorsTool,
  sendWhatsAppTool,
  sendEmailTool,
  getCurrentDateTimeTool,
  createScheduleTool,
  getBudgetSummaryTool,
  webSearchTool,
];
