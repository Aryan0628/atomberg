"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import {
  LayoutDashboard, Target, ClipboardCheck, Users, Calendar,
  BarChart3, Shield, FileText, PanelLeftClose, PanelLeftOpen,
  UserCheck, Share2, AlertTriangle, Settings, History, BookTemplate, GitBranch,
  MessageSquare, CalendarDays, BarChart2, Smile, Building2, ClipboardList,
} from "lucide-react";

const employeeLinks = [
  { href: "/dashboard/employee/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/employee/goals",     label: "My Goals",   icon: Target },
  { href: "/dashboard/employee/history",   label: "History",    icon: History },
  { href: "/dashboard/employee/feedback",  label: "Feedback",   icon: MessageSquare },
  { href: "/dashboard/employee/meetings",  label: "1:1 Meetings", icon: CalendarDays },
];

const managerLinks = [
  { href: "/dashboard/manager/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/dashboard/manager/approvals",    label: "Approvals",    icon: UserCheck },
  { href: "/dashboard/manager/team",         label: "Team",         icon: Users },
  { href: "/dashboard/manager/checkins",     label: "Check-ins",    icon: ClipboardCheck },
  { href: "/dashboard/manager/shared-goals", label: "Shared Goals", icon: Share2 },
  { href: "/dashboard/manager/goal-status",  label: "Goal Status",  icon: BarChart2 },
  { href: "/dashboard/manager/meetings",     label: "1:1 Meetings", icon: CalendarDays },
  { href: "/dashboard/manager/escalations",  label: "Escalations",  icon: AlertTriangle },
];

const adminLinks = [
  { href: "/dashboard/admin/dashboard",      label: "Dashboard",    icon: LayoutDashboard },
  { href: "/dashboard/admin/users",          label: "Users",        icon: Users },
  { href: "/dashboard/admin/cycles",         label: "Cycles",       icon: Calendar },
  { href: "/dashboard/admin/analytics",      label: "Analytics",    icon: BarChart3 },
  { href: "/dashboard/admin/audit",          label: "Audit Trail",  icon: Shield },
  { href: "/dashboard/admin/escalations",    label: "Escalations",  icon: AlertTriangle },
  { href: "/dashboard/admin/reports",        label: "Reports",      icon: FileText },
  { href: "/dashboard/admin/templates",      label: "Templates",    icon: BookTemplate },
  { href: "/dashboard/admin/company-goals",  label: "Company Goals", icon: Building2 },
  { href: "/dashboard/admin/review-cycles",  label: "Reviews",      icon: ClipboardList },
  { href: "/dashboard/admin/enps",           label: "eNPS",         icon: Smile },
  { href: "/dashboard/admin/org-chart",      label: "Org Chart",    icon: Settings },
  { href: "/dashboard/admin/architecture",   label: "Architecture", icon: GitBranch },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  HR: "HR",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

export function Sidebar() {
  const pathname    = usePathname();
  const { data: session } = useSession();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const role = session?.user?.role as string | undefined;

  const links =
    role === "ADMIN" || role === "HR" ? adminLinks :
    role === "MANAGER"                 ? managerLinks :
                                         employeeLinks;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col",
        "bg-sidebar border-r border-sidebar-border",
        "transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-[60px]" : "w-60"
      )}
    >
      {/* Brand */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-sm tracking-tight">A</span>
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sidebar-foreground font-semibold text-sm tracking-tight leading-none">Atomberg</p>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={sidebarCollapsed ? link.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                sidebarCollapsed && "justify-center px-2"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              />
              {!sidebarCollapsed && <span className="truncate">{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Role pill + collapse */}
      <div className="p-3 border-t border-sidebar-border space-y-2 shrink-0">
        {!sidebarCollapsed && role && (
          <div className="px-3 py-2 rounded-md bg-sidebar-accent">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Signed in as</p>
            <p className="text-sm text-foreground font-medium mt-1 truncate">{session?.user?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABEL[role] ?? role}</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          {sidebarCollapsed
            ? <PanelLeftOpen  className="w-4 h-4" />
            : <PanelLeftClose className="w-4 h-4" />}
          {!sidebarCollapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
