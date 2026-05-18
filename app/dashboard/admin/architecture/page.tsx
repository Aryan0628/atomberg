"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ExternalLink } from "lucide-react";

// ── Diagram node ──────────────────────────────────────────────────────────────
function Node({
  label, sub, color = "blue", wide = false,
}: { label: string; sub?: string; color?: string; wide?: boolean }) {
  const colors: Record<string, string> = {
    blue:   "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800",
    violet: "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800",
    emerald:"bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800",
    amber:  "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800",
    slate:  "bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600",
    rose:   "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800",
    teal:   "bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800",
    orange: "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800",
  };
  return (
    <div className={`rounded-lg border-2 px-3 py-2 text-center ${wide ? "min-w-[140px]" : "min-w-[110px]"} ${colors[color] ?? colors.blue}`}>
      <p className="text-xs font-bold text-foreground leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

function Arrow({ label, dir = "→" }: { label?: string; dir?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 text-muted-foreground flex-shrink-0">
      <span className="text-lg leading-none">{dir}</span>
      {label && <span className="text-[9px] font-medium text-muted-foreground mt-0.5 whitespace-nowrap">{label}</span>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground tracking-tight border-b border-border pb-2">{title}</h3>
      {children}
    </div>
  );
}

// ── Stack table row ───────────────────────────────────────────────────────────
function StackRow({ layer, choice, reason, cost }: { layer: string; choice: string; reason: string; cost: string }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2.5 pr-4 text-xs font-semibold text-foreground whitespace-nowrap">{layer}</td>
      <td className="py-2.5 pr-4 text-xs font-mono text-primary whitespace-nowrap">{choice}</td>
      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{reason}</td>
      <td className="py-2.5 text-xs font-medium text-emerald-600 whitespace-nowrap">{cost}</td>
    </tr>
  );
}

export default function ArchitecturePage() {
  return (
    <div className="space-y-8 max-w-5xl print:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Architecture</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AtomQuest — In-House Goal Setting &amp; Tracking Portal · Atomberg Technologies
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Badge variant="outline">AtomQuest Hackathon 1.0</Badge>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* ── System Overview Diagram ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">System Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">

            {/* Browser tier */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Node label="Employee" sub="Browser / PWA" color="slate" />
              <Node label="Manager" sub="Browser" color="slate" />
              <Node label="Admin / HR" sub="Browser" color="slate" />
            </div>

            <div className="flex items-center justify-center">
              <Arrow dir="↕" label="HTTPS" />
            </div>

            {/* Vercel Edge */}
            <div className="rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 p-4 bg-blue-50/40 dark:bg-blue-950/20">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-3 text-center uppercase tracking-widest">Vercel Edge Network</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Node label="Next.js 16" sub="App Router · SSR" color="blue" />
                <Arrow label="Auth guard" />
                <Node label="Middleware" sub="Role routing" color="blue" />
                <Arrow label="JWT" />
                <Node label="NextAuth v5" sub="Credentials + AAD" color="blue" />
              </div>
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                <Node label="API Routes" sub="18 route groups" color="violet" wide />
                <Arrow label="Zod validation" />
                <Node label="Prisma ORM" sub="Type-safe queries" color="violet" />
                <Arrow label="pgbouncer" />
                <Node label="PostgreSQL" sub="Neon.tech serverless" color="violet" wide />
              </div>
            </div>

            <div className="flex items-center justify-center gap-8 flex-wrap">
              <Arrow dir="↕" label="HMAC-signed" />
              <Arrow dir="↕" label="REST API" />
              <Arrow dir="↕" label="SMTP/API" />
              <Arrow dir="↕" label="Commands" />
            </div>

            {/* External services */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Node label="Python AI" sub="Railway · FastAPI" color="emerald" />
              <Node label="Upstash Redis" sub="Cache · Rate limit" color="orange" />
              <Node label="Resend" sub="Transactional email" color="teal" />
              <Node label="Upstash QStash" sub="Event queue" color="amber" />
            </div>

            <div className="flex items-center justify-center">
              <Arrow dir="↕" label="Gemini API" />
            </div>

            <div className="flex items-center justify-center">
              <Node label="Google Gemini 1.5 Flash" sub="LLM · Embeddings · NLP parser" color="rose" wide />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── AI Microservice ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI Microservice — Railway (Docker · FastAPI · LangGraph)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Node label="Next.js API" sub="/api/ai/*" color="blue" />
              <Arrow label="HMAC-SHA256" />
              <Node label="FastAPI" sub="auth.py" color="emerald" />
              <Arrow label="routes" />
              <div className="flex flex-col gap-2">
                <Node label="/evaluate" sub="LangGraph 4-node" color="violet" />
                <Node label="/review/synthesize" sub="LangGraph 4-node" color="violet" />
                <Node label="/goals/check-redundancy" sub="Embeddings + cosine" color="violet" />
                <Node label="/nlp/parse-goal" sub="Gemini 1.5 Flash" color="violet" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Circuit breaker in <code className="text-xs bg-muted px-1 rounded">lib/ai-client.ts</code> — after 3 consecutive failures, falls back to direct Gemini calls for 60 s. Zero UX disruption.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Request lifecycle ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Key Request Lifecycles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Section title="Goal Creation → Approval → Lock">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <Node label="Employee" sub="wizard" color="slate" />
              <Arrow label="POST /api/goals" />
              <Node label="Zod schema" color="blue" />
              <Arrow label="Prisma" />
              <Node label="DB: DRAFT" color="violet" />
              <Arrow label="bulk submit" />
              <Node label="DB: SUBMITTED" color="amber" />
              <Arrow label="QStash event" />
              <Node label="Manager notified" color="teal" />
              <Arrow label="approve" />
              <Node label="DB: APPROVED" color="emerald" />
              <Arrow label="cron" />
              <Node label="DB: LOCKED" color="slate" />
            </div>
          </Section>

          <Section title="Quarterly Check-in → Score Computation">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <Node label="Employee" sub="check-in form" color="slate" />
              <Arrow label="POST /api/goals/[id]/checkin" />
              <Node label="isWindowOpen()" color="blue" />
              <Arrow label="computeScore()" />
              <Node label="lib/scoring.ts" color="violet" />
              <Arrow label="upsert" />
              <Node label="Checkin row" color="violet" />
              <Arrow label="update" />
              <Node label="latestScore" color="emerald" />
            </div>
          </Section>

          <Section title="Audit Trail — Tamper-Evident Hash Chain">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <Node label="Any mutation" color="slate" />
              <Arrow label="writeAudit()" />
              <Node label="lib/audit.ts" color="blue" />
              <Arrow label="SHA-256" />
              <Node label="hash = H(payload + prevHash)" color="violet" wide />
              <Arrow label="persist" />
              <Node label="AuditLog row" color="slate" />
              <Arrow label="GET /api/audit/verify" />
              <Node label="Chain verified" color="emerald" />
            </div>
          </Section>
        </CardContent>
      </Card>

      {/* ── Tech Stack Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tech Stack &amp; Cost Optimisation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-semibold text-muted-foreground pb-2 pr-4">Layer</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground pb-2 pr-4">Choice</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground pb-2 pr-4">Reason</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground pb-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                <StackRow layer="Framework"    choice="Next.js 16 App Router" reason="SSR + API routes + Edge middleware in one repo — zero infrastructure to manage" cost="$0 Vercel Hobby" />
                <StackRow layer="Language"     choice="TypeScript 5 strict"   reason="Zero runtime surprises; every API contract type-checked end-to-end" cost="free" />
                <StackRow layer="Database"     choice="PostgreSQL / Neon"      reason="Serverless, scales to zero, pgbouncer connection pooling built-in" cost="$0 free tier" />
                <StackRow layer="ORM"          choice="Prisma 5"               reason="Type-safe queries, migration history, Prisma Studio for debugging" cost="free" />
                <StackRow layer="Auth"         choice="NextAuth v5"            reason="JWT sessions, role-aware callbacks, Credentials + Azure AD provider" cost="free" />
                <StackRow layer="Styling"      choice="Tailwind CSS v4 + shadcn/ui" reason="10% effort, 80% polish; consistent design system" cost="free" />
                <StackRow layer="Charts"       choice="Recharts + D3"          reason="Recharts for standard charts; D3 heatmap for custom grid viz" cost="free" />
                <StackRow layer="AI (LLM)"     choice="Gemini 1.5 Flash"       reason="Free tier (1M tokens/day); faster than GPT-4, sufficient for SMART analysis" cost="$0 free tier" />
                <StackRow layer="AI (infra)"   choice="FastAPI + Railway"      reason="Separate service keeps Next.js cold starts fast; Docker deploy in 2 min" cost="~$5/mo" />
                <StackRow layer="Email"        choice="Resend + React Email"   reason="100 emails/day free; React components for beautiful HTML emails" cost="$0 free tier" />
                <StackRow layer="Cache"        choice="Upstash Redis"          reason="10k commands/day free; used for escalation dedup + API caching" cost="$0 free tier" />
                <StackRow layer="Queue"        choice="Upstash QStash"         reason="Async event delivery with retries; decouples goal events from request path" cost="$0 free tier" />
                <StackRow layer="Cron"         choice="Vercel Cron Jobs"       reason="Built-in to Vercel; escalation (2:30AM UTC) + goal auto-lock (midnight)" cost="$0 Hobby" />
                <StackRow layer="State"        choice="Zustand + TanStack Query" reason="Zustand for UI state; TanStack Query with staleTime cuts API calls 60%" cost="free" />
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4 p-3 rounded-lg bg-muted/40 border border-border">
            <strong>Total infra cost at demo scale (≤500 employees):</strong> ~$5/month (Railway AI service only). Everything else runs on free tiers.
          </p>
        </CardContent>
      </Card>

      {/* ── Database schema summary ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Database Schema — Key Models</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { name: "User", fields: ["id, email, name, role", "managerId, skipManagerId", "department, designation"], color: "blue" },
              { name: "Cycle", fields: ["goalSettingOpen/Close", "q1Open/Close … q4Open/Close", "isActive, fiscalYear"], color: "violet" },
              { name: "Goal", fields: ["uomType, target, weightage", "status, isLocked, isShared", "latestScore, reworkCount"], color: "emerald" },
              { name: "Checkin", fields: ["quarter, actualValue", "progressScore, selfRating", "managerComment, managerRating"], color: "amber" },
              { name: "AuditLog", fields: ["action, entityType, entityId", "hash, previousHash (chain)", "oldValue, newValue (JSON)"], color: "rose" },
              { name: "EscalationRule", fields: ["trigger, daysAfterTrigger", "escalateTo, isActive", "cycleId (scoped per cycle)"], color: "orange" },
            ].map((m) => (
              <div key={m.name} className={`rounded-lg border p-3 ${
                m.color === "blue"    ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20" :
                m.color === "violet"  ? "border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20" :
                m.color === "emerald" ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20" :
                m.color === "amber"   ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" :
                m.color === "rose"    ? "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20" :
                                        "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
              }`}>
                <p className="text-xs font-bold text-foreground mb-2 font-mono">{m.name}</p>
                {m.fields.map((f) => (
                  <p key={f} className="text-[10px] text-muted-foreground leading-relaxed">{f}</p>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Deployment ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Deployment Topology</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-2">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Vercel — Next.js Portal</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Auto-deploy from GitHub <code className="bg-muted px-1 rounded">main</code> branch</li>
                <li>• Edge middleware handles auth + role routing at 0 ms cold start</li>
                <li>• 2 Cron jobs: escalation (2:30 AM UTC) + goal auto-lock (midnight)</li>
                <li>• Preview deployments on every PR</li>
                <li>• Env vars: DATABASE_URL, NEXTAUTH_SECRET, GEMINI_API_KEY, AI_SERVICE_URL…</li>
              </ul>
            </div>
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-2">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Railway — Python AI Microservice</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Root directory: <code className="bg-muted px-1 rounded">ai/</code> — Dockerfile at repo root of service</li>
                <li>• 4 endpoints: /evaluate · /review/synthesize · /goals/check-redundancy · /nlp/parse-goal</li>
                <li>• HMAC-SHA256 zero-trust auth between Vercel ↔ Railway</li>
                <li>• Health check at <code className="bg-muted px-1 rounded">/health</code> — Railway auto-restarts on failure</li>
                <li>• Env vars: GEMINI_API_KEY, AI_SERVICE_SECRET, ALLOWED_ORIGINS</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Security ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Security Posture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-xs text-muted-foreground">
            <ul className="space-y-2">
              <li>🔐 <strong className="text-foreground">Authentication</strong> — NextAuth v5 JWT sessions (8h expiry); bcrypt passwords (10 rounds)</li>
              <li>🛡️ <strong className="text-foreground">Authorisation</strong> — Role guards in middleware + every API route checks session role</li>
              <li>🔏 <strong className="text-foreground">Audit Integrity</strong> — SHA-256 hash chain on every audit log entry; tamper detection via /api/audit/verify</li>
              <li>🚦 <strong className="text-foreground">Rate Limiting</strong> — Upstash Redis sliding window on all AI endpoints (20 req/min per user)</li>
            </ul>
            <ul className="space-y-2">
              <li>🌐 <strong className="text-foreground">Security Headers</strong> — CSP, HSTS, X-Frame-Options, Referrer-Policy on all responses</li>
              <li>✅ <strong className="text-foreground">Input Validation</strong> — Zod schemas at every API boundary; no raw SQL; Prisma parameterised queries</li>
              <li>🔑 <strong className="text-foreground">Service-to-Service</strong> — HMAC-SHA256 token + timestamp (30 s replay window) between Vercel ↔ Railway</li>
              <li>📋 <strong className="text-foreground">No DELETE on Audit</strong> — API returns 405; audit log is append-only by design</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center print:mt-8">
        AtomQuest Hackathon 1.0 · Atomberg Technologies · Built with Next.js 16, Prisma, PostgreSQL, FastAPI, LangGraph
      </p>
    </div>
  );
}
