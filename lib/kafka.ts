// lib/kafka.ts
// COST: Upstash Kafka — free tier: 10K messages/day, 10GB/month bandwidth.
// Architecture: serverless-friendly REST producer. Consumer is a Vercel cron function
// (every 2 min on Pro, every 1h on Hobby) — no persistent connection required.
//
// Graceful degradation: if UPSTASH_KAFKA_REST_URL is unset, isKafkaConfigured()
// returns false and all callers fall back to direct email/notification calls.
//
// Topics:
//   goal-events — carries all goal lifecycle events (email + Teams + in-app)

import { Kafka } from "@upstash/kafka";

// ─── Client ──────────────────────────────────────────────────────────────────

function getKafkaClient(): Kafka | null {
  const { UPSTASH_KAFKA_REST_URL, UPSTASH_KAFKA_REST_USERNAME, UPSTASH_KAFKA_REST_PASSWORD } =
    process.env;
  if (!UPSTASH_KAFKA_REST_URL || !UPSTASH_KAFKA_REST_USERNAME || !UPSTASH_KAFKA_REST_PASSWORD) {
    return null;
  }
  return new Kafka({
    url: UPSTASH_KAFKA_REST_URL,
    username: UPSTASH_KAFKA_REST_USERNAME,
    password: UPSTASH_KAFKA_REST_PASSWORD,
  });
}

export function isKafkaConfigured(): boolean {
  return !!(
    process.env.UPSTASH_KAFKA_REST_URL &&
    process.env.UPSTASH_KAFKA_REST_USERNAME &&
    process.env.UPSTASH_KAFKA_REST_PASSWORD
  );
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

export const KAFKA_TOPIC = "goal-events" as const;
export const CONSUMER_GROUP = "atomquest-consumer";
export const CONSUMER_INSTANCE = "vercel-cron";

// ─── Producer ────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: publishes an event to Kafka.
 * Never throws — failures are silently dropped so the API response is never
 * delayed by a Kafka connectivity issue.
 */
export async function kafkaProduce(event: GoalEvent): Promise<void> {
  const kafka = getKafkaClient();
  if (!kafka) return;
  try {
    const p = kafka.producer();
    await p.produce(KAFKA_TOPIC, JSON.stringify(event));
  } catch {
    // fire-and-forget — never block API response
  }
}

// ─── Consumer ────────────────────────────────────────────────────────────────

/**
 * Reads up to `maxMessages` events from the Kafka topic for the consumer group.
 * Upstash tracks offsets server-side — safe to call from stateless Vercel functions.
 */
export async function kafkaConsume(maxMessages = 20): Promise<GoalEvent[]> {
  const kafka = getKafkaClient();
  if (!kafka) return [];
  try {
    const c = kafka.consumer();
    const messages = await c.consume({
      consumerGroupId: CONSUMER_GROUP,
      instanceId: CONSUMER_INSTANCE,
      topics: [KAFKA_TOPIC],
      autoOffsetReset: "earliest",
    });
    return messages
      .slice(0, maxMessages)
      .map((m) => {
        try {
          return JSON.parse(m.value as string) as GoalEvent;
        } catch {
          return null;
        }
      })
      .filter((e): e is GoalEvent => e !== null);
  } catch {
    return [];
  }
}
