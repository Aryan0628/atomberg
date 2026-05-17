// app/api/qstash/setup/route.ts
// One-time admin endpoint: registers the Kafka consumer schedule with Upstash QStash.
// Call once after deployment — QStash persists the schedule indefinitely.
//
// Schedule: every 10 minutes (*/10 * * * *).
// Cost: 144 QStash messages/day for scheduling, leaving 356/day for actual events
// on the free tier (500/day total).
//
// DELETE — removes the schedule (use if redeploying to a new URL).

import { auth } from "@/lib/auth";
import { Client } from "@upstash/qstash";
import { NextResponse } from "next/server";

function getClient(): Client | null {
  if (!process.env.QSTASH_TOKEN) return null;
  return new Client({ token: process.env.QSTASH_TOKEN });
}

/** POST /api/qstash/setup — creates the consumer schedule (idempotent). */
export async function POST() {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: "QSTASH_TOKEN not configured" }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL not configured" }, { status: 503 });
  }

  // Idempotent: skip creation if a schedule for this endpoint already exists
  const existing = await client.schedules.list();
  const consumerUrl = `${appUrl}/api/kafka/consumer`;
  const already = existing.find((s) => s.destination === consumerUrl);
  if (already) {
    return NextResponse.json({
      message: "Schedule already exists — no action taken",
      scheduleId: already.scheduleId,
      cron: already.cron,
    });
  }

  const schedule = await client.schedules.create({
    destination: consumerUrl,
    cron: "*/10 * * * *",
    retries: 3,
  });

  return NextResponse.json({
    message: "QStash schedule created",
    scheduleId: schedule.scheduleId,
    cron: "*/10 * * * *",
    destination: consumerUrl,
  });
}

/** DELETE /api/qstash/setup — removes the consumer schedule. */
export async function DELETE() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: "QSTASH_TOKEN not configured" }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const consumerUrl = `${appUrl}/api/kafka/consumer`;
  const existing = await client.schedules.list();
  const found = existing.find((s) => s.destination === consumerUrl);

  if (!found) {
    return NextResponse.json({ message: "No schedule found for this endpoint" });
  }

  await client.schedules.delete(found.scheduleId);
  return NextResponse.json({ message: "Schedule deleted", scheduleId: found.scheduleId });
}
