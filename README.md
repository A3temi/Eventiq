# Eventiq — AI Event Organizer

Multi-agent AI system for end-to-end event planning in Singapore. Chat with the AI, and it handles venues, vendors, catering, payments, ticketing, scheduling, and communications through specialized agents.

Built for the **NEXT Hackathon** (SuperAI, Singapore, June 2025).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Vercel)                                  │
│  Next.js 15 + React 19 + Tailwind + React Flow     │
│  Chat Mode ↔ Whiteboard Mode                       │
└──────────────────────┬──────────────────────────────┘
                       │ API Routes (serverless)
                       ▼
┌─────────────────────────────────────────────────────┐
│  Agent Backend (AWS us-east-1)                      │
│                                                     │
│  ┌───────────┐  ┌──────────┐  ┌────────────────┐   │
│  │ DynamoDB  │  │   SQS    │  │  S3 (assets)   │   │
│  │ (9 tables)│  │ (tasks)  │  │                │   │
│  └───────────┘  └──────────┘  └────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ ECS Fargate                                  │   │
│  │  • WAHA (WhatsApp) — 100.53.19.175:3000      │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  Stripe  │  │   Exa    │  │ AWS SES  │
   │ payments │  │  search  │  │  email   │
   └──────────┘  └──────────┘  └──────────┘
```

## What's Working

| Component | Status | Details |
|-----------|--------|---------|
| DynamoDB (9 tables + GSIs) | ✅ Live | events, conversations, tasks, payments, credits, credit-transactions, attendees, communications, audit |
| S3 bucket | ✅ Live | `eventbot-assets-902787149251` |
| SQS queue | ✅ Live | Agent task distribution |
| ECS Cluster | ✅ Live | `eventbot-services` |
| WAHA (WhatsApp) | ✅ Running | Fargate task, session connected |
| AWS Bedrock (LLMs) | ✅ Working | Claude Sonnet + Claude Haiku |
| Gmail SMTP (Email) | ✅ Working | Sends to anyone, no domain needed |
| Stripe integration | ✅ Sandbox | Platform checkout + credits + Connect |
| Exa API | ✅ Key configured | Venue & vendor search |
| Frontend (Next.js) | ✅ Builds | Zero vulnerabilities, zero type errors |
| Agent orchestrator | ✅ Code complete | Intent parsing → task delegation |
| 7 specialized agents | ✅ Code complete | venue, vendor, payment, communication, attendee, schedule, analytics |
| Per-agent model routing | ✅ Configured | Claude Sonnet for orchestrator, Haiku for sub-agents (all via Bedrock) |
| Human approval gates | ✅ Code complete | Payments > 50 SGD, bulk messages, commitments |
| Budget tracking | ✅ Code complete | Committed vs spent, 80% warnings, reallocation |
| Credit system | ✅ Code complete | Purchase via Stripe, deduct per operation |

## What's Not Yet Working

| Component | Issue | Fix Needed |
|-----------|-------|------------|
| Vercel deployment | Not deployed yet | Push to GitHub, connect to Vercel |
| Stagehand (browser automation) | Not deployed to ECS | Lower priority — everything else works without it |

## How We Set It Up

### Infrastructure (automated via scripts)

1. **AWS credentials** configured via `aws configure` (IAM user `team8-user4`)
2. **DynamoDB tables** created via `node infra/create-tables.js` (9 tables with PAY_PER_REQUEST billing)
3. **GSIs added** via `node infra/add-gsi.js` (UserEventsIndex on events, QRCodeIndex on attendees)
4. **S3 bucket** created via `aws s3 mb`
5. **SQS queue** created via `aws sqs create-queue`
6. **ECS cluster** created via `aws ecs create-cluster`
7. **WAHA deployed** via `node infra/setup-ecs.js`:
   - Created IAM role `ecsTaskExecutionRole` with ECS + CloudWatch policies
   - Created security group with port 3000 open
   - Registered Fargate task definition (512 CPU, 1024 MB)
   - Created service with 1 desired task, public IP enabled

**Region note**: `ap-southeast-1` was blocked by an organizational SCP, so all resources are in `us-east-1`.

### Cost Optimization (Model Routing via AWS Bedrock)

All LLM calls run through AWS Bedrock — no separate API keys needed.

| Agent | Model | Why |
|-------|-------|-----|
| Orchestrator | Claude Sonnet (Bedrock) | Complex reasoning, multi-step planning |
| Venue/Vendor/Schedule/Analytics | Claude Haiku (Bedrock) | Structured extraction, ~20x cheaper |
| Communication | Claude Haiku (Bedrock) | Template-based message drafting |
| Payment/Attendee | No LLM | Pure business logic, zero cost |

## WAHA Login

The WAHA dashboard at `http://3.84.151.59:3000` asks for username/password.

**Default credentials: `admin` / `admin`**

(API key for programmatic access: `eventiq2025`)

After logging in:
1. Go to Sessions → Start New Session
2. A QR code will appear
3. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
4. Scan the QR code
5. Done — the bot can now send/receive WhatsApp messages

## Local Development

```bash
# Install dependencies
npm install

# Add your API keys to .env.local
# Required: ANTHROPIC_API_KEY, OPENAI_API_KEY, NEXTAUTH_SECRET

# Run dev server
npm run dev

# Run tests
npm test
```

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (set env vars in Vercel dashboard)
vercel deploy --prod
```

**Environment variables to set in Vercel:**
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `EXA_API_KEY`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (us-east-1)
- `DYNAMODB_TABLE_PREFIX` (eventbot)
- `WAHA_API_URL`, `WAHA_API_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

**Google OAuth setup:**
- Authorized JavaScript origin: `https://your-app.vercel.app`
- Authorized redirect URI: `https://your-app.vercel.app/api/auth/callback/google`

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, shadcn/ui, React Flow, Framer Motion, Zustand
- **AI**: Vercel AI SDK 6, Claude Sonnet + Claude Haiku via AWS Bedrock
- **Backend**: AWS DynamoDB, S3, SQS, ECS Fargate, Bedrock
- **Payments**: Stripe (platform + Connect)
- **Search**: Exa API
- **Messaging**: WAHA (self-hosted WhatsApp on ECS), Gmail SMTP (email)
- **Testing**: Vitest, fast-check (property-based)

## Project Structure

```
src/
├── app/              # Next.js App Router pages + API routes
│   ├── api/chat/     # Main chat endpoint (orchestrator)
│   └── api/webhooks/ # Stripe webhooks
├── agents/           # Specialized AI agents
│   ├── orchestrator/ # Intent parsing, delegation, approval
│   ├── venue/        # Venue search via Exa
│   ├── vendor/       # Vendor discovery + catering
│   ├── payment/      # Stripe checkout, credits, Connect
│   ├── communication/# Email (SES) + WhatsApp (WAHA)
│   ├── attendee/     # Registration, check-in, QR codes
│   ├── schedule/     # Agenda builder, conflict detection
│   └── analytics/    # Reports, ROI, attendance stats
├── components/       # React components (chat, whiteboard, sidebar)
├── lib/              # Shared utilities (DynamoDB, Exa, retry, AI gateway)
├── stores/           # Zustand state management
└── types/            # TypeScript interfaces
infra/                # AWS provisioning scripts
```

## Prizes Targeted

- **Top 5 Overall**: Multi-agent orchestration with Vercel AI SDK + AI Gateway
- **Best Use of Exa**: Venue/vendor research with semantic search
- **Best Use of Stripe**: Triple integration (platform checkout + credits + Connect)
