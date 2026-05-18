"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useNotifications, useMarkAllRead } from "@/hooks/useNotifications";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Sun, Moon, LogOut, ChevronDown, Shuffle, Circle, Search, Command } from "lucide-react";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
  const [mounted, setMounted] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const router = useRouter();
  useEffect(() => { setMounted(true); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQ.trim();
    if (!q) return;
    const role = session?.user?.role;
    const base = role === "ADMIN" || role === "HR"
      ? "/dashboard/admin"
      : role === "MANAGER"
      ? "/dashboard/manager"
      : "/dashboard/employee";
    router.push(`${base}/goals?search=${encodeURIComponent(q)}`);
    setSearchQ("");
  }

  const pageTitle = usePageTitle();
  const { data: notifData } = useNotifications();
  const markAllRead = useMarkAllRead();

  const notifications = notifData?.notifications || [];
  const unreadCount   = notifData?.unreadCount   || 0;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 flex items-center justify-between px-6",
        "bg-background",
        "border-b border-border",
      )}
    >
      {/* Page title */}
      <h1 className="text-sm font-semibold text-foreground tracking-tight">
        {pageTitle}
      </h1>

      {/* Global search bar */}
      <form onSubmit={handleSearch} className="hidden md:flex items-center relative">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search goals…"
          className="h-8 w-48 pl-8 pr-8 rounded-lg border border-input bg-muted/40 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all focus:w-64"
        />
        <kbd className="absolute right-2 text-[10px] text-muted-foreground hidden md:flex items-center gap-0.5 pointer-events-none">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </form>

      <div className="flex items-center gap-2">
        {/* Demo Role Switcher */}
        {process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-border bg-transparent hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground">
              <Shuffle className="w-3.5 h-3.5" />
              {session?.user?.role}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <p className="px-2 py-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Switch Demo Role</p>
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
          aria-label={mounted && theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {mounted && theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Notifications" className="relative w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full ring-2 ring-background" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              notifications.slice(0, 10).map((n: Record<string, unknown>) => (
                <DropdownMenuItem key={n.id as string} className="px-3 py-3 cursor-pointer items-start gap-2.5">
                  <Circle
                    className={cn("w-1.5 h-1.5 mt-1.5 flex-shrink-0 fill-current",
                      n.read ? "text-transparent" : "text-primary")}
                  />
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {n.title as string}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{n.message as string}</p>
                    <p className="text-[10px] text-muted-foreground/70">{formatRelativeTime(n.createdAt as string)}</p>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 ml-1 pl-2 h-8 rounded-md hover:bg-accent transition-colors">
            <Avatar className="w-6 h-6">
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                {session?.user?.name ? getInitials(session.user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground hidden sm:block">
              {session?.user?.name?.split(" ")[0]}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium text-foreground">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
