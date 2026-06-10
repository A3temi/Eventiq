# Implementation Plan: AI Event Organizer

## Overview

A multi-agent event planning system with a Chat + Whiteboard UI built on Next.js (Vercel), Vercel AI SDK Workflows for orchestration, and AWS serverless backend. The implementation proceeds from infrastructure setup → core data layer → agent framework → specialized agents → frontend → integration wiring.

## Tasks

- [ ] 1. Project scaffolding and core infrastructure
  - [ ] 1.1 Initialize Next.js 14 project with TypeScript, Tailwind CSS, shadcn/ui, and configure project structure
    - Create Next.js App Router project with `src/` directory
    - Install dependencies: `ai`, `@ai-sdk/openai`, `zustand`, `framer-motion`, `reactflow`, `lucide-react`, `sonner`, `react-dropzone`, `qrcode.react`, `recharts`, `next-auth`, `stripe`, `@stripe/stripe-js`
    - Configure Tailwind with shadcn/ui theme (light theme, professional)
    - Set up directory structure: `src/app/`, `src/components/`, `src/lib/`, `src/agents/`, `src/types/`, `src/hooks/`
    - Create `.env.local` with all environment variables from `.env`
    - _Requirements: 19.2, 19.6_

  - [ ] 1.2 Define shared TypeScript interfaces and types
    - Create `src/types/event.ts` with EventBrief, EventSummary, ConversationContext interfaces
    - Create `src/types/agents.ts` with AgentType, AgentTask, Intent, TaskResult, ReasoningStep interfaces
    - Create `src/types/chat.ts` with ChatMessage, FileAttachment, ApprovalRequest interfaces
    - Create `src/types/whiteboard.ts` with WhiteboardState, WhiteboardNode, WhiteboardEdge interfaces
    - Create `src/types/payment.ts` with BudgetStatus, CategoryBudget, CreditBalance, CheckoutLineItem interfaces
    - Create `src/types/attendee.ts` with RegistrationConfig, TicketType, CheckInResult, AttendeeRecord interfaces
    - Create `src/types/communication.ts` with EmailParams, WhatsAppParams, MessageResult, ContactInfo interfaces
    - Create `src/types/schedule.ts` with Agenda, ScheduledSession, SessionInput, ConflictResult interfaces
    - _Requirements: 1.1, 1.3, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1_

  - [ ] 1.3 Set up Vercel AI Gateway configuration and AI SDK client
    - Create `src/lib/ai-gateway.ts` with Vercel AI Gateway client configuration
    - Configure primary model (Claude Sonnet) and fallback model (GPT-4o)
    - Set up caching, rate limiting, and observability options
    - Create helper functions for routed LLM calls that all agents will use
    - _Requirements: 19.1, 19.4, 19.5_

  - [ ] 1.4 Set up AWS DynamoDB table schemas and data access layer
    - Create `src/lib/dynamodb.ts` with DynamoDB client configuration
    - Create `src/lib/db/events.ts` with CRUD operations for Events table (PK: EVENT#{id}, SK: METADATA)
    - Create `src/lib/db/conversations.ts` for Conversations table operations
    - Create `src/lib/db/tasks.ts` for Agent Tasks table operations
    - Create `src/lib/db/payments.ts` for Payments table operations
    - Create `src/lib/db/credits.ts` for Credits and Credit Transactions table operations
    - Create `src/lib/db/attendees.ts` for Attendees table operations
    - Create `src/lib/db/communications.ts` for Communications Log table operations
    - Create `src/lib/db/audit.ts` for Audit Log table operations
    - Include GSI definitions: UserEventsIndex, EventStatusIndex, QRCodeIndex
    - Set 90-day TTL on conversation and task records
    - _Requirements: 1.6, 15.5_

  - [ ]* 1.5 Write property tests for data layer record completeness
    - **Property 10: Record completeness invariant**
    - **Validates: Requirements 5.4, 7.3, 15.5**

- [ ] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Orchestrator agent and core workflow engine
  - [ ] 3.1 Implement Orchestrator Agent with Vercel AI SDK Workflows
    - Create `src/agents/orchestrator/index.ts` with main orchestrator workflow
    - Implement `parseIntent()` using AI Gateway to classify user messages into Intent types
    - Implement `createEventBrief()` to extract structured Event_Brief from natural language
    - Implement missing-field detection that prompts user for exactly the required missing fields (event type, date, attendee count, budget range)
    - Implement `delegateTask()` to route tasks to correct specialized agent based on category
    - Use Vercel AI SDK Workflows for multi-step orchestration with streaming
    - _Requirements: 1.1, 1.2, 1.3, 19.2, 19.3_

  - [ ]* 3.2 Write property test for missing field detection
    - **Property 1: Missing field detection triggers prompts for exactly the missing fields**
    - **Validates: Requirements 1.2, 2.6, 14.6**

  - [ ]* 3.3 Write property test for task routing correctness
    - **Property 2: Task routing correctness**
    - **Validates: Requirements 1.3**

  - [ ] 3.4 Implement agent status tracking and progress reporting
    - Create `src/agents/orchestrator/tracking.ts` with task progress tracking
    - Implement status update emission every 30 seconds during active processing
    - Implement failure detection, retry (once within 15 seconds), and user notification with suggested alternatives
    - Store reasoning traces per task step with agent name, action, rationale, data sources, timestamps
    - _Requirements: 1.4, 1.5, 10.1, 10.2, 10.3_

  - [ ] 3.5 Implement Human Approval Gate system
    - Create `src/agents/orchestrator/approval.ts` with approval request/response logic
    - Implement approval triggering for payments > 50 SGD, binding commitments, and bulk messages > 10 recipients
    - Implement approval queue with creation-time sorting
    - Implement approve action (resume within 2 seconds) and reject action (preserve prior work, ask for alternatives)
    - Implement 24-hour reminder for unanswered approvals without expiry
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 3.6 Write property tests for approval system
    - **Property 22: Approval rejection preserves prior work**
    - **Property 23: Pending approvals sorted by creation time**
    - **Validates: Requirements 11.4, 11.6**

  - [ ] 3.7 Implement conversation context persistence
    - Create `src/agents/orchestrator/context.ts` with session management
    - Persist Event_Brief and all agent interactions for 90 days
    - Implement context loading on session resume
    - Integrate Headroom-inspired compression for long sessions to stay within context limits
    - _Requirements: 1.6_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Payment and credits system
  - [ ] 5.1 Implement Payment Agent - Stripe platform checkout
    - Create `src/agents/payment/index.ts` with Payment Agent
    - Implement `generateEventCheckout()` creating Stripe Checkout Session with all confirmed event costs as line items in SGD
    - Implement checkout success handler: record payment with total, breakdown, session ID, timestamp; mark costs as "paid"
    - Implement checkout failure/abandonment handler: notify user, retain items for retry
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 5.2 Implement Payment Agent - Credit system
    - Create `src/agents/payment/credits.ts` with credit purchase and deduction logic
    - Implement `generateCreditPurchase()` with package options (50/$5, 200/$18, 500/$40 SGD)
    - Implement credit balance tracking: purchase adds credits, operations deduct credits
    - Implement zero-balance pause: halt agent execution, notify user, present purchase link
    - Define credit costs per operation (Exa: 2, Stagehand: 5, email: 1, WhatsApp: 1, LLM: 1)
    - _Requirements: 4.4, 4.5, 4.6, 4.7_

  - [ ]* 5.3 Write property test for credit deduction accuracy
    - **Property 9: Credit deduction accuracy**
    - **Validates: Requirements 4.6, 4.7**

  - [ ]* 5.4 Write property test for credit balance never negative
    - **Property 37: Credit balance never goes negative**
    - **Validates: Requirements 4.6, 4.7**

  - [ ] 5.5 Implement Payment Agent - Stripe Connect for ticket revenue
    - Create `src/agents/payment/connect.ts` with Stripe Connect integration
    - Implement `connectUserStripe()` generating onboarding link for user's Stripe account
    - Implement `generateTicketCheckout()` processing ticket payments through connected account
    - Block paid ticket creation if Stripe Connect not configured
    - _Requirements: 4.8, 4.9, 4.10_

  - [ ]* 5.6 Write property test for Stripe Connect requirement
    - **Property 36: Stripe Connect requirement for paid tickets**
    - **Validates: Requirements 4.8, 4.9, 5.8**

  - [ ] 5.7 Implement Budget tracking and management
    - Create `src/agents/payment/budget.ts` with budget lifecycle logic
    - Implement budget allocation with default percentages by event type (venue, catering, AV, marketing, speakers, contingency)
    - Implement budget tracker: committed vs spent tracking, remaining = allocated - committed - spent
    - Implement 80% warning threshold notifications
    - Implement over-budget halt with reallocation suggestions (from categories < 50% utilization)
    - Implement reallocation ensuring total always equals overall event budget
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 5.8 Write property tests for budget calculations
    - **Property 6: Budget remaining calculation**
    - **Property 19: Budget allocation sums to total**
    - **Property 20: Budget warning threshold at 80%**
    - **Property 21: Over-budget halts payments**
    - **Validates: Requirements 4.3, 9.1, 9.2, 9.3, 9.4, 9.6**

  - [ ]* 5.9 Write property test for payment summary aggregation
    - **Property 7: Payment summary aggregation correctness**
    - **Validates: Requirements 4.5, 9.5**

  - [ ]* 5.10 Write property test for payment approval threshold
    - **Property 8: Payment approval threshold**
    - **Validates: Requirements 4.1, 11.1**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Venue and vendor agents with Exa integration
  - [ ] 7.1 Implement Exa search client and query builder
    - Create `src/lib/exa.ts` with Exa API client wrapper
    - Implement query construction with Singapore location constraint and minimum 2 Event_Brief keywords
    - Implement structured data extraction from results (name, contact, pricing, ratings, availability)
    - Implement data freshness check (flag results older than 30 days)
    - Implement zero-result retry with broader terms
    - Deduct credits per search operation
    - _Requirements: 12.1, 12.2, 12.5, 12.6_

  - [ ]* 7.2 Write property tests for Exa query construction
    - **Property 24: Exa query construction includes required constraints**
    - **Property 25: Data freshness warning for stale results**
    - **Validates: Requirements 12.1, 12.5**

  - [ ] 7.3 Implement Venue Agent
    - Create `src/agents/venue/index.ts` with Venue Agent
    - Implement `searchVenues()` retrieving up to 10 venue options with name, location, capacity, pricing (SGD), availability, amenities
    - Implement `compareVenues()` with scoring: capacity match (within 20%), budget fit, location preference
    - Implement `initiateBookingInquiry()` delegating to Communication Agent
    - Implement search parameter relaxation order: location → capacity +25% → budget +20%
    - Validate sufficient search criteria before initiating (date, attendee count, budget)
    - Store searched venues for session duration
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 7.4 Write property tests for venue scoring
    - **Property 3: Venue scoring and ranking consistency**
    - **Property 4: Search parameter relaxation order**
    - **Validates: Requirements 2.2, 2.4**

  - [ ] 7.5 Implement Vendor Agent
    - Create `src/agents/vendor/index.ts` with Vendor Agent
    - Implement `searchVendors()` finding 3-10 vendors per service category with ratings, pricing, contacts
    - Implement vendor negotiation logic: max 3 counter-offers, approval gate at > 80% category budget
    - Implement vendor agreement summary generation for user confirmation
    - Implement unresponsive vendor handling: follow-up at 48h, mark unresponsive at 96h, suggest alternative
    - Implement search broadening: budget +20%, location radius expansion
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 7.6 Write property test for negotiation invariants
    - **Property 5: Negotiation counter-offer invariants**
    - **Validates: Requirements 3.3**

  - [ ] 7.7 Implement Food/Catering vendor search and ordering flow
    - Create `src/agents/vendor/catering.ts` with catering-specific logic
    - Implement catering search: up to 5 options with menu, per-pax pricing, dietary support, lead time
    - Implement multi-vendor split suggestion when dietary needs require it (max 3 vendors)
    - Implement catering budget overrun warning before approval gate
    - _Requirements: 13.1, 13.4, 13.5, 13.6_

  - [ ]* 7.8 Write property test for catering budget overrun warning
    - **Property 35: Catering budget overrun warning**
    - **Validates: Requirements 13.6**

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Communication, schedule, and attendee agents
  - [ ] 9.1 Implement Communication Agent
    - Create `src/agents/communication/index.ts` with Communication Agent
    - Implement channel selection based on recipient's stored preferred contact method
    - Implement email sending via AWS SES with event context (name, dates, recipient-specific details, CTA)
    - Implement WhatsApp sending via WAHA API
    - Implement Stagehand-based web navigation for form filling / venue website interaction
    - Implement bulk message approval gate (> 10 recipients)
    - Implement message logging: timestamp, recipient, channel, content summary, delivery status
    - Implement reply parsing within 72 hours and follow-up suggestion
    - Implement delivery failure retry (once after 5 min) and fallback channel suggestion
    - Validate contact info before sending; block and notify user if missing/invalid
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 3.2_

  - [ ]* 9.2 Write property tests for communication agent
    - **Property 13: Communication channel selection**
    - **Property 14: Bulk message approval threshold**
    - **Property 15: Contact validation blocks sends**
    - **Validates: Requirements 7.1, 7.2, 7.6**

  - [ ] 9.3 Implement Schedule Agent
    - Create `src/agents/schedule/index.ts` with Schedule Agent
    - Implement `createDraftAgenda()` with time allocation: keynote 45min, talk 20min, workshop 60min, break 15min, +5min transition buffers
    - Implement `detectConflicts()` flagging overlapping sessions in same track immediately on any modification
    - Implement `proposeAlternativeSlots()` generating up to 3 conflict-free alternatives respecting speaker constraints
    - Implement `finalizeAgenda()` generating public agenda page and internal run-of-show document
    - Send speaker confirmation messages via Communication Agent (date, time SGT, duration, topic, venue)
    - Send reminder for unconfirmed slots after 72 hours
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 9.4 Write property tests for schedule agent
    - **Property 16: Schedule time slot allocation**
    - **Property 17: Schedule conflict detection (no false negatives)**
    - **Property 18: Alternative slot proposals are conflict-free**
    - **Validates: Requirements 8.1, 8.3, 8.5**

  - [ ] 9.5 Implement Attendee Agent - Registration and ticketing
    - Create `src/agents/attendee/index.ts` with Attendee Agent
    - Implement `createRegistrationForm()` with ticket types (free, paid, VIP), capacity limits, custom fields
    - Implement `processRegistration()` storing attendee record with name, email, ticket type, payment status, QR code
    - Enforce capacity limits by rejecting over-capacity registrations
    - For paid tickets: trigger Payment Agent via Stripe Connect, issue confirmation email with QR code
    - For free tickets: store registration, issue confirmation email with QR code
    - Implement 15-minute hold for failed payments with retry link, then release capacity on expiry
    - Block paid ticket creation without Stripe Connect
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 9.6 Write property test for attendee statistics
    - **Property 11: Attendee statistics correctness**
    - **Validates: Requirements 5.5**

  - [ ] 9.7 Implement Attendee Agent - Check-in and badge generation
    - Create `src/agents/attendee/checkin.ts` with check-in logic
    - Implement `validateCheckIn()` validating QR code within 3 seconds SLA
    - Return correct status: success, duplicate_checkin, invalid_code, unregistered
    - Implement `generateBadge()` with attendee name, organization, ticket type, event branding (digital + print)
    - Implement check-in dashboard: total checked in, pending arrivals, rate per 15-min interval (updates within 5 seconds)
    - Handle database unavailable with "temporarily unavailable" error
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 9.8 Write property test for QR code validation
    - **Property 12: QR code validation correctness**
    - **Validates: Requirements 6.1, 6.3**

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Analytics, marketing, compliance, and sponsor agents
  - [ ] 11.1 Implement Analytics Agent
    - Create `src/agents/analytics/index.ts` with Analytics Agent
    - Implement auto-generation of attendance report 24h after event end: registered, checked-in, no-show %, 15-min interval distribution
    - Implement feedback summarization: up to 5 themes, sentiment 1-5, up to 5 recommendations (min 5 responses required)
    - Implement ROI calculation: total spend vs revenue, cost per attendee, category variance (actual vs planned %)
    - Implement report export in PDF and CSV formats with charts/visualizations (recharts)
    - Handle missing data gracefully: show available sections, indicate what's missing
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [ ]* 11.2 Write property tests for analytics
    - **Property 32: ROI calculation correctness**
    - **Property 33: Feedback threshold enforcement**
    - **Validates: Requirements 17.3, 17.4**

  - [ ] 11.3 Implement Marketing and Event Page generation
    - Create `src/agents/orchestrator/marketing.ts` with content generation logic
    - Implement social media post generation per platform with character limit enforcement (Twitter 280, LinkedIn 3000, Instagram 2200)
    - Implement responsive HTML event page generation (320px-1920px) with event name, date, venue, agenda, registration link, sponsor logos
    - Implement email campaign copy generation (announcement, 1-week reminder, 1-day reminder, post-event thank-you)
    - All generated content goes through Human Approval Gate before publishing
    - Validate Event_Brief has required fields (name, date, venue) before generation
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ]* 11.4 Write property test for social media character limits
    - **Property 26: Social media character limit enforcement**
    - **Validates: Requirements 14.1**

  - [ ] 11.5 Implement Singapore Compliance awareness
    - Create `src/agents/orchestrator/compliance.ts` with regulation checking logic
    - Implement triggers: outdoor activities → NEA permit, >5000 attendees → SPF permit, broadcasting → IMDA license, food service → SFA license
    - Present all applicable regulations in a single response when Event_Brief is created/updated
    - Include issuing authority, processing time, application steps, recommended lead time
    - Flag permits with < 4 weeks remaining before event date
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ]* 11.6 Write property tests for compliance
    - **Property 30: Compliance regulation batching**
    - **Property 31: Permit lead time warning**
    - **Validates: Requirements 16.4, 16.5**

  - [ ] 11.7 Implement Sponsor Management
    - Create `src/agents/orchestrator/sponsors.ts` with sponsor package management
    - Implement sponsorship tier creation (Platinum, Gold, Silver) with benefits, pricing, deliverables checklist
    - Implement Stripe invoice generation via Stripe Connect with 14-day payment terms
    - Implement overdue invoice reminder at 14 days
    - Implement deliverables completion tracking and flagging undelivered items at T-7 days
    - Implement sponsor summary: tier, payment status, deliverables completion %
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [ ]* 11.8 Write property test for sponsor deliverables
    - **Property 34: Sponsor deliverables completion percentage**
    - **Validates: Requirements 18.4, 18.5**

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Failure handling and resilience
  - [ ] 13.1 Implement retry and error handling framework
    - Create `src/lib/retry.ts` with exponential backoff utility (1s, 2s, 4s, max 3 attempts)
    - Implement rate-limit handling: wait for Retry-After header or 60 seconds, notify user if wait > 30s
    - Implement per-agent error categorization (api, payment, communication, database, validation, timeout)
    - Implement failure logging to Audit Log table with all retry timestamps and resolution status
    - _Requirements: 15.1, 15.5, 15.6_

  - [ ]* 13.2 Write property tests for retry logic
    - **Property 27: Exponential backoff retry timing**
    - **Property 28: Rate-limit response wait duration**
    - **Validates: Requirements 15.1, 15.6**

  - [ ] 13.3 Implement graceful degradation and task continuation
    - Create `src/agents/orchestrator/recovery.ts` with failure recovery logic
    - Implement independent task continuation: tasks with no data dependency on failed agent continue processing
    - Implement graceful degradation: WhatsApp unavailable → fallback to email, Stagehand failure → suggest manual URLs
    - Implement user notification within 5 seconds of exhausted retries with specific fallback suggestions
    - Implement manual retry and auto-recovery (detect service health, resume paused tasks in original order)
    - _Requirements: 15.2, 15.3, 15.4_

  - [ ]* 13.4 Write property test for independent task continuation
    - **Property 29: Independent task continuation during failures**
    - **Validates: Requirements 15.3**

- [ ] 14. Frontend - Chat interface
  - [ ] 14.1 Implement authentication with next-auth
    - Create `src/app/api/auth/[...nextauth]/route.ts` with NextAuth configuration
    - Set up session management and user accounts
    - Create login/signup pages with light professional theme
    - _Requirements: 1.6_

  - [ ] 14.2 Implement Event Sidebar component
    - Create `src/components/sidebar/EventSidebar.tsx` with event list
    - Display events with name, date, status (planning/confirmed/in-progress/completed), last activity
    - Implement event selection and new event creation
    - Use status colors: green=done, yellow=in-progress, red=failed, blue=pending
    - _Requirements: 1.4_

  - [ ] 14.3 Implement Chat Mode UI with Vercel AI SDK streaming
    - Create `src/components/chat/ChatPanel.tsx` with conversational interface
    - Use `useChat` hook from Vercel AI SDK for streaming responses
    - Render different message types: user, assistant, system, approval requests, comparison tables, status updates
    - Display agent name and reasoning trace metadata per message
    - Show credit cost per operation inline
    - Fixed chat input always visible at bottom
    - Support file attachments via react-dropzone (images, PDFs)
    - _Requirements: 10.1, 10.5, 19.3_

  - [ ] 14.4 Implement Approval Request UI components
    - Create `src/components/chat/ApprovalCard.tsx` with approve/reject buttons
    - Display action type, amount (SGD), recipient, description, consequences of approve/reject
    - Show pending approvals queue sorted by creation time
    - Use sonner toasts for approval notifications
    - _Requirements: 10.4, 11.1, 11.6_

  - [ ] 14.5 Implement Reasoning Trace display
    - Create `src/components/chat/ReasoningTrace.tsx` with collapsible trace view
    - Default collapsed: show agent name, task name, status
    - Expanded: full step-by-step log with rationale, data sources, timestamps
    - Animated status indicator for in-progress tasks
    - Show failure details with recovery action
    - _Requirements: 10.1, 10.2, 10.5, 10.6_

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Frontend - Whiteboard and real-time updates
  - [ ] 16.1 Implement Whiteboard Mode with React Flow
    - Create `src/components/whiteboard/WhiteboardView.tsx` with React Flow canvas
    - Implement custom node types: schedule-block, vendor-card, venue-card, payment-status, attendee-stats, task-card, communication-log, analytics-widget
    - Read-only canvas: pan, zoom, click to expand cards, no drag-to-edit
    - Status colors on nodes: green/yellow/red/blue with Lucide status icons
    - Expandable cards showing discussion history on click
    - Animated edges for in-progress connections
    - _Requirements: 10.3_

  - [ ] 16.2 Implement mode toggle between Chat and Whiteboard
    - Create `src/components/layout/ModeToggle.tsx` with smooth Framer Motion transitions
    - Chat input remains visible in both modes (fixed bottom bar)
    - Zustand store for active mode state
    - _Requirements: 10.1_

  - [ ] 16.3 Implement WebSocket real-time updates
    - Create `src/lib/websocket.ts` with WebSocket client for AWS WebSocket API Gateway
    - Implement reconnection with exponential backoff on disconnect
    - Retrieve missed messages via REST on reconnect
    - Stream agent status updates, reasoning traces, and approval notifications in real-time
    - Update whiteboard nodes on status changes (< 2 seconds SLA)
    - _Requirements: 10.1, 10.2, 19.3_

  - [ ] 16.4 Implement Zustand state management
    - Create `src/stores/event-store.ts` with event and agent state
    - Create `src/stores/chat-store.ts` with conversation state
    - Create `src/stores/whiteboard-store.ts` with whiteboard node/edge state
    - Create `src/stores/credits-store.ts` with credit balance state
    - Wire WebSocket updates to state stores
    - _Requirements: 1.4, 10.3_

- [ ] 17. Frontend - Attendee and analytics views
  - [ ] 17.1 Implement Check-in page with QR scanner
    - Create `src/app/event/[id]/checkin/page.tsx` with QR code scanning
    - Display badge on successful check-in (attendee name, org, ticket type, branding)
    - Show error states: invalid, duplicate, unregistered, system unavailable
    - Implement check-in dashboard: total checked in, pending arrivals, rate per 15-min interval
    - Dashboard updates within 5 seconds of each check-in
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 17.2 Implement Registration page
    - Create `src/app/event/[id]/register/page.tsx` with registration form
    - Dynamic form fields based on ticket types and custom fields
    - Capacity enforcement with sold-out indication
    - Payment flow integration for paid tickets (Stripe Connect)
    - QR code generation (qrcode.react) on successful registration
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 17.3 Implement Analytics dashboard components
    - Create `src/components/analytics/AttendanceReport.tsx` with attendance charts (recharts)
    - Create `src/components/analytics/FeedbackSummary.tsx` with sentiment visualization
    - Create `src/components/analytics/ROIReport.tsx` with budget performance charts
    - Create `src/components/analytics/ExportButtons.tsx` for PDF/CSV export
    - Show insufficient-data message when < 5 feedback responses
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 18. API routes and backend integration
  - [ ] 18.1 Implement Next.js API routes for agent communication
    - Create `src/app/api/chat/route.ts` with Vercel AI SDK streaming chat endpoint
    - Create `src/app/api/events/route.ts` for event CRUD
    - Create `src/app/api/events/[id]/approve/route.ts` for approval actions
    - Create `src/app/api/events/[id]/attendees/route.ts` for attendee management
    - Create `src/app/api/events/[id]/checkin/route.ts` for check-in validation
    - Create `src/app/api/credits/route.ts` for credit balance and purchase
    - Create `src/app/api/stripe/connect/route.ts` for Stripe Connect onboarding
    - _Requirements: 1.3, 4.1, 5.1, 6.1, 11.3_

  - [ ] 18.2 Implement Stripe webhook handlers
    - Create `src/app/api/webhooks/stripe/route.ts` for Stripe webhook processing
    - Handle `checkout.session.completed` for event payments and credit purchases
    - Handle `payment_intent.succeeded` for ticket payments (Stripe Connect)
    - Handle `account.updated` for Stripe Connect onboarding status
    - Verify webhook signatures with STRIPE_WEBHOOK_SECRET
    - _Requirements: 4.2, 4.5, 4.10_

  - [ ] 18.3 Implement Stagehand browser automation client
    - Create `src/lib/stagehand.ts` with Stagehand API client
    - Implement web navigation actions for venue website interaction, form filling
    - Implement FoodPanda ordering flow automation
    - Deduct credits per Stagehand session
    - _Requirements: 13.2_

  - [ ] 18.4 Implement WAHA WhatsApp client
    - Create `src/lib/waha.ts` with WAHA API client
    - Implement message sending with media support
    - Implement delivery status tracking
    - Implement reply webhook handler for incoming messages
    - Deduct credits per WhatsApp message
    - _Requirements: 7.1, 7.3_

  - [ ] 18.5 Implement AWS SES email client
    - Create `src/lib/ses.ts` with AWS SES email sending
    - Implement email composition with attachments
    - Implement bounce/complaint handling
    - Implement confirmation email templates (registration, speaker, vendor)
    - Deduct credits per email send
    - _Requirements: 7.1, 7.3, 5.2, 5.3_

- [ ] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Integration wiring and end-to-end flows
  - [ ] 20.1 Wire all agents to orchestrator delegation
    - Connect orchestrator's `delegateTask()` to all 8 specialized agents
    - Implement SQS-based async task distribution for long-running operations
    - Wire credit deduction into each agent operation
    - Wire approval gates into payment, communication, and booking flows
    - Ensure reasoning traces stream through WebSocket to frontend
    - _Requirements: 1.3, 4.6, 11.1, 10.1, 19.2_

  - [ ] 20.2 Wire frontend to backend real-time pipeline
    - Connect Chat UI → API route → Orchestrator → Agents → WebSocket → UI updates
    - Connect Whiteboard nodes to agent task status changes
    - Connect Approval cards to approval API endpoints
    - Connect Credit balance display to real-time deduction updates
    - Connect Check-in page to QR validation endpoint
    - _Requirements: 10.1, 10.3, 11.3, 4.6_

  - [ ] 20.3 Implement Vercel AI SDK Workflows for complete event lifecycle
    - Create workflow for event creation: description → Event_Brief → compliance check → agent delegation
    - Create workflow for venue flow: search → compare → select → booking inquiry
    - Create workflow for vendor flow: search → contact → negotiate → agree → checkout
    - Create workflow for registration flow: create form → register → payment → QR code → check-in
    - Create workflow for budget flow: allocate → commit → warn → realloc → checkout
    - _Requirements: 19.2, 19.6_

  - [ ]* 20.4 Write integration tests for end-to-end flows
    - Test complete event creation flow (description → Event_Brief → agent delegation)
    - Test venue search → selection → booking inquiry flow
    - Test registration → payment → QR code → check-in flow
    - Test budget creation → spending → warning → reallocation flow
    - Test approval request → approve/reject → task resume/cancel flow
    - _Requirements: 1.1, 2.1, 5.1, 6.1, 9.1, 11.1_

- [ ] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementations use TypeScript
- Frontend deploys to Vercel; backend uses AWS serverless (Lambda, DynamoDB, SQS, SES)
- All LLM calls must route through Vercel AI Gateway (Property 38)
- Stripe operates in sandbox/test mode for hackathon demo
- Credit costs are defined in environment variables for easy tuning

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5"] },
    { "id": 4, "tasks": ["3.6", "3.7", "5.1", "5.2"] },
    { "id": 5, "tasks": ["5.3", "5.4", "5.5", "5.7"] },
    { "id": 6, "tasks": ["5.6", "5.8", "5.9", "5.10", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.5"] },
    { "id": 8, "tasks": ["7.4", "7.6", "7.7", "9.1"] },
    { "id": 9, "tasks": ["7.8", "9.2", "9.3", "9.5"] },
    { "id": 10, "tasks": ["9.4", "9.6", "9.7"] },
    { "id": 11, "tasks": ["9.8", "11.1", "11.3", "11.5", "11.7"] },
    { "id": 12, "tasks": ["11.2", "11.4", "11.6", "11.8", "13.1"] },
    { "id": 13, "tasks": ["13.2", "13.3"] },
    { "id": 14, "tasks": ["13.4", "14.1", "14.2"] },
    { "id": 15, "tasks": ["14.3", "14.4", "14.5"] },
    { "id": 16, "tasks": ["16.1", "16.2", "16.3", "16.4"] },
    { "id": 17, "tasks": ["17.1", "17.2", "17.3"] },
    { "id": 18, "tasks": ["18.1", "18.2", "18.3", "18.4", "18.5"] },
    { "id": 19, "tasks": ["20.1", "20.2"] },
    { "id": 20, "tasks": ["20.3", "20.4"] }
  ]
}
```
