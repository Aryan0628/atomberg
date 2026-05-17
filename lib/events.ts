// lib/events.ts
// COST: Upstash QStash — free tier: 500 messages/day.
// Architecture: push-based event bus. API routes publish a typed event to QStash,
// which immediately delivers it via HTTP POST to /api/events/consumer (with retries).
// No polling schedule needed — QStash handles delivery and retry on failure.
//
// Graceful degradation: if QSTASH_TOKEN is unset, isEventBusConfigured() returns false
// and all callers fall back to direct inline notification calls.

import { Client } from "@upstash/qstash";

// ─── Client ──────────────────────────────────────────────────────────────────

function getQStashClient(): Client | null {
  if (!process.env.QSTASH_TOKEN) return null;
  return new Client({
    token: process.env.QSTASH_TOKEN,
    // QSTASH_URL pins the regional endpoint (e.g. https://qstash-us-east-1.upstash.io).
    // Without it the SDK defaults to the global endpoint which may mismatch the account region.
    ...(process.env.QSTASH_URL ? { baseUrl: process.env.QSTASH_URL } : {}),
  });
}

export function isEventBusConfigured(): boolean {
  return !!(process.env.QSTASH_TOKEN && process.env.NEXT_PUBLIC_APP_URL);
}

// ─── Event Types ─────────────────────────────────────────────────────────────

export interface GoalSubmittedEvent {
  type: "goal.submitted";
  managerId: string;
  managerName: string;
  managerEmail: string;
  employeeName: string;
  employeeEmail: string;
  goalCount: number;
}

export interface GoalApprovedEvent {
  type: "goal.approved";
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  goalId: string;
  goalTitle: string;
}

export interface GoalRejectedEvent {
  type: "goal.rejected";
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  goalId: string;
  goalTitle: string;
  reason: string;
}

export interface GoalReturnedEvent {
  type: "goal.returned";
  ownerId: string;
  goalId: string;
  goalTitle: string;
  reason: string;
}

export interface GoalSharedEvent {
  type: "goal.shared";
  recipientIds: string[];
  goalTitle: string;
  senderName: string;
}

export type GoalEvent =
  | GoalSubmittedEvent
  | GoalApprovedEvent
  | GoalRejectedEvent
  | GoalReturnedEvent
  | GoalSharedEvent;

// ─── Publisher ───────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: publishes a typed event to QStash.
 * QStash immediately POSTs it to /api/events/consumer with up to 3 retries.
 * Never throws — failures are silently dropped so the API response is never blocked.
 */
export async function publishEvent(event: GoalEvent): Promise<void> {
  const client = getQStashClient();
  if (!client) return;
  try {
    await client.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/events/consumer`,
      body: event,
      retries: 3,
    });
  } catch {
    // fire-and-forget — never block the API response
  }
}
