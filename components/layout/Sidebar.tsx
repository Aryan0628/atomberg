"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import {
  LayoutDashboard, Target, ClipboardCheck, Users, Calendar,
  BarChart3, Shield, FileText, PanelLeftClose, PanelLeftOpen,
  UserCheck, Share2, AlertTriangle, Settings, History, BookTemplate,
} from "lucide-react";

const employeeLinks = [
  { href: "/dashboard/employee/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/employee/goals",     label: "My Goals",   icon: Target },
  { href: "/dashboard/employee/history",   label: "History",    icon: History },
];

const managerLinks = [
  { href: "/dashboard/manager/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/dashboard/manager/approvals",    label: "Approvals",    icon: UserCheck },
  { href: "/dashboard/manager/team",         label: "Team",         icon: Users },
  { href: "/dashboard/manager/checkins",     label: "Check-ins",    icon: ClipboardCheck },
  { href: "/dashboard/manager/shared-goals", label: "Shared Goals", icon: Share2 },
  { href: "/dashboard/manager/escalations",  label: "Escalations",  icon: AlertTriangle },
];

const adminLinks = [
  { href: "/dashboard/admin/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/admin/users",      label: "Users",      icon: Users },
  { href: "/dashboard/admin/cycles",     label: "Cycles",     icon: Calendar },
  { href: "/dashboard/admin/analytics",  label: "Analytics",  icon: BarChart3 },
  { href: "/dashboard/admin/audit",      label: "Audit Trail", icon: Shield },
  { href: "/dashboard/admin/escalations",label: "Escalations", icon: AlertTriangle },
  { href: "/dashboard/admin/reports",    label: "Reports",    icon: FileText },
  { href: "/dashboard/admin/templates",  label: "Templates",  icon: BookTemplate },
  { href: "/dashboard/admin/org-chart",  label: "Org Chart",  icon: Settings },
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
        "bg-[#0d1117] border-r border-white/[0.06]",
        "transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-[60px]" : "w-60"
      )}
    >
      {/* Brand */}
      <div className="h-14 flex items-center px-4 border-b border-white/[0.06] shrink-0">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-md bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs tracking-tight">A</span>
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm tracking-tight leading-none">Atomberg</p>
              <p className="text-slate-500 text-[10px] mt-0.5 leading-none">Performance Portal</p>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={sidebarCollapsed ? link.label : undefined}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150",
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
                sidebarCollapsed && "justify-center px-2"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  active ? "text-indigo-400" : "text-slate-500"
                )}
              />
              {!sidebarCollapsed && <span className="truncate">{link.label}</span>}
              {!sidebarCollapsed && active && (
                <span className="ml-auto w-1 h-1 rounded-full bg-indigo-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Role pill + collapse */}
      <div className="p-2 border-t border-white/[0.06] space-y-1 shrink-0">
        {!sidebarCollapsed && role && (
          <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.04]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Signed in as</p>
            <p className="text-xs text-slate-300 font-medium mt-0.5 truncate">{session?.user?.name}</p>
            <p className="text-[10px] text-indigo-400 mt-0.5">{ROLE_LABEL[role] ?? role}</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-colors"
        >
          {sidebarCollapsed
            ? <PanelLeftOpen  className="w-4 h-4" />
            : <PanelLeftClose className="w-4 h-4" />}
          {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
