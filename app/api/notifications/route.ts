// app/api/notifications/route.ts
import { auth } from "@/lib/auth";
import { getRecentNotifications, markAllRead, getUnreadCount } from "@/lib/notifications";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [notifications, unreadCount] = await Promise.all([
    getRecentNotifications(session.user.id, 20),
    getUnreadCount(session.user.id),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PUT() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await markAllRead(session.user.id);
  return NextResponse.json({ success: true });
}
