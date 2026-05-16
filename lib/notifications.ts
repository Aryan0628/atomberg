// lib/notifications.ts
// In-app notification creation + email trigger helpers.
// COST: Resend — 100 emails/day free. Our escalation engine deduplicates via Redis
// to ensure no employee receives more than 1 escalation per 24 hours.

import { prisma } from "@/lib/db";
import { NotificationType } from "@/lib/generated/prisma/enums";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Creates an in-app notification stored in the database.
 * Notifications persist across sessions and show in the bell dropdown.
 */
export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    },
  });
}

/**
 * Marks all unread notifications as read for a given user.
 */
export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
}

/**
 * Gets unread notification count for the bell icon badge.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

/**
 * Gets recent notifications for the dropdown feed.
 */
export async function getRecentNotifications(userId: string, limit = 10) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ─── Email Helpers ───────────────────────────────────────────
// These wrap Resend API calls. If RESEND_API_KEY is not set, they log and return.
// This ensures the app works in demo mode without email configured.

interface EmailUser {
  name: string;
  email: string;
}

/**
 * Sends email notification when an employee submits goals for review.
 */
export async function sendGoalSubmittedEmail(
  manager: EmailUser,
  employee: EmailUser,
  goalCount: number
) {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[EMAIL SKIP] Goal submitted: ${employee.name} → ${manager.name} (${goalCount} goals)`
    );
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "AtomQuest <noreply@atomquest.app>",
      to: manager.email,
      subject: `${employee.name} submitted ${goalCount} goals for your review`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1D4ED8;">AtomQuest — Goals Submitted</h2>
          <p>Hi ${manager.name},</p>
          <p><strong>${employee.name}</strong> has submitted <strong>${goalCount} goal(s)</strong> for your review.</p>
          <p>Total weightage: 100% ✓</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/manager/approvals" 
             style="display: inline-block; padding: 12px 24px; background: #1D4ED8; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            Review Goals
          </a>
          <p style="color: #666; margin-top: 24px; font-size: 12px;">AtomQuest Portal — Atomberg Technologies</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[EMAIL ERROR] sendGoalSubmittedEmail:", err);
  }
}

/**
 * Sends email when a goal is approved.
 */
export async function sendGoalApprovedEmail(
  employee: EmailUser,
  goalTitle: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL SKIP] Goal approved: ${goalTitle} → ${employee.name}`);
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "AtomQuest <noreply@atomquest.app>",
      to: employee.email,
      subject: `Goal approved: "${goalTitle}"`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16A34A;">✓ Goal Approved</h2>
          <p>Hi ${employee.name},</p>
          <p>Your goal <strong>"${goalTitle}"</strong> has been approved by your manager.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/employee/goals" 
             style="display: inline-block; padding: 12px 24px; background: #16A34A; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            View Goals
          </a>
          <p style="color: #666; margin-top: 24px; font-size: 12px;">AtomQuest Portal — Atomberg Technologies</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[EMAIL ERROR] sendGoalApprovedEmail:", err);
  }
}

/**
 * Sends email when a goal is rejected.
 */
export async function sendGoalRejectedEmail(
  employee: EmailUser,
  goalTitle: string,
  reason: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL SKIP] Goal rejected: ${goalTitle} → ${employee.name}`);
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "AtomQuest <noreply@atomquest.app>",
      to: employee.email,
      subject: `Goal rejected: "${goalTitle}"`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #DC2626;">✕ Goal Rejected</h2>
          <p>Hi ${employee.name},</p>
          <p>Your goal <strong>"${goalTitle}"</strong> has been rejected.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/employee/goals" 
             style="display: inline-block; padding: 12px 24px; background: #DC2626; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            View Goals
          </a>
          <p style="color: #666; margin-top: 24px; font-size: 12px;">AtomQuest Portal — Atomberg Technologies</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[EMAIL ERROR] sendGoalRejectedEmail:", err);
  }
}

/**
 * Sends escalation email.
 */
export async function sendEscalationEmail(
  recipient: EmailUser,
  trigger: string,
  escalatedTo: string,
  cycleName: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[EMAIL SKIP] Escalation: ${trigger} → ${recipient.name} (${escalatedTo})`
    );
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "AtomQuest <noreply@atomquest.app>",
      to: recipient.email,
      subject: `Action Required: ${trigger.replace(/_/g, " ").toLowerCase()} — ${cycleName}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #F59E0B;">⚠ Escalation Notice</h2>
          <p>Hi ${recipient.name},</p>
          <p>This is an automated escalation for: <strong>${trigger.replace(/_/g, " ")}</strong></p>
          <p>Cycle: ${cycleName}</p>
          <p>Please take immediate action to avoid further escalation.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
             style="display: inline-block; padding: 12px 24px; background: #F59E0B; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            Go to Dashboard
          </a>
          <p style="color: #666; margin-top: 24px; font-size: 12px;">AtomQuest Portal — Atomberg Technologies</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[EMAIL ERROR] sendEscalationEmail:", err);
  }
}
