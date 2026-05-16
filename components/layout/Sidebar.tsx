// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import {
  LayoutDashboard, Target, ClipboardCheck, Users, Calendar,
  BarChart3, Shield, FileText, ChevronLeft, ChevronRight,
  UserCheck, Share2, AlertTriangle, Settings, History, BookTemplate
} from "lucide-react";

const employeeLinks = [
  { href: "/dashboard/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/employee/goals", label: "My Goals", icon: Target },
  { href: "/dashboard/employee/history", label: "History", icon: History },
];

const managerLinks = [
  { href: "/dashboard/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/manager/approvals", label: "Approvals", icon: UserCheck },
  { href: "/dashboard/manager/team", label: "Team", icon: Users },
  { href: "/dashboard/manager/checkins", label: "Check-ins", icon: ClipboardCheck },
  { href: "/dashboard/manager/shared-goals", label: "Shared Goals", icon: Share2 },
  { href: "/dashboard/manager/escalations", label: "Escalations", icon: AlertTriangle },
];

const adminLinks = [
  { href: "/dashboard/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/admin/users", label: "Users", icon: Users },
  { href: "/dashboard/admin/cycles", label: "Cycles", icon: Calendar },
  { href: "/dashboard/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/admin/audit", label: "Audit Trail", icon: Shield },
  { href: "/dashboard/admin/escalations", label: "Escalations", icon: AlertTriangle },
  { href: "/dashboard/admin/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/admin/templates", label: "Templates", icon: BookTemplate },
  { href: "/dashboard/admin/org-chart", label: "Org Chart", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const role = session?.user?.role;

  const links = role === "ADMIN" || role === "HR"
    ? adminLinks
    : role === "MANAGER"
    ? managerLinks
    : employeeLinks;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 transition-all duration-300 flex flex-col",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">AQ</span>
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-slate-900 dark:text-white text-lg tracking-tight">
              AtomQuest
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white",
                sidebarCollapsed && "justify-center px-2"
              )}
              title={sidebarCollapsed ? link.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-900 dark:hover:text-slate-300 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
