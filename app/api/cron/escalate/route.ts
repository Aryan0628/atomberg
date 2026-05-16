// app/api/cron/escalate/route.ts
// Daily escalation engine cron job

import { runEscalationEngine } from "@/lib/escalation";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runEscalationEngine();
  return NextResponse.json({ success: true, ...result });
}
