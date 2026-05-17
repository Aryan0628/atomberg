// app/api/kafka/consumer/route.ts
// Triggered every 10 minutes by Upstash QStash — not a Vercel cron.
// QStash is an independent HTTP scheduler (free tier: 500 msgs/day) so it does not
// consume any of Vercel Hobby's 2-cron-job quota.
//
// Auth: accepts EITHER an Upstash-Signature header (QStash production calls)
//       OR a CRON_SECRET bearer token (manual admin triggers / local testing).
//
// Consumer group offsets are tracked server-side by Upstash Kafka, so each message
// is processed exactly once even if multiple invocations overlap.

import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { kafkaConsume } from "@/lib/kafka";
import {
  createNotification,
  sendGoalSubmittedEmail,
  sendGoalApprovedEmail,
  sendGoalRejectedEmail,
} from "@/lib/notifications";
import { sendTeamsCard } from "@/lib/teams";

async function authorize(req: Request): Promise<boolean> {
  // Path 1 — QStash delivery (signed by Upstash, verified cryptographically)
  const qstashSig = req.headers.get("upstash-signature");
  if (qstashSig) {
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentKey || !nextKey) return false;
    const receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
    try {
      const body = await req.clone().text();
      return await receiver.verify({ signature: qstashSig, body });
    } catch {
      return false;
    }
  }
  // Path 2 — manual trigger (CRON_SECRET bearer token)
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await kafkaConsume(20);
  if (events.length === 0) {
    return NextResponse.json({ processed: 0, skipped: "no messages" });
  }

  let processed = 0;
  const results = await Promise.allSettled(
    events.map(async (event) => {
      switch (event.type) {
        case "goal.submitted":
          await Promise.allSettled([
            createNotification({
              userId: event.managerId,
              type: "GOAL_SUBMITTED_FOR_APPROVAL",
              title: `${event.employeeName} submitted goals for review`,
              message: `${event.goalCount} goal(s) submitted — total weightage 100%`,
              link: "/dashboard/manager/approvals",
            }),
            sendGoalSubmittedEmail(
              { name: event.managerName, email: event.managerEmail },
              { name: event.employeeName, email: event.employeeEmail },
              event.goalCount
            ),
            sendTeamsCard({
              title: "Goals Submitted for Review",
              text: `${event.employeeName} submitted ${event.goalCount} goals for your review.`,
              actions: [
                {
                  type: "OpenUrl",
                  title: "Review Goals",
                  url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/manager/approvals`,
                },
              ],
            }),
          ]);
          break;

        case "goal.approved":
          await Promise.allSettled([
            createNotification({
              userId: event.ownerId,
              type: "GOAL_APPROVED",
              title: "Goal approved!",
              message: `"${event.goalTitle}" approved by your manager.`,
              link: `/dashboard/employee/goals/${event.goalId}`,
            }),
            sendGoalApprovedEmail(
              { name: event.ownerName, email: event.ownerEmail },
              event.goalTitle
            ),
          ]);
          break;

        case "goal.rejected":
          await Promise.allSettled([
            createNotification({
              userId: event.ownerId,
              type: "GOAL_REJECTED",
              title: "Goal rejected",
              message: `"${event.goalTitle}" — Reason: ${event.reason}`,
              link: `/dashboard/employee/goals/${event.goalId}`,
            }),
            sendGoalRejectedEmail(
              { name: event.ownerName, email: event.ownerEmail },
              event.goalTitle,
              event.reason
            ),
          ]);
          break;

        case "goal.returned":
          await createNotification({
            userId: event.ownerId,
            type: "GOAL_RETURNED",
            title: "Goal returned for rework",
            message: `"${event.goalTitle}" — ${event.reason}`,
            link: `/dashboard/employee/goals/${event.goalId}`,
          });
          break;

        case "goal.shared":
          await Promise.allSettled(
            event.recipientIds.map((recipientId) =>
              createNotification({
                userId: recipientId,
                type: "GOAL_SHARED_WITH_YOU",
                title: `Shared goal assigned: "${event.goalTitle}"`,
                message: `${event.senderName} assigned a departmental goal to you. Adjust your weightage to include it.`,
                link: "/dashboard/employee/goals",
              })
            )
          );
          break;
      }
      processed++;
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  return NextResponse.json({ processed, failed });
}
