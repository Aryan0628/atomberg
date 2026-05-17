// app/api/escalations/rules/route.ts
// GET — list escalation rules for active cycle
// POST — create escalation rule

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveCycle } from "@/lib/cycle";
import { EscalationRuleSchema } from "@/lib/validations";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeCycle = await getActiveCycle();
  if (!activeCycle) return NextResponse.json([]);

  const rules = await prisma.escalationRule.findMany({
    where: { cycleId: activeCycle.id },
    orderBy: [{ trigger: "asc" }, { daysAfterTrigger: "asc" }],
  });

  return NextResponse.json({ rules, cycleId: activeCycle.id, cycleName: activeCycle.name });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;
  const parsed = EscalationRuleSchema.safeParse(bodyResult.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const activeCycle = await getActiveCycle();
  if (!activeCycle) return NextResponse.json({ error: "No active cycle" }, { status: 400 });

  const rule = await prisma.escalationRule.create({
    data: { ...parsed.data, cycleId: activeCycle.id },
  });

  return NextResponse.json(rule, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Rule ID required" }, { status: 400 });

  await prisma.escalationRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
