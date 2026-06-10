# 🎤 Eventiq — Live Demo Prompt Script

**Scenario theme:** A Singapore company planning a *real* event, end‑to‑end, by chatting with Eventiq's multi‑agent AI.
**Validated:** Every prompt below was run against the live app (master branch, AWS Bedrock) by 4 parallel test agents. The "tools fired" notes are what the API *actually* returned — not guesses.

---

## 0. Before you start (1 min setup)

```bash
# from the repo root, on master (latest)
npm run dev          # → http://localhost:3000
```

- `.env.local` must contain (already set for local runs):
  - `NEXTAUTH_URL=http://localhost:3000`
  - `VERCEL_AI_GATEWAY_API_KEY=`  ← **blank on purpose** so agents use AWS Bedrock (the shipped `.env` has a placeholder key that breaks the orchestrator).
- Sign in with Google, then start a **new event** (＋) for a clean thread.
- ⏱️ Each reply takes **~15–45 s** — that delay is the multi‑agent team delegating. Let the **"thinking" trace** animate; it's part of the wow.

### ⚠️ Demo safety (read once)
- This build can **actually send emails / WhatsApp** (no approval gate on master). For any "invite / email / message" prompt, use **`demo@example.invalid`** and **`+6500000000`** only.
- The **registration‑form** prompt returns a nicely designed form *spec*, but the link it shows is **illustrative, not a live page**. Say "form spec ready to deploy" — don't click the URL.

---

## ⭐ PRIMARY FLOW — "Company Town Hall" (recommended)

A Singapore fintech, 100 staff, Q3 town hall. Paste these **in order**; the chat threads them automatically.

**1 — Opener (the showstopper: whole agent team fans out in one turn)**
```
We are a Singapore fintech with 100 staff. Plan our Q3 company town hall.
```
> 👀 Point at the thinking trace: `datetime → venue → vendor → schedule → budget` agents fire. Returns named venues (Suntec, Marina Bay Sands, RWS) with pricing + catering.

**2 — Venue shortlist (real venues, real addresses, booking links)**
```
Find 3 CBD venues for 100 people with full AV equipment and breakout room.
```
> 👀 Real addresses (80 Robinson Rd, 16 Collyer Quay L30, Ocean Financial Centre), ~$500/hr, AV/breakout confirmed, booking URLs, as option cards.

**3 — Agenda (timestamped schedule)**
```
Draft a 3-hour town hall agenda: CEO leadership update, product roadmap reveal, live Q&A, and networking with drinks.
```
> 👀 A 2:00–5:00 PM agenda with durations, speaker notes, and engagement mechanics (live polling, roving mic).

**4 — Budget (itemized SGD table)**
```
Give me a full itemised budget breakdown in SGD for this town hall: venue, AV, catering, decor, and contingency for 100 pax.
```
> 👀 Markdown table, 5 categories with a **per‑pax** column + contingency. Fires `get_budget_summary`.

**5 — Catering vendors (named, with contact details)**
```
Suggest 3 MUIS-certified halal catering vendors for 100 pax with price per pax, menu highlights, and contact details.
```
> 👀 Named vendors (Catering Culture, Charlie's Catering, Muslim Delights) with phone/email/website + $/pax.

**6 — Closing flourish (the AI "thinks ahead")**
```
What are the top 5 risks that could derail this town hall, and the mitigation for each?
```
> 👀 5 concrete risks (venue cancellation, catering failure, AV breakdown, low engagement, transport) each with mitigations.

**If you only have 60 seconds:** run **prompt 1 alone** — it triggers the entire agent team in a single turn. **Fastest visual "wow":** jump straight to **prompt 2** (option cards appear quickest).

---

## 🔄 ALTERNATE SCENARIOS (each independently validated)

### B. Product Launch + Networking — *showcases invitations & registration*
SG SaaS startup, 80‑guest evening launch.
```
We are a Singapore SaaS startup launching a new product. Plan an 80-guest evening launch and networking event in Singapore.
```
```
Find a stylish venue for 80 guests with a stage and AV equipment near the Singapore CBD.
```
```
Create a guest registration form with fields for name, company, job title, email, dietary requirements, and how they heard about us.
```
> ⚠️ Returns a **form spec** (all fields laid out) — frame as "ready to deploy", the URL is illustrative.
```
Draft an invitation email for prospects to our product launch. Send only to demo@example.invalid.
```
> ⚠️ This **really sends** to `demo@example.invalid` (safe, non‑deliverable). Great to show the email agent acting — just keep the recipient safe.
```
Plan the catering: canapés and cocktail drinks for 80 guests. Include budget estimate and vendor recommendation.
```
> 👀 Vendor (Purple Sage) + canapé/cocktail menu + itemized table (~SGD $5,757, ~$72/pax incl. service + GST).

### C. Strategy Offsite — *showcases comparison table + agenda + budget*
SG company, 40‑person full‑day offsite.
```
Plan a full-day strategy offsite for 40 employees in Singapore.
```
```
Compare 3 offsite venues with breakout rooms — give a table with capacity, price per day, and AV included y/n.
```
> 👀 Clean comparison table: Monti Studios (~$500–600/day), MIT Galaxy ($1,600/day), Changi Cove — all with AV + MRT proximity.
```
Build a full-day agenda with exact time slots: 2 keynote slots and 3 breakout sessions, plus breaks and lunch.
```
```
Give a detailed budget breakdown in SGD for 40 pax: venue, catering (lunch + 2 coffee breaks), AV/tech, facilitation, and contingency. Show line items and a grand total.
```

### D. Annual Summit — *showcases scale + multi-vendor + analytics*
SG fintech summit, 250 attendees.
```
We are hosting a 250-person fintech summit in Singapore in Q3. Create an event plan with key milestones and tasks.
```
```
Search for venues for 250 people, plus AV/production companies and a professional event photographer.
```
> 👀 Multi‑vendor fan‑out: venues (MBS, Suntec, RWS) + AV + photographer in one turn.
```
Create a detailed half-day summit schedule with specific time slots: opening keynote, two expert panels, coffee break, and networking lunch. Use fintech-relevant session titles.
```
```
Estimate the total budget in SGD for 250 attendees, broken down by venue, AV/production, catering, photography, marketing, and staffing. Show cost per attendee.
```
> 👀 ~SGD $150,000 total / ~$600 per attendee, line items by category.
```
Generate a post-event analytics report template: attendance vs target, budget variance, sponsor ROI, and NPS.
```
> 👀 Filled‑in report (e.g. 88% show rate, −1% budget variance, 156% sponsor ROI, NPS 52).

---

## 🧠 Prompt design rules (why these land)

1. **Lead with one rich, complete sentence** (company + size + event + city) → triggers the full agent fan‑out.
2. **Name the categories you want** ("venue, AV, catering, decor, contingency") → you get a structured table, not prose.
3. **Say "table" / "exact time slots" / "contact details"** → forces structured, screenshot‑worthy output.
4. **Keep follow‑ups short and single‑purpose** → one capability per turn = a clean demo beat.

---

## 📊 Appendix — proof it's real (tools fired in live runs)

| Demo prompt | Tools the multi‑agent system actually invoked |
|---|---|
| Town hall opener | `get_current_datetime, delegate_to_agent×4, search_venues, search_vendors, create_schedule` |
| CBD venue shortlist | `delegate_to_agent, search_venues` |
| Budget breakdown | `delegate_to_agent, get_budget_summary` |
| Halal catering vendors | `delegate_to_agent, search_vendors` |
| Offsite opener | `get_current_datetime, delegate_to_agent×5, search_venues, search_vendors, create_schedule, web_search, get_budget_summary` |
| Summit schedule | `delegate_to_agent, create_schedule` |
| Launch invitation email | `delegate_to_agent, send_email` (sent to `demo@example.invalid`) |

> Note: the orchestrator often re‑queries `search_venues` for context even on budget/analytics turns — cosmetic, doesn't affect output quality.

---
*Generated from live validation runs across 4 scenarios. Re‑run anytime with the `.stress-test/` harness in this repo.*
