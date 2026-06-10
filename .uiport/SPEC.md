# Eventiq UI Port — Implementation Spec

GOAL: Implement the "Event Compass" UI (source: `/Users/sakspari/Downloads/Event Compass`) inside this Next.js app.
Every UI feature must REALLY work against the app's existing backend. **NEVER change the main logic** — agents,
API routes, DB layer, auth, stores' existing fields, and the chat protocol are FROZEN.

Companion docs (read them): `.uiport/recon-ui.json` (exhaustive new-UI inventory) and `.uiport/recon-app.json`
(exact protocols of the real app). Source files live in `/Users/sakspari/Downloads/Event Compass/src/` — port from
them faithfully (layout, classes, interactions), changing only what's needed for Next.js + real data.

## Hard rules (apply to every agent)

1. FROZEN — do not edit: `src/agents/**`, `src/lib/**` (existing files), `src/app/api/**`, `src/stores/app-store.ts`,
   `src/stores/chat-store.ts`, `src/types/**` , `src/components/chat/**`, `src/components/whiteboard/**`,
   `src/components/sidebar/**`, `src/components/layout/**`, `src/components/providers/**`, `src/app/p/**`,
   `src/app/settings/**`, `src/app/api/**`, `next.config.js`, `vercel.json`, `infra/**`.
   Exception: files explicitly assigned below (globals.css, tailwind.config.ts, layout.tsx font-only, page.tsx, package.json).
2. New code goes in: `src/components/eventiq/**`, `src/lib/eventiq/**`, `src/stores/event-models-store.ts`,
   `src/components/ui/popover.tsx`, `src/hooks/**` (new files only).
3. This is Next.js App Router + **Tailwind v3** + React 19. Every ported component file starts with `'use client';`.
   No TanStack imports. Use `@/` alias (maps to `src/`).
4. The chat protocol is non-streaming JSON (see recon-app.json `chatProtocol`). Out-of-credits and agent errors come
   back HTTP 200 with friendly `content` — never key error UI off HTTP status alone.
5. Currency: this app is SGD. Render `S$` where the source UI hardcodes `£`.
6. Keep the source UI's look: same class recipes, card-soft, tone pills, animations, responsive behavior.
7. After your edits, run `npx tsc --noEmit` and fix YOUR errors before returning.

## Architecture decisions (already made — follow them)

### Design tokens (Tailwind v3 compatible)
The source uses Tailwind v4 oklch tokens. Port them as **HSL triplets** in `globals.css` `:root` / `.dark` and keep the
`hsl(var(--x) / <alpha-value>)` pattern in `tailwind.config.ts` so alpha modifiers (`bg-primary/10`, `ring-success/20`)
keep working. Convert each oklch value to its HSL equivalent (oklch → sRGB → HSL; primary `oklch(0.74 0.17 55)` ≈ `#FF8D01`-family orange).
Add NEW tokens: `success`, `warning`, `pending`, `info`, `primary-soft` (light+dark), radius scale (base 0.625rem + 2xl/3xl/4xl steps via config borderRadius).
Add custom utility classes in globals.css `@layer utilities` (plain CSS, use `hsl(var(--primary) / 0.2)` instead of color-mix):
`glow-primary`, `card-soft`, `animate-card-in` (+keyframes), `animate-slide-in-right`, `pulse-ring`.
Dark mode: class strategy (already configured). Theme toggled by shell on `<html>`, persisted to localStorage `eventiq-theme`.
Font: Inter via `next/font/google` in layout.tsx (className on body) — touch NOTHING else in layout.tsx.

### View-model adapter — `src/lib/eventiq/`
- `types.ts` + `meta.ts`: port verbatim from source (EventModel, VendorContact, Milestone, metas, toneClasses; export `type Tab`from a ported `TabBar.tsx` exactly like the source).
- `adapters.ts`: map real data → `EventModel`:
  - Inputs: `EventSummary` (GET /api/events) + details payload (GET /api/events/[id]/details → `{details, name, status, attendeeCount, date}`).
  - `status`: `'in-progress'` → `'in_progress'`; others pass through.
  - `type`: substring-match the brief's free-text type against eventTypeMeta keys; fallback `'other'`.
  - `venue`: from `details.confirmedVenue` → `{name, address: <location or name>, confirmed: status==='confirmed'}`.
  - `catering`: from `details.confirmedCatering` → `{name, menu: price ?? '', confirmed: status==='confirmed'}`.
  - `attendees`: `attendeeCount > 0` → `{count: attendeeCount, confirmed: 0}` (no RSVP source today).
  - `schedule`: `details.schedule` → `{time, title: title + (speaker ? ' — '+speaker : '')}`.
  - `budget`: `{total: details.budget?.total ?? 0, committed: details.budget?.committed ?? sum(items), spent: details.budget?.committed ?? sum(items)}`.
  - `topics`: `details.topics`.
  - `vendors`: from `details.contacts[]` → VendorContact with `id: 'contact-<idx>'`, category guessed from name keywords
    (venue/cater/photo/dj/music/flower/cake/transport/decor → category, else 'other'), status map: confirmed→booked,
    messaging→awaiting_confirmation, pending→quote_requested. Read optional ADDITIVE per-contact fields `notes` and
    `history` (statusHistory) if present.
  - `milestones`: DERIVED planning checklist from real details (these power the Checklist card + Calendar chips):
    'Confirm date' (done iff confirmedDate, category other), 'Confirm venue' (venue), 'Confirm catering' (catering),
    'Build day-of schedule' (logistics), 'Add vendor contacts' (communication), 'Set budget' (finance) — date = event date, status done/pending. Stable ids `ms-<slug>`.
  - `coverImage`: `details.coverImage` (additive string field, data URL).
- Writes go through the EXISTING `PATCH /api/events/[id]` route's allowed `details` field (merge-update the details object):
  vendor status/notes/history changes mutate the matching `details.contacts[idx]` (additive fields ok), cover image sets `details.coverImage`.
  NEVER send fields outside the allowed list ['name','pinned','status','date','attendeeCount','type','location','details'].

### Details store — `src/stores/event-models-store.ts` (NEW file)
Zustand store: `detailsById: Record<string, DetailsPayload>`, `fetchDetails(id)`, `fetchAllDetails(ids)` (parallel),
`patchDetails(id, mutate)` (optimistic local + PATCH details + refetch), and 5s polling for ONE id (`startPolling(id)`/`stopPolling()`)
to preserve the whiteboard-style freshness for the open event (chat updates appear within 5s on the Dashboard).
Selector `useEventModel(id)` composes app-store summary + details → adapted EventModel. Do NOT modify app-store/chat-store.

### Component wiring map (port from source, swap mock → real)
- `Sidebar.tsx`: 4 nav items (My Events, Calendar, Providers, Billing) + New Event button + logo `/logo-wide.svg` (h-8) +
  footer = REAL `<UserMenu />` (existing component, import from `@/components/sidebar/UserMenu`) replacing the hardcoded
  'Jamie Doe' card, plus a credits pill (GET /api/credits → `N credits`, Sparkles icon) above it. Keep glow-primary active style + mobile drawer.
- `MyEventsPage.tsx`: events = adapted models from stores. Keep filters/popover/grid/stat-strip/empty states. ADD (preserving existing app features):
  hover action icons on each card for Pin/Unpin (app-store.pinEvent) and Delete (app-store.deleteEvent w/ confirm) — small icon buttons, stopPropagation.
- `CalendarPage.tsx`: events = adapted models incl. derived milestones. Keep month grid/chips/overflow.
- `OverviewTab.tsx`: real adapted event; cover upload: compress client-side via canvas (max 1024px, JPEG q0.72; reject >280KB result with sonner toast)
  → `patchDetails(id, details.coverImage = dataURL)`. Vendor table from adapted vendors. Maps iframe from venue address. S$ for currency.
- `DeliveryTracker.tsx`: port as-is over adapted model.
- `VendorDetailPanel.tsx`: status select + notes blur-commit + history → `patchDetails` mutating `details.contacts[idx]`
  (set `status` mapped BACK to contact status: booked/delivered→confirmed, awaiting_confirmation/quote_requested→pending, plus store the
  UI-level vendor status + history + notes in additive fields `uiStatus`, `history`, `notes` so round-trip is lossless).
- `ProvidersPage.tsx`: port (4th tab), rows from all adapted events.
- `BillingPage.tsx`: keep 3-card layout but REAL: Card1 'Credits balance' (GET /api/credits: balance big, totalPurchased/totalUsed subs);
  Card2 'Buy credits' = 4 tier buttons ($5/500, $10/1,100, $20/2,500, $50/7,000 — tier keys '5'|'10'|'20'|'50') →
  POST /api/credits/checkout {tier} → `window.location.href = url`; Card3 'Usage' (totalUsed, lastUpdated formatted). Use semantic tokens (replace raw emerald classes with success tone).
- `NewEventChat.tsx`: REAL chat that creates the event. Keep header/cancel/bubble styling/composer. First send: POST /api/chat
  `{message, eventId: null}` → on response ADOPT `data.eventId` (app-store setActiveEvent + fetchEvents) — CRITICAL, see recon risks.
  Subsequent sends use the adopted id. Render assistant content with existing `MarkdownMessage`; show cycling fake loading statuses
  (5 messages, 4s interval, cleared in finally — copy ChatPanel's pattern). Auth: if no session, show sign-in CTA (signIn('google')); 401 → signIn('google').
  Once an eventId exists show a 'Open event dashboard →' button (calls onCreated(eventId)). Props: `{onCancel, onCreated(eventId)}`.
  Use chat-store (clearMessages on mount, addMessage / setLoading / setLoadingStatus) so the thread carries into EventAgentChat.
- `EventAgentChat.tsx`: the event's REAL conversation in the new visual shell. Reuse chat-store + ALL existing chat feature components
  (`MarkdownMessage`, `ThinkingTrace`, `ReasoningTrace`, `ApprovalCard`, `OptionCardCarousel` from OptionCard.tsx, `ActionItems`, `MessageActions`)
  — replicate ChatPanel's logic faithfully (history fetch on event change, send flow, eventId adoption guard, loading cycle, edit/retry handlers,
  auth gating incl. Lock icon) but with the new design's header/bubbles. Props: `{event: EventModel, onClose}`.
- `FloatingAgentChat.tsx`: FAB + panel as in source. Real wiring: linked event → load thread GET /api/events/[id]/messages (local state),
  send POST /api/chat {message, eventId: linkedId}, append response. Unlinked send → POST {message, eventId: null}, adopt returned id
  (auto-link + fetchEvents). Keep event-name mention detection over real events, auto-link to activeEventId, Unlink button, greetings.
  Render assistant bubbles with MarkdownMessage. NO localStorage threads — server is the source of truth.
  If linked id === app-store activeEventId, ALSO mirror sends into chat-store so the main chat stays in sync.
- `TabBar.tsx`: port file for its `export type Tab = 'calendar' | 'events' | 'providers' | 'billing'` (extended with 'providers').

### Shell — `src/app/page.tsx` (full rewrite, owns composition)
Port the source `routes/index.tsx` Index component structure: Sidebar + main + VendorDetailPanel + FloatingAgentChat.
- active event id = **app-store `activeEventId`** (so whiteboard/chat logic keeps working); local state for tab/creating/openVendorId/dark/sidebarOpen.
- Event view toggle: segmented pill with THREE options: **Dashboard | Whiteboard | Agent chat** — Dashboard = OverviewTab,
  Whiteboard = existing `<WhiteboardView />` (UNTOUCHED import, it reads activeEventId itself), Agent chat = EventAgentChat.
- Open event: `setActiveEvent(id)` + chat-store `loadConversation(id)` (mirrors EventSidebar behavior). Back: `setActiveEvent(null)` + clearMessages.
- New Event: `setActiveEvent(null)` + `clearMessages()` + creating=true → NewEventChat; `onCreated(id)` → exit creating, open event.
- Theme bootstrap + toggle exactly like source (localStorage 'eventiq-theme', prefers-color-scheme, `dark` class on documentElement).
- Fetch events on session (useSession) like EventSidebar did; start/stop details polling for the active event.
- Mobile hamburger + drawer; vendor panel `key={vendor.id}`; FAB always mounted.

## Verification gates
- `npx tsc --noEmit` clean; `npm run build` succeeds.
- `git diff --name-only` touches ONLY: package.json, package-lock.json, tailwind.config.ts, src/app/globals.css,
  src/app/layout.tsx, src/app/page.tsx, + NEW files in the allowed dirs.
- layout.tsx diff = font addition only.
- Every recon-ui feature present; zero mock data / canned replies / localStorage threads in final code.
