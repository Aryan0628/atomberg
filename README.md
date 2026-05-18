# AtomQuest — In-House Goal Setting & Tracking Portal

> **AtomQuest Hackathon 1.0 · Atomberg Technologies**
> Production-grade internal HR portal for end-to-end OKR/goal management across Employee, Manager, and Admin roles.

---

## Table of Contents

1. [Overview](#overview)
2. [Screenshots](#screenshots)
3. [Architecture Diagram](#architecture-diagram)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Database Schema](#database-schema)
6. [Authentication & Authorization](#authentication--authorization)
7. [Core Features](#core-features)
8. [AI Goal Coach Microservice](#ai-goal-coach-microservice)
9. [Cryptographic Audit Ledger](#cryptographic-audit-ledger)
10. [Scoring Engine](#scoring-engine)
11. [Escalation Engine](#escalation-engine)
12. [Notification System](#notification-system)
13. [Analytics & Reporting](#analytics--reporting)
14. [Unique Differentiators](#unique-differentiators)
15. [API Reference](#api-reference)
16. [Demo Journeys](#demo-journeys)
17. [Environment Variables](#environment-variables)
18. [Getting Started](#getting-started)
19. [Deployment](#deployment)
20. [Demo Credentials](#demo-credentials)

---

## Overview

AtomQuest digitises the entire annual goal lifecycle at Atomberg Technologies. Every business rule is enforced at **three levels**: the UI (instant feedback), the API route (Zod + auth guards), and the database (Prisma constraints + indexes).

**Three roles, three dashboards:**

- **Employee** — set goals, manage weightage, submit for approval, run quarterly check-ins, track scores live
- **Manager** — approve/reject/return goals, run team check-ins, view AI quality scores, generate annual reviews
- **Admin / HR** — manage org, configure fiscal cycles, view tamper-evident audit trails, export reports, view 7-chart analytics

---

## Screenshots

### Login — Quick-access demo cards for all 4 roles + Azure SSO button
![Login page](docs/screenshots/login.png)

### Employee Dashboard — Live countdown, Action Required center, weighted score & forecast
![Employee dashboard](docs/screenshots/employee-dashboard.png)

### Employee Goals — Weightage meter at 100%, UoM badges, score per goal
![Employee goals](docs/screenshots/employee-goals.png)

### AI Goal Coach — SMART criteria breakdown, policy issues, suggested title
![AI Goal Coach panel](docs/screenshots/ai-goal-coach.png)

### Manager Approvals — Per-goal AI quality score (8/10), SMART bars, policy issues, suggestions
![Manager approvals with AI analysis](docs/screenshots/manager-approvals.png)

### Admin Analytics — Stat cards, goal status distribution, thrust area breakdown
![Admin analytics overview](docs/screenshots/analytics-overview.png)

### Commitment vs Achievement Quadrant — Every employee plotted by commitment × achievement
![Performance quadrant chart](docs/screenshots/performance-quadrant.png)

### Cryptographic Audit Trail — Full lifecycle log with color-coded action badges
![Audit trail](docs/screenshots/audit-trail.png)

### Manager Dashboard — Team health, Goal Wellness grades, pending approvals
![Manager dashboard](docs/screenshots/manager-dashboard.png)

### Admin Org Chart — Interactive D3 hierarchy with role and department labels
![Org chart](docs/screenshots/org-chart.png)

### Admin Dashboard (Dark Mode) — Org pulse ticker, stat cards, analytics in dark theme
![Admin dark mode](docs/screenshots/admin-dark-mode.png)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│  │  Employee   │   │   Manager   │   │     Admin / HR      │  │
│  │  Dashboard  │   │  Dashboard  │   │     Dashboard       │  │
│  └──────┬──────┘   └──────┬──────┘   └──────────┬──────────┘  │
│         │                 │                      │             │
│  React + TanStack Query + Zustand + shadcn/ui + Recharts + D3  │
└─────────┼─────────────────┼──────────────────────┼─────────────┘
          │ HTTPS           │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NEXT.JS 15  (Vercel Edge)                      │
│                                                                 │
│  middleware.ts                                                  │
│  ├── JWT verification (NextAuth v5)                             │
│  ├── Role-based route guard                                     │
│  └── Rate limiting (Upstash)                                    │
│                                                                 │
│  App Router Pages                                               │
│  ├── /dashboard/employee/*                                      │
│  ├── /dashboard/manager/*                                       │
│  └── /dashboard/admin/*                                         │
│                                                                 │
│  API Routes (/api/*)                                            │
│  ├── goals/        cycles/       users/                         │
│  ├── analytics/    audit/        notifications/                 │
│  ├── ai/           export/       templates/                     │
│  ├── events/consumer             (QStash push receiver)         │
│  └── cron/escalate + cron/lock-goals (Vercel Cron — 2 slots)  │
│                                                                 │
│  Core Library (lib/)                                            │
│  ├── auth.ts       db.ts         scoring.ts                     │
│  ├── audit.ts      escalation.ts notifications.ts               │
│  ├── ai-client.ts  redis.ts      export.ts                      │
│  ├── events.ts     cycle.ts      cache.ts                       │
│  └── validations.ts weightage.ts teams.ts                       │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
    ┌──────────┴──────────┐    ┌──────────┴──────────────────┐
    │                     │    │                              │
    ▼                     ▼    ▼                              ▼
┌──────────┐   ┌──────────────────────┐       ┌─────────────────────┐
│PostgreSQL│   │  Upstash Redis       │       │ Python AI Service   │
│(Neon.tech│   │                      │       │ (Railway · Docker)  │
│          │   │ · Rate limiting      │       │                     │
│ Prisma 5 │   │ · Escalation         │       │ FastAPI + LangGraph │
│ SHA-256  │   │   dedup (24h)        │       │                     │
│ hash     │   │ · Response cache     │       │ /evaluate           │
│ chain on │   │ · Audit last-hash    │       │  brd_enforcer       │
│ AuditLog │   └──────────────────────┘       │  smart_analyzer     │
│          │                                  │  semantic_matcher   │
│ 13 models│   ┌──────────────────────┐       │  output_formatter   │
└──────────┘   │  Upstash QStash      │       │                     │
               │  (push event bus)    │       │ /review/synthesize  │
               │                      │       │  review_analyzer    │
               │  API publishes event │       │  review_enricher    │
               │  · goal.submitted    │       │  review_scorer      │
               │  · goal.approved     │       │  review_composer    │
               │  · goal.rejected     │       │                     │
               │  · goal.returned     │       │ /goals/check-       │
               │  · goal.shared       │       │  redundancy         │
               │                      │       │  redundancy_embedder│
               │  QStash immediately  │       │  redundancy_ranker  │
               │  POSTs to consumer   │       │  redundancy_recomm. │
               │  (3 retries on fail) │       │                     │
               └──────────┬───────────┘       │ HMAC-SHA256 auth    │
                          │                   │ Circuit breaker     │
                          ▼                   │ Gemini fallback     │
               ┌──────────────────────┐       └─────────────────────┘
               │  /api/events/consumer│
               │  (push receiver)     │
               │                      │
               │  · createNotification│
               │  · sendEmail (Resend)│
               │  · sendTeamsCard     │
               └──────────────────────┘

┌──────────────────────┐       ┌──────────────────────────┐
│  Resend + React Email│       │  Microsoft Teams Webhook │
│  (via QStash consumer│       │  (via QStash consumer)   │
│                      │       │                          │
│  6 templates:        │       │  · Goal submitted        │
│  · Goal submitted    │       │  · Checkin window open   │
│  · Goal approved     │       │  · Escalation alerts     │
│  · Goal rejected     │       │                          │
│  · Checkin reminder  │       │  No-op if env var unset  │
│  · Escalation alert  │       └──────────────────────────┘
│  · Welcome email     │
└──────────────────────┘
```

### Request Lifecycle

```
Browser
  → middleware.ts      (JWT verify + role guard)
  → API Route          (Zod validation + auth check)
  → Prisma transaction (DB write + writeAudit in one commit)
  → invalidateCache()  (Redis + in-memory)
  → publishEvent()     (fire-and-forget — never blocks response)
  → Response           (← returned immediately)

   ↓ async, seconds later (QStash push — no polling delay)
  Upstash QStash POSTs to /api/events/consumer
  → createNotification() (DB insert per user)
  → sendEmail()          (Resend)
  → sendTeamsCard()      (optional webhook)
  ← 200 OK tells QStash delivery succeeded; 500 triggers retry
```

### Cron Jobs (Vercel Hobby — 2 slots used)

```
02:30 UTC daily  →  /api/cron/escalate    →  runEscalationEngine()
                                               Redis dedup (24h TTL)
                                               Email + Teams notify

00:00 UTC hourly →  /api/cron/lock-goals  →  Auto-lock APPROVED goals
                                               when goalSettingClose passes
```

### Event Consumer (QStash push — no Vercel cron slot used)

```
Goal lifecycle event
  → publishEvent()  (API route, fire-and-forget void)
  → QStash receives event, immediately POSTs to /api/events/consumer
  → consumer handles: createNotification + sendEmail + sendTeamsCard
  → returns 200 OK (success) or 500 (QStash retries up to 3×)

Auth: QStash cryptographic signature (Upstash-Signature header)
      OR CRON_SECRET bearer token (manual trigger / local testing)

Fallback: if QSTASH_TOKEN is unset, isEventBusConfigured() returns false
          and API routes call email/notification directly inline — nothing breaks
```

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR + API routes + Edge middleware in one repo |
| Language | TypeScript 5 strict | Zero `any`, zero runtime surprises |
| Database | PostgreSQL via Neon.tech | Serverless, scales to zero, pgbouncer built-in |
| ORM | Prisma 5 | Type-safe queries, migration history, Neon adapter |
| Auth | NextAuth.js v5 | JWT sessions, role-aware, Credentials + Azure AD SSO |
| Styling | Tailwind CSS v4 + shadcn/ui | Full component library, dark mode via `dark:` classes |
| Charts | Recharts + D3 | Recharts for standard; D3 for achievement heatmap |
| Email | Resend + React Email | HTML emails rendered from React components |
| State | Zustand + TanStack Query | Zustand for UI state; TanStack Query for server state |
| Forms | React Hook Form + Zod | End-to-end type-safe, shared frontend ↔ API schemas |
| Export | xlsx (SheetJS) | Excel export with proper formatting |
| Toasts | Sonner | In-app toasts for every mutation |
| Rate Limiting | Upstash Redis | API protection + escalation deduplication |
| Async Events | Upstash QStash | Push-based event bus — publishes goal events, delivers to consumer with retries |
| Cron | Vercel Cron Jobs | Escalation engine + auto-lock goals (2 slots on Hobby) |
| AI Service | FastAPI + LangGraph + Gemini | Multi-agent goal evaluation pipeline |
| AI Deploy | Railway (Docker) | Zero-config Python container deploy |
| Fonts | Geist Sans + Geist Mono | Mono for scores and audit log values |

---

## Project Structure

```
atomberg/
│
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx              # Login with demo credential hints table
│   ├── api/
│   │   ├── action-items/route.ts       # Role-scoped proactive alerts (server-rendered)
│   │   ├── ai/
│   │   │   ├── evaluate/route.ts       # Goal quality coach proxy → Python service
│   │   │   ├── redundancy/route.ts     # Semantic redundancy detection proxy
│   │   │   └── review/route.ts         # Annual review synthesis proxy
│   │   ├── analytics/
│   │   │   ├── overview/route.ts
│   │   │   ├── qoq/route.ts
│   │   │   ├── heatmap/route.ts
│   │   │   ├── distribution/route.ts
│   │   │   └── manager-effectiveness/route.ts
│   │   ├── audit/
│   │   │   ├── route.ts                # Paginated, filterable audit trail
│   │   │   └── verify/route.ts         # SHA-256 chain integrity verification
│   │   ├── cycles/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── [id]/clone/route.ts     # Clone cycle, shift dates +1 year
│   │   │   └── current/route.ts
│   │   ├── escalations/
│   │   │   ├── route.ts
│   │   │   └── rules/route.ts
│   │   ├── export/
│   │   │   ├── csv/route.ts
│   │   │   └── excel/route.ts
│   │   ├── goals/
│   │   │   ├── route.ts                # GET filtered list, POST create
│   │   │   ├── bulk/route.ts           # Atomic bulk submit (validates active weightage = 100%)
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── approve/route.ts    # Approve / Reject / Return
│   │   │       ├── checkin/route.ts    # Quarterly check-in (validates window open)
│   │   │       ├── comments/route.ts   # Role-aware thread (isInternal filter)
│   │   │       ├── history/route.ts
│   │   │       ├── manager-checkin/route.ts
│   │   │       └── unlock/route.ts     # Admin unlock post-lock
│   │   ├── notifications/route.ts
│   │   ├── shared-goals/route.ts
│   │   ├── templates/route.ts
│   │   ├── users/route.ts
│   │   ├── events/
│   │   │   └── consumer/route.ts       # QStash push receiver — handles all goal lifecycle events
│   │   └── cron/
│   │       ├── escalate/route.ts       # Daily 02:30 UTC
│   │       └── lock-goals/route.ts     # Hourly — locks APPROVED goals after close
│   └── dashboard/
│       ├── employee/
│       │   ├── goals/page.tsx          # Goals list, weightage meter, rebalancer, submit
│       │   ├── goals/[id]/page.tsx     # Goal detail + timeline + comment thread
│       │   ├── goals/[id]/checkin/     # Quarterly check-in with live score preview
│       │   └── history/page.tsx
│       ├── manager/
│       │   ├── approvals/page.tsx      # Bulk queue + AI badges + per-goal comments
│       │   ├── team/page.tsx           # All reports × goals × scores + AI review
│       │   ├── checkins/page.tsx       # Manager check-in review hub
│       │   ├── shared-goals/page.tsx
│       │   └── escalations/page.tsx
│       └── admin/
│           ├── dashboard/page.tsx      # OrgPulseTicker + stat cards
│           ├── analytics/page.tsx      # 7 charts
│           ├── audit/page.tsx          # Audit trail + chain integrity button
│           ├── cycles/page.tsx         # Cycle manager + clone
│           ├── escalations/page.tsx    # Config + manual trigger
│           ├── org-chart/page.tsx
│           ├── architecture/page.tsx   # Live system architecture diagram + print-to-PDF
│           ├── reports/page.tsx        # Export center (CSV + Excel)
│           ├── templates/page.tsx      # Goal template CRUD
│           └── users/page.tsx
│
├── ai/                                 # Python microservice (Railway)
│   ├── main.py                         # FastAPI entry point, 3 endpoints
│   ├── auth.py                         # HMAC-SHA256 middleware
│   ├── graph.py                        # LangGraph: 4-node goal eval pipeline
│   ├── review_graph.py                 # LangGraph: 4-node annual review pipeline
│   ├── redundancy_graph.py             # LangGraph: 3-node redundancy pipeline
│   ├── golden_goals.py                 # 20 curated exemplar goals + cached embeddings
│   ├── nodes/
│   │   ├── brd_enforcer.py             # Deterministic BRD rule checks (no LLM)
│   │   ├── smart_analyzer.py           # Gemini Flash — SMART criteria scoring
│   │   ├── semantic_matcher.py         # Gemini embeddings + cosine similarity
│   │   ├── output_formatter.py         # Weighted aggregation → final score
│   │   ├── redundancy_embedder.py
│   │   ├── redundancy_ranker.py
│   │   ├── redundancy_recommender.py
│   │   ├── review_analyzer.py
│   │   ├── review_enricher.py
│   │   ├── review_scorer.py
│   │   └── review_composer.py          # Gemini Flash — narrative review draft
│   ├── Dockerfile
│   ├── railway.toml
│   └── requirements.txt
│
├── components/
│   ├── goals/
│   │   ├── AiAnalysisPanel.tsx         # SMART score bars + suggestions UI
│   │   ├── AnnualReviewModal.tsx        # AI-generated review modal (manager)
│   │   ├── GoalRing.tsx                 # SVG circular progress ring per goal
│   │   └── RedundancyWarning.tsx        # Near-duplicate warning in goal form
│   ├── employee/
│   │   └── GamificationBadges.tsx       # 10 achievement badges computed client-side
│   ├── layout/
│   │   ├── Header.tsx                   # Notification bell + role switcher
│   │   └── Sidebar.tsx                  # Collapsible role-aware nav
│   └── shared/
│       ├── ActionCenter.tsx             # Proactive action banners (all dashboards)
│       └── GoalCommentThread.tsx        # Employee ↔ Manager discussion thread
│
├── lib/
│   ├── ai-client.ts                     # HMAC signer + circuit breaker + Gemini fallback
│   ├── audit.ts                         # SHA-256 hash-chained audit writer (Redis-cached last hash)
│   ├── auth.ts                          # NextAuth v5 config
│   ├── cache.ts                         # Local-first → Redis cache with correct redisDel invalidation
│   ├── cycle.ts                         # getActiveCycle() shared helper with 60s cache
│   ├── db.ts                            # Prisma client singleton (pg.Pool max:1 for Neon serverless)
│   ├── escalation.ts                    # Escalation engine business logic
│   ├── export.ts                        # CSV + Excel generation (SheetJS)
│   ├── events.ts                        # QStash push event bus — typed events + publishEvent()
│   ├── notifications.ts                 # In-app + Resend email helpers
│   ├── rate-limit.ts                    # Upstash sliding window rate limiter
│   ├── redis.ts                         # Upstash Redis client (get / set / del)
│   ├── scoring.ts                       # All 5 UoM formulas + Wellness Score + Forecast
│   ├── teams.ts                         # Microsoft Teams webhook (graceful no-op)
│   ├── utils.ts                         # Date helpers, formatters, cn()
│   ├── validations.ts                   # Zod schemas shared frontend ↔ API
│   └── weightage.ts                     # Auto-rebalancer suggestion logic
│
├── hooks/
│   ├── useGoals.ts                      # TanStack Query hooks for goals + mutations
│   ├── useCycle.ts
│   ├── useNotifications.ts
│   └── useGsap.ts
│
├── emails/
│   ├── GoalSubmittedEmail.tsx
│   ├── GoalApprovedEmail.tsx
│   ├── GoalRejectedEmail.tsx
│   ├── CheckinReminderEmail.tsx
│   ├── EscalationEmail.tsx
│   └── WelcomeEmail.tsx
│
├── prisma/
│   ├── schema.prisma                    # 13 models, full schema
│   └── seed.ts                          # Rich demo data for all 3 roles
│
├── store/useAppStore.ts                 # Zustand: sidebar collapse, role switcher
├── types/index.ts                       # All shared TS interfaces + enums
├── middleware.ts                        # Auth + role routing
└── vercel.json                          # 2 cron job configs
```

---

## Database Schema

### Entity Relationship Overview

```
User
 ├── managerId      → User (self-referential — direct manager)
 ├── skipManagerId  → User (self-referential — skip-level manager)
 │
 ├──< Goal (ownedGoals)
 │     ├── cycleId    → Cycle
 │     ├── approverId → User
 │     │
 │     ├──< Checkin
 │     │     ├── employeeId → User
 │     │     └── cycleId    → Cycle
 │     │
 │     ├──< AuditLog (goalId)
 │     │     └── hash + previousHash  ← SHA-256 chain
 │     │
 │     └──< GoalComment
 │           ├── authorId   → User
 │           └── isInternal (manager-only notes, filtered at API)
 │
 ├──< Notification
 ├──< AuditLog (userId)
 └──< EscalationLog

Cycle
 ├── goalSettingOpen / goalSettingClose
 ├── q1Open / q1Close  ...  q4Open / q4Close
 ├──< Goal
 ├──< Checkin
 └──< EscalationRule
       ├── trigger: GOAL_NOT_SUBMITTED | GOAL_NOT_APPROVED | CHECKIN_NOT_COMPLETED
       ├── escalateTo: EMPLOYEE | MANAGER | SKIP_LEVEL | HR
       └── daysAfterTrigger: Int
```

### All 13 Models

| Model | Purpose |
|---|---|
| `User` | Org hierarchy, roles, avatar, last login |
| `Cycle` | Fiscal year with 9 configurable date windows |
| `Goal` | Central entity — full lifecycle, UoM, weightage, shared flag |
| `Checkin` | Quarterly actuals, score, self-assessment, manager review |
| `AuditLog` | Immutable log with SHA-256 hash chain |
| `Notification` | In-app notifications with deep links |
| `EscalationRule` | Configurable per cycle — trigger + target + days |
| `EscalationLog` | Record of every escalation email sent |
| `ThrustArea` | Admin-configurable org thrust areas |
| `GoalTemplate` | Reusable templates with usage count |
| `GoalComment` | Employee ↔ Manager discussion thread per goal |

### Goal Status Machine

```
DRAFT
  └──► SUBMITTED (bulk submit — atomic Prisma transaction)
         └──► UNDER_REVIEW
               ├──► APPROVED
               │      └──► LOCKED (auto-lock cron or admin manual)
               ├──► REJECTED  (employee can create replacement, slot freed)
               └──► RETURNED  (employee edits → back to DRAFT → resubmit)
```

---

## Authentication & Authorization

### NextAuth v5

- **Strategy:** JWT, 8-hour session expiry
- **Providers:** Credentials (email + bcrypt, 10 rounds) + Microsoft Entra ID (Azure AD — button shown in demo, grayed if env vars absent)
- **JWT callback:** Embeds `role`, `userId`, `managerId`, `department` into the token
- **Session callback:** Surfaces these fields on `session.user` for API routes and components

### Role Routing (middleware.ts)

```
/dashboard/employee/*  →  EMPLOYEE, MANAGER, ADMIN, HR
/dashboard/manager/*   →  MANAGER, ADMIN
/dashboard/admin/*     →  ADMIN, HR

Unauthenticated → redirect to /login
Wrong role      → redirect to role's home dashboard
```

### API Authorization Pattern

Every API route starts with:
```typescript
const session = await auth();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
if (!["MANAGER", "ADMIN"].includes(session.user.role))
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

Manager routes additionally verify goal ownership belongs to one of their direct reports.

---

## Core Features

### 1. Goal Creation & Lifecycle

**Business rules enforced at API level:**
- Max 8 active (non-REJECTED) goals per employee per cycle
- Total active goal weightage must equal exactly 100% before bulk submit
- Minimum 10% weightage per goal
- Goal-setting window must be open to create or submit
- Check-in window must be open to submit a check-in
- Goals lock automatically when `goalSettingClose` passes (hourly cron)
- REJECTED goals are excluded from weightage and goal count — their slot is freed

### 2. Unit-of-Measure (UoM) Types

Five types with distinct scoring formulas, computed in `lib/scoring.ts`:

| Type | Formula | Use Case |
|---|---|---|
| `NUMERIC_MIN` | `(actual / target) × 100` | Revenue, unit counts — higher is better |
| `NUMERIC_MAX` | `(target / actual) × 100` | TAT, error rates — lower is better |
| `PERCENTAGE` | `(actual / target) × 100` | Uptime %, satisfaction scores |
| `TIMELINE` | `100 if on-time; −5% per day overdue` | Project completion, training |
| `ZERO` | `actual === 0 ? 100 : 0` | Safety incidents, zero-defect targets |

### 3. Quarterly Check-ins

Each check-in captures:
- Actual value or actual completion date
- Progress status (NOT_STARTED / ON_TRACK / AT_RISK / COMPLETED / OVERDUE)
- Employee note, self-rating (1–5 stars)
- "What went well this quarter" and "Blockers faced"

Score is computed live on the client (optimistic preview) using the same `computeScore()` function as the server — no discrepancy possible.

### 4. Manager Approval Queue

- Bulk select → "Approve Selected" or "Return Selected" with shared reason
- Inline AI quality score badge (1–10) per goal, fetched on-demand
- Full employee ↔ manager comment thread visible per goal card
- Return requires reason ≥ 10 chars; Reject requires reason ≥ 10 chars
- Manager can override target and weightage during approval

### 5. Weightage Auto-Rebalancer

When active goal weightages don't sum to 100%:

```
remaining = 100% − sum(approved/submitted goal weightages)
per_draft_goal = remaining / count(draft_goals)

Last draft goal absorbs rounding remainder to guarantee exact 100%.
```

One click proportionally distributes only the unclaimed percentage across draft goals, leaving already-approved goals untouched.

### 6. Goal Templates Library

Admin creates templates per thrust area. Employee picks one in the creation form:
- Title, thrust area, UoM, suggested target, weightage pre-fill
- `usageCount` increments on use (admin popularity signal)
- Employee can override any field before saving

### 7. Shared / Departmental Goals

Manager creates a goal and assigns it to multiple employees. Rules:
- Recipients can only adjust their own weightage
- Title and target are read-only for recipients
- When the primary owner submits a check-in, actuals sync to all recipients

### 8. Cycle Clone

Admin clones the current cycle with one click:
- All 9 date windows shift forward exactly 1 year
- All EscalationRules are cloned for the new cycle
- New cycle starts as `isActive: false` — admin activates manually

---

## AI Goal Coach Microservice

### Architecture

A separate Python service on Railway, called from Next.js via HMAC-signed HTTP. This isolates LLM cost, latency, and failure from the core app.

```
Next.js /api/ai/evaluate
  │
  ├─ HMAC sign: SHA-256(timestamp + body, AI_SERVICE_SECRET)
  │  Headers: X-Service-Token, X-Timestamp
  │
  ├─ Circuit breaker (module-level state, survives warm instances)
  │   ├─ failures < 3  → call Python service (8s timeout)
  │   └─ failures ≥ 3  → direct Gemini call (bypass Python service)
  │
  └─ Python FastAPI on Railway
       ├─ HMAC middleware (rejects tokens > 30s stale)
       └─ LangGraph StateGraph
            ├─ brd_enforcer     (pure Python, zero LLM cost)
            ├─ smart_analyzer   (Gemini 1.5 Flash)
            ├─ semantic_matcher (Gemini text-embedding-004)
            └─ output_formatter (weighted aggregation)
```

### Pipeline 1 — Goal Quality Evaluation

**brd_enforcer** (no LLM): checks title length, UoM-target consistency, weightage bounds → `brd_issues[]`

**smart_analyzer** (Gemini Flash): scores each SMART dimension 1–10, generates suggestions and an improved title

**semantic_matcher** (Gemini embeddings): embeds goal against 20 pre-cached golden goals, returns closest match + cosine similarity

**output_formatter**: `score = (avg_SMART × 0.6) + (similarity × 30) − brd_penalty` → clamped 1–10, verdict assigned

```json
{
  "overall_score": 7,
  "verdict": "acceptable",
  "smart_scores": {
    "specific": 8, "measurable": 9,
    "achievable": 6, "relevant": 8, "time_bound": 5
  },
  "suggestions": ["Add a deadline to make this time-bound"],
  "improved_title": "Achieve 50L direct sales revenue by Q1 end",
  "semantic_match": { "title": "Quarterly Revenue Achievement", "similarity": 0.94 },
  "brd_issues": []
}
```

### Pipeline 2 — Annual Review Synthesis

Manager/HR triggers for any employee. Four nodes:

1. **review_analyzer** — computes weighted annual score, grade (A+ to D), checkin completion rate
2. **review_enricher** — Gemini extracts sentiment, recurring blockers, self-rating trends
3. **review_scorer** — recommended performance rating (Exceeds / Meets / Below Expectations)
4. **review_composer** — Gemini Flash writes a professional narrative paragraph

Output shown in `AnnualReviewModal` — copyable, includes quarterly narratives, strengths, and development areas.

### Pipeline 4 — Natural Language Goal Parser

Employee types a plain-English sentence ("I want to achieve 50L in sales by Q1") and the AI extracts a structured goal form. The `/nlp/parse-goal` endpoint in `ai/main.py` calls Gemini Flash with a structured extraction prompt and returns a JSON object with all goal fields pre-filled.

```json
{
  "title": "Achieve 50L in direct sales by Q1 end",
  "thrustArea": "Sales Revenue",
  "uomType": "NUMERIC_MIN",
  "target": 5000000,
  "uomUnit": "INR",
  "targetDate": null,
  "description": "Achieve 50 lakh in direct sales revenue through enterprise accounts"
}
```

The goal creation wizard has a "Parse from text" button. On click, text is sent to `/api/ai/parse-goal` (thin Next.js proxy → Python), and the response pre-fills all form fields. Employee reviews and confirms — no mandatory AI step.

### Pipeline 3 — Semantic Redundancy Detection

Debounced 1.5s after employee stops typing a goal title. Three nodes:

1. **redundancy_embedder** — embeds new goal + all existing submitted/approved goals
2. **redundancy_ranker** — cosine similarity; near-duplicate ≥ 0.85, highly-similar ≥ 0.70
3. **redundancy_recommender** — returns match list with level and recommendation

`RedundancyWarning` banner appears inline in the creation form — dismissible, advisory only, never blocks.

### Zero-Trust Service Auth

```
timestamp    = Unix epoch seconds
HMAC token   = SHA-256(timestamp + request_body, AI_SERVICE_SECRET)

Python rejects if:
  · timestamp > 30s old (replay attack protection)
  · HMAC mismatch (tampered body or wrong secret)
```

---

## Cryptographic Audit Ledger

Standard audit logs can be silently edited by anyone with DB access. Every `AuditLog` entry has a SHA-256 `hash` computed from its full payload chained to `previousHash`.

### Hash Chain

```
Entry 1 — GENESIS:
  previousHash = null
  hash = SHA256(JSON.stringify(payload) + "GENESIS")

Entry 2:
  previousHash = Entry1.hash
  hash = SHA256(JSON.stringify(payload) + Entry1.hash)

Entry N:
  previousHash = Entry(N-1).hash
  hash = SHA256(JSON.stringify(payload) + Entry(N-1).hash)
```

Payload includes every field: `userId, action, entityType, entityId, goalId, oldValue, newValue, ipAddress, userAgent, createdAt`. Changing any single character — including IP — invalidates the chain from that point forward.

### Tamper Detection — `/api/audit/verify`

- Admin / HR only
- Re-derives every hash from its payload + previousHash in sequence
- Returns `{ valid: boolean, totalEntries: number, firstTamperedId?: string }`
- Admin audit page shows the "Verify Chain Integrity" button; green or red banner on result

### Rules

- No DELETE endpoint for `AuditLog` — returns **405 Method Not Allowed** intentionally
- Concurrent writes at the same millisecond use `(createdAt DESC, id DESC)` ordering for deterministic chain order

---

## Scoring Engine

All logic in `lib/scoring.ts`, shared between server and client for consistency.

### Goal Wellness Score

```typescript
computeGoalWellness({
  goalsCount, weightageTotal,
  checkinCompletionRate, avgScore, reworkCount
}): { score: number; grade: "A"|"B"|"C"|"D"; issues: string[] }

// Deductions from 100:
//   No goals set:         −40
//   Weightage ≠ 100%:     −20
//   Check-ins < 50%:      −20
//   Avg score < 50%:      −10
//   Reworks > 2:           −5

// Grades: A ≥ 85 | B ≥ 70 | C ≥ 55 | D < 55
```

Shown as a letter badge per employee on Manager and Admin dashboards. Tooltip expands to the issues list.

### Annual Score Forecasting

```typescript
forecastAnnualScore(quarterScores: number[]): number
// Running average of available quarters
// Trend: up (≥ target+5%), flat (within 5%), down (< target−5%)
```

Shown on the employee dashboard "Forecast" card with a trend arrow.

---

## Escalation Engine

`lib/escalation.ts` runs daily at 02:30 UTC via Vercel Cron.

### Flow

```
1. Fetch active cycle + all escalation rules
2. For each rule:
   a. Find users matching the trigger condition
   b. Check Redis: key = esc:{userId}:{trigger}:{cycleId}:{escalateTo}
   c. Key exists  → skip (24h dedup, prevents spam)
   d. Key absent  →
        · Send email via Resend
        · Create EscalationLog
        · writeAudit(ESCALATION_SENT)
        · Set Redis key, TTL = 86400s
3. Return { processed: N }
```

### Triggers

| Trigger | Condition |
|---|---|
| `GOAL_NOT_SUBMITTED` | 0 submitted/approved/locked goals after N days since cycle open |
| `GOAL_NOT_APPROVED` | Goals submitted but manager hasn't approved after N days |
| `CHECKIN_NOT_COMPLETED` | Check-in window open but no check-in after N days |

Admin can also trigger manually from `/admin/escalations` → "Run Now" button.

---

## Notification System

### Event Bus (QStash Push)

Goal lifecycle side-effects (email, Teams, in-app notifications) are decoupled from the API response via QStash. The API route commits the DB write, publishes one typed event to QStash — then returns immediately. QStash delivers it to the consumer within seconds with up to 3 automatic retries on failure.

```
API Route  →  DB commit  →  publishEvent()  →  respond (done)
                                  ↓
                          Upstash QStash
                          (push delivery — no polling)
                                  ↓  immediately
                          /api/events/consumer
                          ├── createNotification()  (DB)
                          ├── sendEmail()           (Resend)
                          └── sendTeamsCard()       (optional webhook)
```

**Fallback:** if `QSTASH_TOKEN` is not set, `isEventBusConfigured()` returns false and API routes call email/notification directly inline — nothing breaks, same end result.

### In-App Notifications

- Stored in `Notification` model, created by the Kafka consumer
- Bell icon in Header with unread count badge, fetched every 60s
- Dropdown: last 10 notifications with color-coded icons, timestamps, deep-links
- "Mark all read" button

### Email Triggers

| Event | Recipient | Path |
|---|---|---|
| Employee bulk submits goals | Manager | QStash `goal.submitted` event |
| Goal approved | Employee | QStash `goal.approved` event |
| Goal rejected (with reason) | Employee | QStash `goal.rejected` event |
| Goal returned for rework | Employee | QStash `goal.returned` event |
| Escalation fires | Employee / Manager / Skip-level / HR | Direct (escalation cron) |
| New user created | New user (welcome + temp password) | Direct |

### Microsoft Teams (Optional)

`lib/teams.ts` — sends MessageCard via incoming webhook. Triggered by the QStash consumer alongside email for:
- Goal submission → manager's channel
- Escalation run summary → HR/Admin channel

Gracefully skips (no error, no log) if `TEAMS_WEBHOOK_URL` is not set.

---

## Analytics & Reporting

### 7 Charts on Admin Analytics Page

| # | Name | Library | Data |
|---|---|---|---|
| 1 | QoQ Achievement Trend | Recharts LineChart | Avg weighted score per dept Q1–Q4 |
| 2 | Achievement Heatmap | D3 SVG | Employee × Quarter grid, RdYlGn color scale |
| 3 | Goal Distribution | Recharts BarChart | By thrust area + UoM type breakdown |
| 4 | Manager Effectiveness | Recharts BarChart | Team check-in completion % per manager |
| 5 | Org Completion Funnel | Recharts FunnelChart | Employees → Goals set → Submitted → Approved → Checked in |
| 6 | Score Distribution | Recharts AreaChart | Distribution of quarterly scores |
| 7 | Commitment vs Achievement | Recharts ScatterChart | Each dot = employee; X = commitment rate, Y = achievement; 4-quadrant |

### OrgPulseTicker

Admin dashboard top banner, auto-refreshes every 30s:

```
Goal Setting: ████████░░ 78% employees submitted
Q1 Check-in:  ██████░░░░ 61% completed
Manager SLA:  ████████░░ 82% approved within 5 days
```

### Export

- **CSV** — `/api/export/csv`
- **Excel** — `/api/export/excel` (SheetJS, judges can open directly)
- Both write an `EXPORT_GENERATED` audit entry

---

## Unique Differentiators

| # | Feature | Location |
|---|---|---|
| 1 | SHA-256 cryptographic audit ledger | `lib/audit.ts`, `/api/audit/verify` |
| 2 | Multi-agent LangGraph AI Goal Coach | `ai/graph.py`, `ai/nodes/` |
| 3 | Semantic redundancy detection | `ai/redundancy_graph.py` |
| 4 | AI annual review synthesis | `ai/review_graph.py` |
| 5 | HMAC zero-trust service auth + circuit breaker | `lib/ai-client.ts`, `ai/auth.py` |
| 6 | Goal Wellness Score (A/B/C/D grade) | `lib/scoring.ts` |
| 7 | Commitment vs Achievement quadrant chart | Admin analytics Chart 7 |
| 8 | Smart weightage auto-rebalancer | Employee goals page, `lib/weightage.ts` |
| 9 | Proactive Action Required center | `components/shared/ActionCenter.tsx` |
| 10 | Live countdown timer in cycle banner | Dashboard layout |
| 11 | Role switcher for demo mode | Header dropdown |
| 12 | Cycle clone (shift all dates +1 year) | `/api/cycles/[id]/clone` |
| 13 | Goal lifecycle timeline | Employee goal detail page |
| 14 | Manager ↔ employee comment thread per goal | `GoalCommentThread.tsx` |
| 15 | Annual score forecasting with trend arrow | Employee dashboard |
| 16 | REJECTED goals excluded from weightage + count | Goals page + bulk submit API |
| 17 | GoalRing SVG progress circles per goal card | `components/goals/GoalRing.tsx` |
| 18 | Gamification achievement badges (10 types) | `components/employee/GamificationBadges.tsx` |
| 19 | Progressive Web App (installable, offline-capable) | `app/manifest.ts`, SVG icons |
| 20 | In-app architecture diagram + print-to-PDF | `/admin/architecture` |
| 21 | Natural language goal parser (AI) | `ai/main.py` `/nlp/parse-goal`, `/api/ai/parse-goal` |

---

## API Reference

### Goals

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/goals` | Any | Goals filtered by role (employees see own, managers see team) |
| POST | `/api/goals` | Employee | Create goal — validates window, max 8, min 10% weightage |
| GET | `/api/goals/:id` | Owner/Manager | Goal detail with checkins and comments |
| PUT | `/api/goals/:id` | Owner (DRAFT) | Update goal fields |
| DELETE | `/api/goals/:id` | Owner (DRAFT) | Delete draft goal |
| POST | `/api/goals/bulk` | Employee | Atomic bulk submit — validates active weightage = 100% |
| POST | `/api/goals/:id/approve` | Manager/Admin | Approve / Reject / Return with reason |
| POST | `/api/goals/:id/checkin` | Owner | Submit check-in — validates window open + goal locked |
| POST | `/api/goals/:id/unlock` | Admin | Unlock locked goal with reason |
| GET | `/api/goals/:id/comments` | Owner+Manager | Comments — internal notes filtered for employees |
| POST | `/api/goals/:id/comments` | Owner+Manager | Add comment; `isInternal` toggle for managers |

### Cycles

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/cycles` | Any | All cycles |
| POST | `/api/cycles` | Admin | Create with 9 date windows |
| GET | `/api/cycles/current` | Any | Active cycle |
| PUT | `/api/cycles/:id` | Admin | Update / activate / deactivate |
| POST | `/api/cycles/:id/clone` | Admin | Clone + shift dates +1 year |

### Analytics (all Admin/HR, 60s revalidation cache)

| Endpoint | Data |
|---|---|
| `/api/analytics/overview` | Org-wide completion stats |
| `/api/analytics/qoq` | Quarter-on-quarter trend per department |
| `/api/analytics/heatmap` | Employee × Quarter achievement grid |
| `/api/analytics/distribution` | By thrust area and UoM type |
| `/api/analytics/manager-effectiveness` | Team check-in completion per manager |

### AI (rate limited — 10 req/user/min)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/ai/evaluate` | Any authenticated | Goal quality score + SMART breakdown |
| POST | `/api/ai/redundancy` | Any authenticated | Semantic duplicate detection |
| POST | `/api/ai/review` | Manager/Admin/HR | Annual review synthesis for an employee |
| POST | `/api/ai/parse-goal` | Any authenticated | NLP goal parser — plain text → structured fields |

### Audit

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/api/audit` | Admin/HR | Paginated 15/page, filterable by action |
| GET | `/api/audit/verify` | Admin/HR | Re-derives full chain, returns tamper result |
| DELETE | `/api/audit` | — | **405 — intentional, no delete ever** |

---

## Demo Journeys

### Journey 1 — Employee (Sneha Roy)

1. Login with `sneha.roy@atomberg.com` / `Employee@123`
2. Goals page — 2 draft goals at 140% total (one approved already claims 60%)
3. Click "Auto-balance" → draft goals redistributed to fill remaining 40% → meter hits 100%
4. "Submit All Goals" button enables → click → manager notified
5. Create a new goal → type title → redundancy warning fires if similar goal exists
6. "Check quality" → AI panel shows SMART scores, suggestions, improved title → apply it

### Journey 2 — Manager (Vikram Singh)

1. Login with `vikram.singh@atomberg.com` / `Manager@123`
2. Approvals — see pending goals with AI score badges
3. Expand AI analysis inline → SMART breakdown per dimension
4. Add a comment on a goal → employee sees it on their goal detail page
5. Approve one, return one with reason, reject one
6. Team page → Goal Wellness grade per report → click "Generate Annual Review" → AI review modal

### Journey 3 — Admin

1. Login with `admin@atomberg.com` / `Admin@123`
2. Dashboard — OrgPulseTicker refreshing every 30s, live countdown in cycle banner
3. Analytics — all 7 charts; hover Commitment vs Achievement scatter chart
4. Audit Trail → "Verify Chain Integrity" → green banner
5. Escalations → "Run Now" → log entry appears instantly
6. Cycles → "Clone as next FY" → new cycle with dates shifted 1 year
7. Reports → Export Excel → file downloads with all goal data

---

## Environment Variables

```bash
# ── Database (Neon.tech) ─────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"

# ── Auth ─────────────────────────────────────────────────────────
NEXTAUTH_SECRET=""           # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# ── Email (Resend.com — free: 100 emails/day) ────────────────────
RESEND_API_KEY="re_..."

# ── Upstash Redis (free: 10K cmds/day) ──────────────────────────
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# ── Upstash QStash (free: 500 msgs/day) ─────────────────────────
# Push-based event bus: API routes publish goal events, QStash delivers them
# immediately to /api/events/consumer with up to 3 retries on failure.
# Get all four values from console.upstash.com → QStash → your instance → API Keys.
# Leave QSTASH_TOKEN empty to skip — API routes fall back to direct inline calls.
QSTASH_URL="https://qstash-us-east-1.upstash.io"
QSTASH_TOKEN="..."
QSTASH_CURRENT_SIGNING_KEY="..."
QSTASH_NEXT_SIGNING_KEY="..."

# ── Azure AD SSO (optional — grayed button if absent) ────────────
AZURE_AD_CLIENT_ID=""
AZURE_AD_CLIENT_SECRET=""
AZURE_AD_TENANT_ID=""

# ── AI Microservice (Railway) ────────────────────────────────────
GEMINI_API_KEY=""            # Google AI Studio — free tier
AI_SERVICE_URL=""            # Railway service URL after deploy
AI_SERVICE_SECRET=""         # openssl rand -hex 32 — same value in Vercel + Railway

# ── Cron / QStash security ───────────────────────────────────────
CRON_SECRET=""               # openssl rand -base64 32
                             # Used by: /api/cron/*, /api/kafka/consumer (manual trigger)

# ── App config ───────────────────────────────────────────────────
NEXT_PUBLIC_DEMO_MODE="true"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ── Teams (optional — silently skipped if empty) ─────────────────
TEAMS_WEBHOOK_URL=""
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+ (AI service only)
- Neon.tech PostgreSQL (or any PostgreSQL)
- Upstash Redis (free tier)
- Resend account (free tier)
- Google AI Studio API key (free)

### Install & Run

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Fill in DATABASE_URL, NEXTAUTH_SECRET, RESEND_API_KEY at minimum

# Push schema and seed
npx prisma db push
npx prisma generate
npx prisma db seed

# Start dev server
npm run dev
```

### AI Service (Local)

```bash
cd ai
pip install -r requirements.txt

export GEMINI_API_KEY=your_key
export AI_SERVICE_SECRET=your_shared_secret
export ALLOWED_ORIGINS=http://localhost:3000

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Set `AI_SERVICE_URL=http://localhost:8000` in `.env.local`.

### Verify

```bash
npx prisma studio    # Inspect seeded data in browser
npm run build        # TypeScript check — must return 0 errors
```

---

## Deployment

### Next.js → Vercel

```bash
vercel --prod
```

Add all environment variables in the Vercel dashboard. The two cron jobs in `vercel.json` (`/api/cron/escalate` and `/api/cron/lock-goals`) activate automatically on Vercel Hobby.

### Set NEXT_PUBLIC_APP_URL on Vercel

Make sure `NEXT_PUBLIC_APP_URL` is set to your real Vercel deployment URL (not localhost). QStash uses this to know where to deliver events:

```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

No one-time setup call needed — QStash push is stateless. Every `publishEvent()` call includes the destination URL directly.

### AI Service → Railway

```bash
cd ai
railway up
```

Copy the Railway service URL → set as `AI_SERVICE_URL` in Vercel. Set the same `AI_SERVICE_SECRET` in both.

### Cost Profile

| Service | Tier | Cost/month |
|---|---|---|
| Vercel | Hobby | $0 |
| Neon PostgreSQL | Free | $0 |
| Upstash Redis | Free (10K cmd/day) | $0 |
| Upstash QStash | Free (500 msg/day) | $0 |
| Resend | Free (100 emails/day) | $0 |
| Google Gemini | Free tier | $0 |
| Railway (AI service) | Starter, scales to zero | ~$5 |
| **Total** | | **~$0–5/month** |

---

## Progressive Web App (PWA)

AtomQuest is installable as a PWA on Chrome, Edge, and Safari (iOS 16.4+).

- `app/manifest.ts` — `MetadataRoute.Manifest` with name, short_name, theme_color, start_url, orientation
- `public/icon-192.svg` and `public/icon-512.svg` — blue Atomberg "A" logo with amber "Q" badge
- `app/layout.tsx` — `appleWebApp` meta tags for iOS home-screen install
- `display: "standalone"` — hides browser chrome when launched from home screen

### Architecture Page

Available at `/dashboard/admin/architecture` (linked in admin sidebar under "Architecture"). Includes:

- Live system overview diagram showing all services and data flow
- AI microservice endpoints and LangGraph pipeline
- Complete tech stack table with cost column (~$5/month total)
- Database schema summary (all 13 models)
- Key request lifecycle flows
- Deployment topology (Vercel vs Railway)
- Security posture overview
- "Print to PDF" button (`window.print()`) for submission artifacts

---

## Demo Credentials

| Name | Email | Password | Role | Department |
|---|---|---|---|---|
| Admin User | admin@atomberg.com | Admin@123 | ADMIN | — |
| HR User | hr@atomberg.com | Hr@123 | HR | HR |
| Vikram Singh | vikram.singh@atomberg.com | Manager@123 | MANAGER | Sales |
| Deepa Nair | deepa.nair@atomberg.com | Manager@123 | MANAGER | Operations |
| Rahul Sharma | rahul.sharma@atomberg.com | Employee@123 | EMPLOYEE | Sales |
| Priya Mehta | priya.mehta@atomberg.com | Employee@123 | EMPLOYEE | Sales |
| Arjun Patel | arjun.patel@atomberg.com | Employee@123 | EMPLOYEE | Operations |
| Sneha Roy | sneha.roy@atomberg.com | Employee@123 | EMPLOYEE | Engineering |

> **Tip:** Use the role switcher dropdown in the top-right header to switch between any user without logging out. Enabled when `NEXT_PUBLIC_DEMO_MODE=true`.

---

*AtomQuest Hackathon 1.0 · Atomberg Technologies*
