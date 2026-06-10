# Requirements Document

## Introduction

An all-in-one AI-powered chatbot system for event organization, focused on Singapore. The system orchestrates multiple specialized AI agents to handle the full lifecycle of event planning — from venue sourcing and vendor negotiation to ticketing, payments, and post-event analytics. Built for the NEXT Hackathon (SuperAI, Singapore, June 2025), targeting Top 5 Overall, Best Use of Exa, and Best Use of Stripe prizes.

The system serves both organizations planning corporate events and individuals organizing personal events without hiring a professional organizer. All interactions happen through a conversational interface with visible agent reasoning, real-time process tracking, and human-in-the-loop approval for high-stakes actions.

## Glossary

- **Orchestrator_Agent**: The central AI agent that interprets user intent, decomposes tasks, and delegates to specialized sub-agents
- **Venue_Agent**: A specialized sub-agent responsible for searching, comparing, and booking venues in Singapore
- **Vendor_Agent**: A specialized sub-agent responsible for vendor discovery, communication, negotiation, and contract management
- **Payment_Agent**: A specialized sub-agent responsible for processing payments via Stripe (platform checkout, credit purchases, and ticket payments via user-connected Stripe accounts)
- **Communication_Agent**: A specialized sub-agent responsible for sending messages via WhatsApp and email to vendors, venues, and attendees
- **Attendee_Agent**: A specialized sub-agent responsible for registration, ticketing, check-in, and attendee communications
- **Schedule_Agent**: A specialized sub-agent responsible for agenda building, speaker coordination, and timeline management
- **Analytics_Agent**: A specialized sub-agent responsible for post-event reporting, feedback analysis, and ROI calculations
- **Event_Brief**: A structured document capturing the user's event requirements including type, date, budget, capacity, and preferences
- **Human_Approval_Gate**: A checkpoint requiring explicit user confirmation before executing irreversible or high-cost actions
- **Reasoning_Trace**: A visible record of the AI's decision-making process, showing why specific actions were chosen
- **Exa_Search**: Web retrieval using the Exa API for venue search, vendor research, and pricing intelligence
- **Stripe_MCP**: The Stripe Model Context Protocol integration used for three purposes: (1) generating the final checkout page when event costs are finalized (platform Stripe account), (2) processing token/credit purchases for pay-per-use billing (platform Stripe account), and (3) processing paid ticket registrations via the user's connected Stripe account (Stripe Connect)
- **Stripe_Connect**: Stripe's platform feature allowing the event organizer to connect their own Stripe account to receive ticket payment revenue directly
- **Credits**: The internal currency used for pay-per-use billing; users purchase credits via Stripe to fund agent operations (searches, messages, browser automation tasks)
- **Vercel_AI_Gateway**: Vercel's AI Gateway used to route all LLM calls with observability, caching, rate limiting, and model fallback
- **Vercel_AI_SDK_Workflows**: Vercel's AI SDK Workflows used for multi-agent orchestration with streaming, multi-step reasoning, and state management
- **SGD**: Singapore Dollar, the currency used for all financial transactions in the system
- **Event_Dashboard**: The main user interface showing event status, active processes, pending approvals, and agent activity

## Requirements

### Requirement 1: Multi-Agent Orchestration

**User Story:** As an event organizer, I want to describe my event in natural language, so that the AI system decomposes my request into actionable tasks handled by specialized agents.

#### Acceptance Criteria

1. WHEN the user provides an event description, THE Orchestrator_Agent SHALL parse the description into a structured Event_Brief containing event type, date, estimated attendee count, budget range, and preferences
2. IF the event description does not contain enough information to populate all required Event_Brief fields (event type, date, estimated attendee count, budget range), THEN THE Orchestrator_Agent SHALL prompt the user with specific follow-up questions for each missing field before creating the Event_Brief
3. WHEN an Event_Brief is created, THE Orchestrator_Agent SHALL identify required sub-tasks and delegate each to the corresponding specialized agent (Venue_Agent, Vendor_Agent, Payment_Agent, Communication_Agent, Attendee_Agent, Schedule_Agent, or Analytics_Agent) based on the task category
4. WHILE sub-agents are executing tasks, THE Orchestrator_Agent SHALL track progress and report status updates to the user via the Event_Dashboard each time a sub-agent completes a task, encounters an error, or at minimum every 30 seconds during active processing
5. IF a sub-agent encounters a failure during task execution, THEN THE Orchestrator_Agent SHALL retry the task once within 15 seconds, and if the retry also fails, notify the user with the failed task name, the reason for failure, and at least one suggested alternative approach
6. THE Orchestrator_Agent SHALL maintain conversation context across sessions for each user, persisting the Event_Brief and all agent interactions in the database for a minimum of 90 days

### Requirement 2: Venue Sourcing and Comparison

**User Story:** As an event organizer, I want the AI to search for and compare venues in Singapore, so that I can choose the best venue without manual research.

#### Acceptance Criteria

1. WHEN the user requests venue options, THE Venue_Agent SHALL use Exa_Search to retrieve up to 10 venue options including name, location, capacity, pricing in SGD, availability for the event date, and amenities from Singapore venue sources
2. WHEN venue results are retrieved, THE Venue_Agent SHALL present a comparison table ranked by relevance to the Event_Brief criteria, scoring each venue on capacity match (within 20% of requested attendee count), budget fit (venue cost at or below allocated venue budget), and location preference
3. WHEN the user selects a venue, THE Venue_Agent SHALL initiate a booking inquiry via the Communication_Agent containing the event name, date, expected attendee count, event type, and budget range from the Event_Brief
4. IF Exa_Search returns no results matching the criteria, THEN THE Venue_Agent SHALL broaden the search by relaxing parameters in this order: location area, then capacity range (expand by 25%), then budget ceiling (expand by 20%), and inform the user which parameters were adjusted
5. THE Venue_Agent SHALL store all searched venues and their details for the duration of the event planning session for future reference and comparison
6. IF the Event_Brief does not contain sufficient venue search criteria (at minimum: event date, estimated attendee count, and budget range), THEN THE Venue_Agent SHALL prompt the user to provide the missing information before initiating the search

### Requirement 3: Vendor Discovery and Negotiation

**User Story:** As an event organizer, I want the AI to find vendors, contact them, and negotiate pricing on my behalf, so that I save time on vendor management.

#### Acceptance Criteria

1. WHEN the user specifies a service need (catering, AV, decoration, photography, florists, entertainment, transport), THE Vendor_Agent SHALL use Exa_Search to find between 3 and 10 vendors in Singapore matching the service category, located within the event area, and with pricing within the Event_Brief category budget, returning ratings, pricing in SGD, and contact information
2. WHEN a vendor is identified, THE Communication_Agent SHALL send an initial inquiry message via email containing the event name, date, expected headcount, service scope as specified in the Event_Brief, and budget range for the category
3. WHILE negotiating with a vendor, THE Communication_Agent SHALL propose counter-offers within the budget range specified in the Event_Brief, limiting negotiation to a maximum of 3 counter-offers per vendor, and requiring Human_Approval_Gate for any offer exceeding 80% of the category budget
4. WHEN a vendor agreement is reached, THE Vendor_Agent SHALL generate a summary containing vendor name, service description, agreed price in SGD, delivery date, and payment terms, and present it to the user for confirmation via Human_Approval_Gate before proceeding to payment
5. IF a vendor does not respond within 48 hours, THEN THE Communication_Agent SHALL send one follow-up message and flag the vendor as unresponsive to the user
6. IF a vendor does not respond within 48 hours after the follow-up message, THEN THE Vendor_Agent SHALL mark the vendor as unresponsive, remove them from active negotiation, and suggest the next-ranked alternative vendor from the original search results
7. IF Exa_Search returns no vendors matching the specified service category and budget criteria, THEN THE Vendor_Agent SHALL broaden the search by increasing the budget range by 20% and expanding the location radius, inform the user of the adjusted parameters, and present results if found

### Requirement 4: Payment Processing via Stripe

**User Story:** As an event organizer, I want to pay for my event through a single Stripe checkout when costs are finalized, purchase platform credits to use the AI agent, and optionally accept paid ticket registrations through my own Stripe account.

#### Acceptance Criteria

1. WHEN the user requests to finalize and pay for the event, THE Payment_Agent SHALL generate a Stripe checkout page (using the platform Stripe account) listing all confirmed event costs (venue, catering, vendors) as line items with amounts in SGD, presenting a single unified checkout for the entire event
2. WHEN a Stripe checkout is completed successfully, THE Payment_Agent SHALL record the payment with total amount, itemized breakdown, Stripe session ID, and timestamp in the event record, and mark all associated costs as "paid"
3. IF a Stripe checkout fails or is abandoned, THEN THE Payment_Agent SHALL notify the user via the Event_Dashboard with the failure reason and retain all cost items for a future checkout attempt
4. WHEN the user requests to purchase platform credits, THE Payment_Agent SHALL generate a Stripe checkout page with the selected credit package (e.g., 50 credits for $5 SGD, 200 credits for $18 SGD, 500 credits for $40 SGD) and process the purchase via the platform Stripe account
5. WHEN a credit purchase is completed successfully, THE Payment_Agent SHALL add the purchased credits to the user's account balance and record the transaction with amount, credits added, Stripe session ID, and timestamp
6. WHILE agents perform billable operations (Exa searches, Stagehand browser sessions, WhatsApp messages, email sends), THE Payment_Agent SHALL deduct credits from the user's balance per operation and display the remaining credit balance on the Event_Dashboard
7. IF the user's credit balance reaches zero during an agent operation, THEN THE Payment_Agent SHALL pause agent execution, notify the user that credits are depleted, and present a link to purchase more credits before resuming
8. WHEN the user configures paid ticket registration, THE Payment_Agent SHALL prompt the user to connect their own Stripe account via Stripe Connect, and upon successful connection, use the connected account to receive ticket payment revenue directly
9. IF the user has not connected a Stripe account when configuring paid tickets, THEN THE Payment_Agent SHALL block paid ticket creation and inform the user that Stripe Connect is required to receive ticket payments
10. WHEN an attendee purchases a paid ticket, THE Payment_Agent SHALL process the payment through the user's connected Stripe account (via Stripe Connect), with the ticket revenue deposited directly to the user's account

### Requirement 5: Attendee Registration and Ticketing

**User Story:** As an event organizer, I want the AI to manage attendee registration and ticket sales, so that I can track who is attending and collect payments.

#### Acceptance Criteria

1. WHEN the user defines ticket types (free, paid, VIP) with optional capacity limits per type, THE Attendee_Agent SHALL create a registration form with the specified fields and pricing, enforcing capacity limits by rejecting registrations that exceed the defined ticket capacity
2. WHEN an attendee completes registration with a paid ticket, THE Payment_Agent SHALL process the ticket payment through the user's connected Stripe account (via Stripe Connect) and issue a confirmation email containing a unique QR code for check-in
3. WHEN an attendee registers with a free ticket, THE Attendee_Agent SHALL store the registration and issue a confirmation email containing a unique QR code without requiring payment
4. WHEN an attendee registers, THE Attendee_Agent SHALL store the attendee record with name, email, ticket type, payment status, and unique check-in QR code
5. WHEN the user requests attendee status, THE Attendee_Agent SHALL provide a summary showing total registered, tickets sold by type, revenue collected in SGD, and remaining capacity per ticket type
6. IF a ticket payment fails during registration, THEN THE Attendee_Agent SHALL hold the registration for 15 minutes and send a retry link to the attendee via email
7. IF the registration hold expires after 15 minutes without successful payment, THEN THE Attendee_Agent SHALL release the held ticket capacity and mark the registration as expired
8. IF the user attempts to create paid tickets without a connected Stripe account, THEN THE Attendee_Agent SHALL inform the user that Stripe Connect must be set up first and provide the connection flow

### Requirement 6: Check-In and Badge Generation

**User Story:** As an event organizer, I want QR code check-in and badge generation, so that event day runs smoothly with professional attendee management.

#### Acceptance Criteria

1. WHEN an attendee presents their QR code at check-in, THE Attendee_Agent SHALL validate the QR code against the registration database and mark the attendee as checked in within 3 seconds of the scan
2. WHEN a QR code is validated successfully, THE Attendee_Agent SHALL generate a badge containing the attendee name, organization, ticket type, and event branding, available both as a screen-displayed digital badge and as a print-formatted layout
3. IF a QR code is invalid or already used, THEN THE Attendee_Agent SHALL reject the check-in attempt and display an error message indicating the reason (invalid code, duplicate check-in, or unregistered) while preserving the original check-in record for duplicate attempts
4. THE Attendee_Agent SHALL provide a check-in dashboard that updates within 5 seconds of each check-in event, showing total checked in, pending arrivals (total registered minus checked in), and check-in rate per 15-minute interval
5. IF the registration database is unavailable during a check-in scan, THEN THE Attendee_Agent SHALL display an error indicating the system is temporarily unavailable and prompt the operator to retry

### Requirement 7: Communication Management

**User Story:** As an event organizer, I want the AI to send emails and WhatsApp messages to vendors, speakers, and attendees on my behalf, so that all event communications are handled efficiently.

#### Acceptance Criteria

1. WHEN the Orchestrator_Agent delegates a communication task, THE Communication_Agent SHALL compose a message including the event name, relevant dates, recipient-specific details (e.g., session time for speakers, booking reference for vendors), and a clear call-to-action, selecting the channel (email or WhatsApp) based on the recipient's preferred contact method stored in the system
2. WHEN sending messages to attendees in bulk (more than 10 recipients), THE Communication_Agent SHALL require Human_Approval_Gate confirmation with a preview of the message template and recipient count
3. THE Communication_Agent SHALL log all sent messages with timestamp, recipient, channel (email or WhatsApp), content summary, and delivery status (sent, delivered, failed, bounced)
4. WHEN a recipient replies to a system-sent message within 72 hours, THE Communication_Agent SHALL parse the reply, update the relevant agent with the response context, and suggest a follow-up action to the user
5. IF a message delivery fails, THEN THE Communication_Agent SHALL retry delivery once after 5 minutes, and if still failing, notify the user with the failure reason and suggest an alternative communication channel
6. IF a recipient's contact information is missing or invalid when a communication task is delegated, THEN THE Communication_Agent SHALL notify the user that the message cannot be sent and request the correct contact details before proceeding

### Requirement 8: Schedule and Agenda Management

**User Story:** As an event organizer, I want the AI to help build the event schedule by coordinating with speakers and managing time slots, so that the agenda is optimized and conflict-free.

#### Acceptance Criteria

1. WHEN the user provides session topics and speaker names, THE Schedule_Agent SHALL create a draft agenda with time slots allocated based on session type (keynote: 45 min, talk: 20 min, workshop: 60 min, break: 15 min) including 5-minute transition buffers between consecutive sessions
2. WHEN a speaker is added to the agenda, THE Communication_Agent SHALL send the speaker a confirmation message with their session date, time in SGT (UTC+8), duration, topic, and venue location
3. THE Schedule_Agent SHALL detect and flag time conflicts when two sessions are assigned overlapping time slots in the same track, immediately upon any schedule modification
4. WHEN the user finalizes the agenda, THE Schedule_Agent SHALL generate a public-facing agenda page and internal run-of-show document including speaker names, session times, room assignments, and transition notes
5. IF a speaker requests a time change, THEN THE Schedule_Agent SHALL propose up to 3 alternative slots that avoid conflicts with other sessions and the speaker's own constraints, and present options to the user
6. IF a speaker does not confirm their assigned slot within 72 hours of notification, THEN THE Communication_Agent SHALL send one reminder message and flag the unconfirmed session to the user

### Requirement 9: Budget Tracking and Management

**User Story:** As an event organizer, I want the AI to track my event budget across all categories, so that I stay within financial limits and can see spending in real time.

#### Acceptance Criteria

1. WHEN an Event_Brief is created with a total budget, THE Payment_Agent SHALL create a budget allocation across standard categories (venue, catering, AV, marketing, speakers, contingency) with default percentages based on event type, and present the allocation to the user for confirmation or adjustment before finalizing
2. WHILE vendor agreements are confirmed or costs are added to the event, THE Payment_Agent SHALL update the budget tracker by recording each cost as "committed" (agreed but not yet paid), and calculate remaining funds per category as allocated minus committed; costs move to "spent" only after the final Stripe checkout is completed
3. WHEN the combined spent and committed amount in any category reaches 80% of its allocated budget, THE Payment_Agent SHALL send a warning notification to the user indicating the category name, current utilization percentage, and remaining available amount in SGD
4. IF the combined spent and committed amount in any category exceeds its allocated budget, THEN THE Payment_Agent SHALL flag the overrun, halt further payments and new commitments in that category pending user approval, and suggest reallocation from categories where combined spent and committed is below 50% of allocation
5. WHEN the user requests a budget overview, THE Payment_Agent SHALL display a breakdown showing allocated, spent, committed, and remaining amounts per category in SGD, along with total budget utilization as a percentage
6. WHEN the user approves a reallocation suggested by the Payment_Agent or requests a manual budget adjustment, THE Payment_Agent SHALL update the category allocations accordingly, ensuring the total across all categories equals the overall event budget, and resume any halted payments in categories that are no longer over-allocated

### Requirement 10: Reasoning Trace and Process Visibility

**User Story:** As an event organizer, I want to see what the AI is thinking and doing in real time, so that I understand its decisions and can intervene when needed.

#### Acceptance Criteria

1. WHILE any agent is executing a task, THE Event_Dashboard SHALL display the active Reasoning_Trace updating within 2 seconds of each state change, showing the current step name, decision rationale as a single-sentence explanation, and a list of data sources consulted (Exa_Search queries, database lookups, API calls)
2. WHEN a sub-agent completes a task, THE Event_Dashboard SHALL update the process timeline within 2 seconds with the completed action name, outcome (success or failure with reason), and time taken displayed in seconds
3. THE Event_Dashboard SHALL display a list of all active processes showing their status (waiting, in-progress, completed, failed, awaiting-approval) with each entry showing the agent name, task description, and time elapsed since task start
4. WHEN a Human_Approval_Gate is triggered, THE Event_Dashboard SHALL display the pending action with context including the monetary amount in SGD (if applicable), recipient name, action type (payment, communication, booking), and a description of what will happen on approval and what will happen on rejection
5. THE Event_Dashboard SHALL display Reasoning_Traces in a collapsed state by default showing only the agent name, task name, and current status, and allow the user to expand a trace to reveal the full step-by-step log including decision rationale, data sources, and timestamps for each step
6. IF an agent encounters a failure during task execution, THEN THE Event_Dashboard SHALL display the failure in the Reasoning_Trace with the failed step name, error description, and current recovery action (retrying, awaiting user input, or escalated to user)

### Requirement 11: Human-in-the-Loop Approval

**User Story:** As an event organizer, I want to approve high-stakes actions before they execute, so that I maintain control over irreversible decisions and large expenditures.

#### Acceptance Criteria

1. WHEN an action involves a payment exceeding 50 SGD, THE Orchestrator_Agent SHALL pause execution and present the action to the user via the Human_Approval_Gate with the amount, recipient, category, and a one-sentence explanation of why the payment is needed
2. WHEN an action involves sending a binding commitment to a vendor (booking confirmation, contract acceptance), THE Orchestrator_Agent SHALL pause execution and present the action to the user via the Human_Approval_Gate with the commitment details and consequences
3. WHEN the user approves an action at the Human_Approval_Gate, THE Orchestrator_Agent SHALL resume the paused task within 2 seconds
4. WHEN the user rejects an action at the Human_Approval_Gate, THE Orchestrator_Agent SHALL cancel the pending action, preserve all work completed prior to the rejected action, and ask the user for alternative instructions
5. IF a Human_Approval_Gate action is not responded to within 24 hours, THEN THE Orchestrator_Agent SHALL send a reminder notification and keep the action in pending state without expiring
6. IF multiple Human_Approval_Gate actions are pending simultaneously, THE Event_Dashboard SHALL display all pending approvals in a queue sorted by creation time, allowing the user to approve or reject each independently

### Requirement 12: Web Research via Exa

**User Story:** As an event organizer, I want the AI to research venues, vendors, and pricing using real-time web data, so that recommendations are based on current and accurate information.

#### Acceptance Criteria

1. WHEN any agent requires external information (venue details, vendor contacts, pricing benchmarks, regulations), THE agent SHALL query Exa_Search with a semantic search request including location constraint (Singapore), category, date relevance, and a minimum of 2 query keywords derived from the Event_Brief
2. WHEN Exa_Search returns results, THE requesting agent SHALL extract structured data (name, contact, pricing in SGD, ratings, availability) and present it in a formatted comparison table to the user showing at minimum 3 results ranked by relevance score
3. THE Venue_Agent SHALL use Exa_Search to verify venue availability and current pricing before presenting options to the user
4. THE Vendor_Agent SHALL use Exa_Search to research vendor reputation, reviews, and portfolio before recommending vendors to the user
5. IF Exa_Search returns results older than 30 days based on the publishedDate field, THEN THE requesting agent SHALL indicate the data freshness limitation to the user and suggest manual verification for critical decisions
6. IF Exa_Search returns zero results for a query, THEN THE requesting agent SHALL reformulate the query with broader terms and retry once, and if still zero results, inform the user that no web data was found and suggest alternative research approaches

### Requirement 13: Food Ordering Integration

**User Story:** As an event organizer, I want the AI to order food and catering for my event, so that meals and refreshments are arranged without manual coordination.

#### Acceptance Criteria

1. WHEN the user specifies food requirements (meal type, dietary restrictions, headcount, budget in SGD), THE Vendor_Agent SHALL search for catering options matching the criteria using Exa_Search and present up to 5 options showing vendor name, menu offerings, per-pax pricing, supported dietary categories (halal, vegetarian, vegan, allergen-free), minimum order size, and estimated delivery lead time
2. WHEN a catering vendor is selected, THE Communication_Agent SHALL send a catering inquiry via email or WhatsApp containing the specified menu, headcount, dietary requirements, delivery date and time, delivery location, and event budget for the catering category
3. WHEN a catering vendor responds with an acceptance and confirmed price, THE Vendor_Agent SHALL record the confirmed cost as a "committed" line item against the catering budget category and add it to the final event checkout items pending user approval via Human_Approval_Gate
4. IF dietary requirements cannot be met by a single vendor, THEN THE Vendor_Agent SHALL suggest splitting the order across up to 3 vendors, present a per-vendor cost breakdown and combined total in SGD, and require user confirmation before proceeding with multiple inquiries
5. IF no catering vendors matching the specified dietary restrictions and budget are found via Exa_Search, THEN THE Vendor_Agent SHALL inform the user of the unmet criteria, suggest relaxing budget by 20% or broadening dietary vendor coverage, and offer to retry the search with adjusted parameters
6. IF the catering order total exceeds the remaining catering category budget, THEN THE Payment_Agent SHALL warn the user of the budget overrun amount before presenting the Human_Approval_Gate for payment confirmation

### Requirement 14: Marketing and Event Page Generation

**User Story:** As an event organizer, I want the AI to generate marketing content and an event page, so that I can promote the event without hiring a designer.

#### Acceptance Criteria

1. WHEN the user requests event promotion, THE Orchestrator_Agent SHALL generate social media post copy for each specified platform (LinkedIn, Twitter, Instagram) using the Event_Brief details, adhering to platform character limits (Twitter: 280 characters, LinkedIn: 3000 characters, Instagram: 2200 characters) and including platform-appropriate formatting (hashtags for Twitter and Instagram, professional tone for LinkedIn)
2. WHEN the user requests an event page, THE Orchestrator_Agent SHALL generate a self-contained responsive HTML event page that renders correctly on viewports from 320px to 1920px width, containing event name, date, venue, agenda, registration link, and sponsor logos
3. WHEN the user approves the event page content, THE Orchestrator_Agent SHALL provide the generated page as a self-contained HTML file deployable to a static hosting service
4. WHEN the user requests email campaign content, THE Orchestrator_Agent SHALL generate email copy for pre-event announcement, reminder (1 week before), reminder (1 day before), and post-event thank-you, each including the event name, date, venue, and a call-to-action link
5. WHEN social media post copy or email campaign copy is generated, THE Orchestrator_Agent SHALL present the content to the user for approval via the Human_Approval_Gate before marking it ready for publishing or sending
6. IF the Event_Brief is missing required fields (event name, date, or venue) when the user requests an event page or promotion content, THEN THE Orchestrator_Agent SHALL inform the user which fields are missing and request the information before proceeding with generation

### Requirement 15: Failure Handling and Recovery

**User Story:** As an event organizer, I want the system to handle failures gracefully, so that my event planning continues even when individual operations fail.

#### Acceptance Criteria

1. IF any agent encounters an API failure (HTTP 5xx response, network timeout exceeding 10 seconds, connection refused, or malformed response from Stripe, Exa, email, or WhatsApp), THEN THE agent SHALL retry the operation with exponential backoff (1s, 2s, 4s) for up to 3 attempts
2. IF all retry attempts for an operation are exhausted, THEN THE agent SHALL log the failure with context (timestamp, agent name, operation attempted, error type, all retry timestamps and responses), notify the user via the Event_Dashboard within 5 seconds, and suggest a specific manual fallback action relevant to the failed operation
3. WHILE an agent is in a failed state, THE Orchestrator_Agent SHALL continue processing tasks that have no data dependency on the output of the failed operation through other agents without blocking the workflow
4. WHEN the user triggers a manual retry of a failed operation or the Orchestrator_Agent detects that a previously failing external service returns a successful health response, THE Orchestrator_Agent SHALL resume any paused dependent tasks in their original order and notify the user of the recovery via the Event_Dashboard
5. THE Orchestrator_Agent SHALL maintain an audit log of all failures including timestamp, agent name, operation, error type, error message, all retry attempt timestamps, and resolution status (pending, resolved-auto, resolved-manual, abandoned)
6. IF any agent receives an API rate-limit response (HTTP 429), THEN THE agent SHALL wait for the duration specified in the rate-limit response header (or 60 seconds if no header is provided) before retrying, and SHALL notify the user via the Event_Dashboard if the wait exceeds 30 seconds

### Requirement 16: Singapore Compliance Awareness

**User Story:** As an event organizer in Singapore, I want the AI to be aware of local regulations and permits, so that my event complies with Singapore law.

#### Acceptance Criteria

1. WHEN an event involves outdoor activities, THE Orchestrator_Agent SHALL inform the user about NEA permit requirements including the issuing authority, estimated processing time, and a summary of application steps
2. WHEN an event expects more than 5000 attendees, THE Orchestrator_Agent SHALL inform the user about SPF (Singapore Police Force) permit requirements for large gatherings including the issuing authority, estimated processing time, and a summary of application steps
3. WHEN the Event_Brief includes content broadcasting or public performance, THE Orchestrator_Agent SHALL inform the user about IMDA content licensing requirements including the issuing authority, estimated processing time, and a summary of application steps
4. WHEN the Event_Brief is created or updated with details that trigger one or more applicable regulations, THE Orchestrator_Agent SHALL present all relevant compliance requirements to the user within the same response, before proceeding with other planning tasks
5. WHEN a compliance requirement is presented, THE Orchestrator_Agent SHALL include the recommended lead time for permit application and flag any permits where the remaining time before the event date is less than 4 weeks
6. WHEN the Event_Brief includes food service or catering for attendees, THE Orchestrator_Agent SHALL inform the user about SFA (Singapore Food Agency) food handling license requirements including the issuing authority, estimated processing time, and a summary of application steps

### Requirement 17: Post-Event Analytics

**User Story:** As an event organizer, I want post-event reports with attendance stats and feedback summaries, so that I can measure success and improve future events.

#### Acceptance Criteria

1. WHEN the event end time has passed by 24 hours, THE Analytics_Agent SHALL automatically generate an attendance report showing total registered, total checked-in, no-show rate as a percentage, and check-in time distribution grouped in 15-minute intervals
2. WHEN at least 5 feedback responses have been collected for an event, THE Analytics_Agent SHALL summarize feedback into up to 5 key themes, a sentiment score per theme on a scale of 1 (very negative) to 5 (very positive), and up to 5 actionable recommendations using AI analysis
3. IF fewer than 5 feedback responses have been collected when a feedback summary is requested, THEN THE Analytics_Agent SHALL display a message indicating that insufficient responses are available and state the current response count
4. WHEN the user requests an ROI report, THE Analytics_Agent SHALL calculate total spend versus revenue (ticket sales, sponsorships), cost per attendee, and category-level budget performance displayed as actual versus planned spend per budget category with percentage variance
5. THE Analytics_Agent SHALL present all reports with data visualizations (charts, graphs) and provide export options in PDF and CSV formats
6. IF required data sources are unavailable when generating any report, THEN THE Analytics_Agent SHALL indicate which data is missing and display the report sections for which data is available

### Requirement 18: Sponsor Management

**User Story:** As an event organizer, I want the AI to manage sponsor relationships including packages and invoicing, so that sponsorship revenue is maximized with minimal manual effort.

#### Acceptance Criteria

1. WHEN the user defines sponsorship tiers (Platinum, Gold, Silver), THE Orchestrator_Agent SHALL create sponsorship packages with benefits (logo size, speaking slots, booth space, social media mentions, complimentary tickets), pricing in SGD, and deliverables checklist for each tier
2. WHEN a sponsor confirms a package, THE Payment_Agent SHALL generate and send a Stripe invoice for the sponsorship amount through the user's connected Stripe account (via Stripe Connect) with 14-day payment terms
3. IF a sponsor invoice remains unpaid after 14 days, THEN THE Payment_Agent SHALL send an automated payment reminder to the sponsor via the Communication_Agent and flag the overdue invoice to the user
4. WHEN the event date is 7 days or fewer away, THE Orchestrator_Agent SHALL review all sponsor deliverables and flag any items with status "not started" or "in progress" to the user with a list of undelivered items per sponsor
5. WHEN the user requests a sponsor summary, THE Orchestrator_Agent SHALL display all sponsors with their tier, payment status (invoiced, paid, overdue), and deliverables completion percentage calculated as completed items divided by total items in the tier package

### Requirement 19: Vercel AI Integration

**User Story:** As a platform operator, I want all AI agent orchestration to use Vercel AI SDK Workflows and all LLM calls to route through Vercel AI Gateway, so that the system has production-grade observability, streaming, and reliability.

#### Acceptance Criteria

1. THE system SHALL route all LLM calls (orchestrator reasoning, agent decisions, content generation) through Vercel_AI_Gateway for centralized observability, caching, rate limiting, and automatic model fallback
2. THE Orchestrator_Agent SHALL use Vercel_AI_SDK_Workflows to define multi-agent orchestration flows with streaming tool calls, multi-step reasoning, and persistent state management across agent handoffs
3. WHEN an agent workflow step produces output, THE system SHALL stream the output in real time to the frontend via Vercel AI SDK's streaming protocol, enabling live Reasoning_Trace updates in the Event_Dashboard
4. IF the primary LLM model is unavailable or returns an error, THEN Vercel_AI_Gateway SHALL automatically fall back to a configured secondary model and log the fallback event
5. THE system SHALL leverage Vercel AI Gateway's built-in caching to avoid redundant LLM calls for identical prompts within the same event session, reducing credit consumption
6. THE system SHALL use Vercel AI SDK's tool-calling interface to define agent tools (Exa search, Stripe operations, Stagehand browser actions, SES email, WAHA WhatsApp) as structured function calls with typed parameters and return schemas
