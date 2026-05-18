// lib/escalation.ts
// Escalation engine — runs daily via Vercel cron. Deduplicates via Redis.

import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { sendEscalationEmail } from "@/lib/notifications";
import { redisGet, redisSetex } from "@/lib/redis";

interface EscalationUser {
  id: string;
  name: string;
  email: string;
  managerId: string | null;
  skipManagerId: string | null;
}

// Returns the actual recipient to email based on rule.escalateTo
async function resolveRecipient(
  subject: EscalationUser,
  escalateTo: string
): Promise<{ name: string; email: string } | null> {
  switch (escalateTo) {
    case "EMPLOYEE":
      return { name: subject.name, email: subject.email };
    case "MANAGER":
      if (!subject.managerId) return null;
      return prisma.user.findUnique({
        where: { id: subject.managerId },
        select: { name: true, email: true },
      });
    case "SKIP_LEVEL":
      if (!subject.skipManagerId) return null;
      return prisma.user.findUnique({
        where: { id: subject.skipManagerId },
        select: { name: true, email: true },
      });
    case "HR":
      return prisma.user.findFirst({
        where: { role: "HR", isActive: true },
        select: { name: true, email: true },
      });
    default:
      return null;
  }
}

export async function runEscalationEngine() {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return { processed: 0 };

  const now = new Date();
  const rules = await prisma.escalationRule.findMany({
    where: { cycleId: cycle.id, isActive: true },
  });
  let processed = 0;

  for (const rule of rules) {
    if (rule.trigger === "GOAL_NOT_SUBMITTED") {
      const daysSince = Math.floor(
        (now.getTime() - cycle.goalSettingOpen.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince < rule.daysAfterTrigger) continue;

      const employees = await prisma.user.findMany({
        where: { role: "EMPLOYEE", isActive: true },
      });

      for (const emp of employees) {
        const submitted = await prisma.goal.count({
          where: {
            ownerId: emp.id,
            cycleId: cycle.id,
            status: { in: ["SUBMITTED", "APPROVED", "LOCKED"] },
          },
        });

        if (submitted === 0) {
          const key = `esc:${emp.id}:${rule.trigger}:${cycle.id}:${rule.escalateTo}`;
          // Redis is optional — if it's down, fail open (send the escalation rather than skip it)
          let already = false;
          try { already = !!(await redisGet(key)); } catch { /* Redis unavailable — proceed */ }
          if (!already) {
            const recipient = await resolveRecipient(emp, rule.escalateTo);
            if (recipient) {
              await sendEscalationEmail(recipient, rule.trigger, rule.escalateTo, cycle.name);
            }
            await prisma.$transaction([
              prisma.escalationLog.create({
                data: {
                  userId: emp.id,
                  trigger: rule.trigger,
                  escalatedTo: rule.escalateTo,
                  emailSent: !!recipient,
                },
              }),
            ]);
            await writeAudit({
              userId: emp.id,
              action: "ESCALATION_SENT",
              entityType: "User",
              entityId: emp.id,
              newValue: { trigger: rule.trigger, escalateTo: rule.escalateTo },
            });
            try { await redisSetex(key, 86400, "1"); } catch { /* Redis unavailable — dedup will miss, acceptable */ }
            processed++;
          }
        }
      }
    }

    if (rule.trigger === "GOAL_NOT_APPROVED") {
      // Escalate based on how long the goal has been in SUBMITTED state, not cycle start date
      const cutoffDate = new Date(now.getTime() - rule.daysAfterTrigger * 24 * 60 * 60 * 1000);
      const pendingGoals = await prisma.goal.findMany({
        where: {
          cycleId: cycle.id,
          status: "SUBMITTED",
          submittedAt: { lte: cutoffDate }, // submitted more than N days ago
        },
        include: { owner: true },
      });

      // For GOAL_NOT_APPROVED, the "subject" is the manager who hasn't approved.
      // Batch all manager lookups to avoid N+1 queries.
      const managerIds = [...new Set(pendingGoals.map((g) => g.owner.managerId).filter(Boolean))] as string[];
      const managersRaw = await prisma.user.findMany({
        where: { id: { in: managerIds } },
        select: { id: true, name: true, email: true, managerId: true, skipManagerId: true },
      });
      const managerMap = Object.fromEntries(managersRaw.map((m) => [m.id, m]));
      for (const mId of managerIds) {
        const key = `esc:${mId}:${rule.trigger}:${cycle.id}:${rule.escalateTo}`;
        let already = false;
        try { already = !!(await redisGet(key)); } catch { /* Redis unavailable — proceed */ }
        if (!already) {
          const manager = managerMap[mId];
          if (manager) {
            const recipient = await resolveRecipient(manager, rule.escalateTo);
            if (recipient) {
              await sendEscalationEmail(recipient, rule.trigger, rule.escalateTo, cycle.name);
            }
            await prisma.escalationLog.create({
              data: {
                userId: mId,
                trigger: rule.trigger,
                escalatedTo: rule.escalateTo,
                emailSent: !!recipient,
              },
            });
            try { await redisSetex(key, 86400, "1"); } catch { /* Redis unavailable */ }
            processed++;
          }
        }
      }
    }

    if (rule.trigger === "CHECKIN_NOT_COMPLETED") {
      const currentQuarter = getCurrentQuarter(cycle, now);
      if (!currentQuarter) continue;

      const employees = await prisma.user.findMany({
        where: { role: "EMPLOYEE", isActive: true },
        include: {
          ownedGoals: {
            where: { cycleId: cycle.id, status: "LOCKED" },
          },
        },
      });

      for (const emp of employees) {
        if (emp.ownedGoals.length === 0) continue;
        const checkins = await prisma.checkin.count({
          where: { employeeId: emp.id, cycleId: cycle.id, quarter: currentQuarter },
        });
        if (checkins < emp.ownedGoals.length) {
          const key = `esc:${emp.id}:${rule.trigger}:${cycle.id}:${currentQuarter}`;
          let already = false;
          try { already = !!(await redisGet(key)); } catch { /* Redis unavailable — proceed */ }
          if (!already) {
            const recipient = await resolveRecipient(emp, rule.escalateTo);
            if (recipient) {
              await sendEscalationEmail(recipient, rule.trigger, rule.escalateTo, cycle.name);
            }
            await prisma.escalationLog.create({
              data: {
                userId: emp.id,
                trigger: rule.trigger,
                escalatedTo: rule.escalateTo,
                emailSent: !!recipient,
              },
            });
            try { await redisSetex(key, 86400, "1"); } catch { /* Redis unavailable */ }
            processed++;
          }
        }
      }
    }
  }

  return { processed };
}

function getCurrentQuarter(
  cycle: { q1Open: Date; q1Close: Date; q2Open: Date; q2Close: Date; q3Open: Date; q3Close: Date; q4Open: Date; q4Close: Date },
  now: Date
): "Q1" | "Q2" | "Q3" | "Q4" | null {
  if (now >= cycle.q1Open && now <= cycle.q1Close) return "Q1";
  if (now >= cycle.q2Open && now <= cycle.q2Close) return "Q2";
  if (now >= cycle.q3Open && now <= cycle.q3Close) return "Q3";
  if (now >= cycle.q4Open && now <= cycle.q4Close) return "Q4";
  return null;
}
