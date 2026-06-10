import { createFastLLM } from '@/lib/llm';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  createPage,
  getPage,
  updatePage,
  listEventPages,
  getSubmissions,
  type PageField,
} from '@/lib/db/pages';

// ═══════════════════════════════════════════════════════════════════════════════
// FORMS & PAGES AGENT — Creates LIVE web pages stored in DynamoDB
// ═══════════════════════════════════════════════════════════════════════════════

const fieldSchema = z.object({
  name: z.string().describe('Field identifier (e.g. "full_name", "email")'),
  label: z.string().describe('Display label shown to user'),
  type: z.enum(['text', 'email', 'number', 'select', 'textarea', 'rating', 'checkbox', 'date', 'phone'])
    .describe('Input type'),
  required: z.boolean().describe('Whether field is required'),
  options: z.array(z.string()).optional().describe('Options for select/checkbox fields'),
  placeholder: z.string().optional().describe('Placeholder text'),
});

const createPageTool = new DynamicStructuredTool({
  name: 'create_page',
  description: `Create a live web page and store it in DynamoDB. Returns the public URL.
Page types: registration, feedback, checkin, event-page, custom.
Each page is immediately accessible at /p/<pageId>.`,
  schema: z.object({
    type: z.enum(['registration', 'feedback', 'checkin', 'event-page', 'custom'])
      .describe('Page type'),
    title: z.string().describe('Page title displayed at the top'),
    eventId: z.string().describe('Associated event ID'),
    fields: z.array(fieldSchema).describe('Form fields for the page'),
    settings: z.object({
      description: z.string().optional().describe('Page description/subtitle'),
      submitButton: z.string().optional().describe('Submit button text'),
      successMessage: z.string().optional().describe('Message shown after submission'),
      deadline: z.string().optional().describe('Submission deadline (ISO date)'),
      maxResponses: z.number().optional().describe('Maximum number of responses allowed'),
      customCss: z.string().optional().describe('Optional custom CSS'),
      eventDate: z.string().optional().describe('Event date for event pages'),
      eventVenue: z.string().optional().describe('Venue name for event pages'),
      eventAgenda: z.array(z.string()).optional().describe('Agenda items for event pages'),
      registrationLink: z.string().optional().describe('Registration link for event pages'),
    }).describe('Page settings'),
  }),
  func: async ({ type, title, eventId, fields, settings }) => {
    const page = await createPage({
      type,
      title,
      eventId,
      fields: fields as PageField[],
      settings,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    return JSON.stringify({
      success: true,
      pageId: page.id,
      url: `${baseUrl}/p/${page.id}`,
      path: `/p/${page.id}`,
      title: page.title,
      type: page.type,
      fieldCount: page.fields.length,
    });
  },
});

const updatePageTool = new DynamicStructuredTool({
  name: 'update_page',
  description: 'Update an existing page configuration. Can change title, fields, settings, etc.',
  schema: z.object({
    pageId: z.string().describe('ID of the page to update'),
    title: z.string().optional().describe('New title'),
    fields: z.array(fieldSchema).optional().describe('Updated fields array'),
    settings: z.object({
      description: z.string().optional(),
      submitButton: z.string().optional(),
      successMessage: z.string().optional(),
      deadline: z.string().optional(),
      maxResponses: z.number().optional(),
      customCss: z.string().optional(),
      eventDate: z.string().optional(),
      eventVenue: z.string().optional(),
      eventAgenda: z.array(z.string()).optional(),
      registrationLink: z.string().optional(),
    }).optional().describe('Updated settings'),
  }),
  func: async ({ pageId, title, fields, settings }) => {
    const updates: Record<string, unknown> = {};
    if (title) updates.title = title;
    if (fields) updates.fields = fields;
    if (settings) updates.settings = settings;

    const updated = await updatePage(pageId, updates);
    if (!updated) {
      return JSON.stringify({ success: false, error: 'Page not found' });
    }

    return JSON.stringify({
      success: true,
      pageId: updated.id,
      title: updated.title,
      fieldCount: updated.fields.length,
    });
  },
});

const listPagesTool = new DynamicStructuredTool({
  name: 'list_pages',
  description: 'List all pages for a specific event.',
  schema: z.object({
    eventId: z.string().describe('Event ID to list pages for'),
  }),
  func: async ({ eventId }) => {
    const pages = await listEventPages(eventId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    return JSON.stringify({
      count: pages.length,
      pages: pages.map(p => ({
        id: p.id,
        type: p.type,
        title: p.title,
        url: `${baseUrl}/p/${p.id}`,
        submissions: p.submissions,
        createdAt: p.createdAt,
      })),
    });
  },
});

const getSubmissionsTool = new DynamicStructuredTool({
  name: 'get_submissions',
  description: 'Get all form submissions/responses for a page.',
  schema: z.object({
    pageId: z.string().describe('Page ID to get submissions for'),
  }),
  func: async ({ pageId }) => {
    const page = await getPage(pageId);
    if (!page) {
      return JSON.stringify({ success: false, error: 'Page not found' });
    }

    const submissions = await getSubmissions(pageId);
    return JSON.stringify({
      pageTitle: page.title,
      pageType: page.type,
      totalSubmissions: submissions.length,
      submissions: submissions.map(s => ({
        id: s.id,
        data: s.data,
        submittedAt: s.submittedAt,
      })),
    });
  },
});

const tools = [createPageTool, updatePageTool, listPagesTool, getSubmissionsTool];

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are Eventiq's Forms & Pages Agent.
You CREATE working web pages for events: registration forms, feedback surveys, QR check-in pages, event landing pages.
Each page you create is immediately live at a URL the user can share.

When creating forms, include all fields the event needs. Be smart about field types.

PAGE TYPE GUIDELINES:
- **registration**: Always include name (text, required), email (email, required). Add ticket_type (select) if multiple tiers. Add dietary (select: None/Vegetarian/Vegan/Halal/Gluten-free) if food is involved. Add phone (phone) if needed.
- **feedback**: Include overall_rating (rating, required), best_parts (textarea: "What went well?"), improvements (textarea: "What could be improved?"), recommend (select: 1-10 for NPS). Add session-specific ratings if multi-track.
- **checkin**: Just needs the event ID — renders a QR scanner interface. Add minimal fields: attendee_name (text) for manual lookup.
- **event-page**: Use settings for date, venue, agenda. Fields are minimal (maybe just a CTA button). Set eventDate, eventVenue, eventAgenda in settings.
- **custom**: User-defined — ask what fields they need if not specified.

RULES:
- ALWAYS use create_page tool to generate pages — never just describe what you'd create
- Include a helpful description in settings
- Set appropriate submitButton text (e.g. "Register Now", "Submit Feedback", "Check In")
- Set a friendly successMessage
- Use the eventId provided in the task, or "general" if none specified
- Return the URL so it can be shared immediately`;

// ═══════════════════════════════════════════════════════════════════════════════
// STATE & GRAPH
// ═══════════════════════════════════════════════════════════════════════════════

const FormsState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type FormsStateType = typeof FormsState.State;

function createHaiku() {
  return createFastLLM().bindTools(tools);
}

async function agentNode(state: FormsStateType) {
  const llm = createHaiku();
  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

function router(state: FormsStateType): 'tools' | '__end__' {
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

function buildFormsGraph() {
  const toolNode = new ToolNode(tools);
  return new StateGraph(FormsState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', router, { tools: 'tools', __end__: '__end__' })
    .addEdge('tools', 'agent')
    .compile();
}

let compiledGraph: ReturnType<typeof buildFormsGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildFormsGraph();
  }
  return compiledGraph;
}

/**
 * Run the forms & pages agent autonomously.
 * Creates live pages stored in DynamoDB, returns URLs.
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

  return 'Page created successfully. Check the URL returned in the tool output.';
}
