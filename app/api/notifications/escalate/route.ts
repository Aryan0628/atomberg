// app/api/notifications/escalate/route.ts
// POST — manually trigger the escalation engine (admin/HR only)
// Called from Admin Escalations page "Run Engine Now" button

import { auth } from "@/lib/auth";
import { runEscalationEngine } from "@/lib/escalation";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await runEscalationEngine();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Escalation engine error:", err);
    return NextResponse.json({ error: "Engine failed" }, { status: 500 });
  }
}
