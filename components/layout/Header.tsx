"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useAppStore } from "@/store/useAppStore";
import { useNotifications, useMarkAllRead } from "@/hooks/useNotifications";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, Sun, Moon, LogOut, ChevronDown, Shuffle, Circle } from "lucide-react";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Map path segments to human readable page titles
const PAGE_TITLES: Record<string, string> = {
  dashboard:    "Overview",
  goals:        "Goals",
  history:      "History",
  approvals:    "Approvals",
  team:         "Team Progress",
  checkins:     "Check-ins",
  "shared-goals": "Shared Goals",
  escalations:  "Escalations",
  users:        "User Management",
  cycles:       "Cycles",
  analytics:    "Analytics",
  audit:        "Audit Trail",
  reports:      "Reports",
  templates:    "Goal Templates",
  "org-chart":  "Org Chart",
};

function usePageTitle() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  // Last meaningful segment (skip UUIDs)
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (PAGE_TITLES[s]) return PAGE_TITLES[s];
  }
  return "Dashboard";
}

export function Header() {
  const { data: session }    = useSession();
  const { theme, setTheme }  = useTheme();
  const { sidebarCollapsed } = useAppStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pageTitle = usePageTitle();
  const { data: notifData } = useNotifications();
  const markAllRead = useMarkAllRead();

  const notifications = notifData?.notifications || [];
  const unreadCount   = notifData?.unreadCount   || 0;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 flex items-center justify-between px-6",
        "bg-white/90 dark:bg-[#0d1117]/90 backdrop-blur-md",
        "border-b border-slate-200/80 dark:border-white/[0.06]",
        "transition-all duration-300",
        sidebarCollapsed ? "ml-[60px]" : "ml-60"
      )}
    >
      {/* Page title */}
      <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight">
        {pageTitle}
      </h1>

      <div className="flex items-center gap-1.5">
        {/* Demo Role Switcher */}
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-medium border border-slate-200 dark:border-white/10 bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors text-slate-500 dark:text-slate-400">
              <Shuffle className="w-3 h-3" />
              {session?.user?.role}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <p className="px-2 py-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Switch Demo Role</p>
              <DropdownMenuSeparator />
              {[
                { label: "Admin",              email: "admin@atomberg.com",       password: "Admin@123" },
                { label: "HR",                 email: "hr@atomberg.com",           password: "Hr@123" },
                { label: "Manager — Vikram",   email: "vikram.singh@atomberg.com", password: "Manager@123" },
                { label: "Employee — Rahul",   email: "rahul.sharma@atomberg.com", password: "Employee@123" },
                { label: "Employee — Priya",   email: "priya.mehta@atomberg.com",  password: "Employee@123" },
              ].map((u) => (
                <DropdownMenuItem
                  key={u.email}
                  className="gap-2 cursor-pointer text-sm"
                  onClick={async () => {
                    await signIn("credentials", { email: u.email, password: u.password, redirect: false });
                    window.location.href = "/dashboard";
                  }}
                >
                  {u.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/[0.06] transition-colors"
        >
          {mounted && theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/[0.06] transition-colors">
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#0d1117]" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2.5 border-b dark:border-white/[0.06]">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No notifications</div>
            ) : (
              notifications.slice(0, 10).map((n: Record<string, unknown>) => (
                <DropdownMenuItem key={n.id as string} className="px-3 py-3 cursor-pointer items-start gap-2.5">
                  <Circle
                    className={cn("w-1.5 h-1.5 mt-1.5 flex-shrink-0 fill-current",
                      n.read ? "text-transparent" : "text-indigo-500")}
                  />
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                      {n.title as string}
                    </p>
                    <p className="text-xs text-slate-500 leading-snug line-clamp-2">{n.message as string}</p>
                    <p className="text-[10px] text-slate-400">{formatRelativeTime(n.createdAt as string)}</p>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 ml-1 pl-2 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors">
            <Avatar className="w-6 h-6">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[10px] font-semibold">
                {session?.user?.name ? getInitials(session.user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 hidden sm:block">
              {session?.user?.name?.split(" ")[0]}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <div className="px-2 py-2 border-b dark:border-white/[0.06]">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{session?.user?.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-red-500 dark:text-red-400 cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
