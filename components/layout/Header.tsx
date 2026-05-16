// components/layout/Header.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useAppStore } from "@/store/useAppStore";
import { useNotifications, useMarkAllRead } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, Sun, Moon, LogOut, User, ChevronDown, Shuffle } from "lucide-react";
import { signIn } from "next-auth/react";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Header() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { sidebarCollapsed } = useAppStore();
  const { data: notifData } = useNotifications();
  const markAllRead = useMarkAllRead();

  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unreadCount || 0;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-6 transition-all",
        sidebarCollapsed ? "ml-16" : "ml-64"
      )}
    >
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {session?.user?.role === "ADMIN" ? "Admin Dashboard" :
           session?.user?.role === "MANAGER" ? "Manager Dashboard" :
           "Employee Dashboard"}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Demo Role Switcher — Base UI trigger styled directly, no asChild */}
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden md:inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium text-slate-700 dark:text-slate-300">
              <Shuffle className="w-3 h-3" />
              Demo: {session?.user?.role}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <p className="px-2 py-1.5 text-xs text-slate-400 font-medium">Switch Demo Role</p>
              <DropdownMenuSeparator />
              {[
                { label: "Admin", email: "admin@atomberg.com", password: "Admin@123" },
                { label: "HR", email: "hr@atomberg.com", password: "Hr@123" },
                { label: "Manager (Vikram)", email: "vikram.singh@atomberg.com", password: "Manager@123" },
                { label: "Employee (Rahul)", email: "rahul.sharma@atomberg.com", password: "Employee@123" },
                { label: "Employee (Priya)", email: "priya.mehta@atomberg.com", password: "Employee@123" },
              ].map((u) => (
                <DropdownMenuItem
                  key={u.email}
                  className="gap-2 cursor-pointer"
                  onClick={async () => {
                    await signIn("credentials", { email: u.email, password: u.password, redirect: false });
                    window.location.href = "/dashboard";
                  }}
                >
                  <span className="text-sm">{u.label}</span>
                  <span className="text-xs text-slate-400 ml-auto">{u.email}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notifications bell — trigger styled directly */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative inline-flex items-center justify-center w-9 h-9 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-red-500 text-white border-0">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                No notifications
              </div>
            ) : (
              notifications.slice(0, 10).map((n: Record<string, unknown>) => (
                <DropdownMenuItem key={n.id as string} className="p-3 cursor-pointer">
                  <div className="space-y-1">
                    <p className={cn("text-sm font-medium", !n.read && "text-blue-600 dark:text-blue-400")}>
                      {n.title as string}
                    </p>
                    <p className="text-xs text-slate-500">{n.message as string}</p>
                    <p className="text-[10px] text-slate-400">{formatRelativeTime(n.createdAt as string)}</p>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu — trigger styled directly, no nested button */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs font-medium">
                {session?.user?.name ? getInitials(session.user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {session?.user?.name}
              </p>
              <p className="text-[10px] text-slate-400">{session?.user?.role}</p>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2">
              <User className="w-4 h-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-red-600"
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
