"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Target, ClipboardCheck, Users, Calendar,
  BarChart3, Shield, FileText, UserCheck, Share2, AlertTriangle,
  History, BookTemplate, Settings,
} from "lucide-react";

const employeeLinks = [
  { href: "/dashboard/employee/dashboard", label: "My Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/employee/goals",     label: "My Goals",      icon: Target },
  { href: "/dashboard/employee/history",   label: "Goal History",  icon: History },
];

const managerLinks = [
  { href: "/dashboard/manager/dashboard",    label: "Team Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/manager/approvals",    label: "Approvals Queue", icon: UserCheck },
  { href: "/dashboard/manager/team",         label: "Team Progress",   icon: Users },
  { href: "/dashboard/manager/checkins",     label: "Check-in Hub",    icon: ClipboardCheck },
  { href: "/dashboard/manager/shared-goals", label: "Shared Goals",    icon: Share2 },
  { href: "/dashboard/manager/escalations",  label: "Escalations",     icon: AlertTriangle },
];

const adminLinks = [
  { href: "/dashboard/admin/dashboard",   label: "Admin Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/admin/users",       label: "User Management", icon: Users },
  { href: "/dashboard/admin/cycles",      label: "Cycle Manager",   icon: Calendar },
  { href: "/dashboard/admin/analytics",   label: "Analytics",       icon: BarChart3 },
  { href: "/dashboard/admin/audit",       label: "Audit Trail",     icon: Shield },
  { href: "/dashboard/admin/escalations", label: "Escalations",     icon: AlertTriangle },
  { href: "/dashboard/admin/reports",     label: "Report Center",   icon: FileText },
  { href: "/dashboard/admin/templates",   label: "Goal Templates",  icon: BookTemplate },
  { href: "/dashboard/admin/org-chart",   label: "Org Chart",       icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const links =
    role === "ADMIN" || role === "HR" ? adminLinks
    : role === "MANAGER" ? managerLinks
    : employeeLinks;

  const handleOpen = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleOpen();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleOpen]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages or actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {links.map((link) => (
            <CommandItem
              key={link.href}
              value={link.label}
              onSelect={() => navigate(link.href)}
              className="gap-2 cursor-pointer"
            >
              <link.icon className="w-4 h-4 text-muted-foreground" />
              {link.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {(role === "ADMIN" || role === "HR") && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              <CommandItem value="export goals excel" onSelect={() => { setOpen(false); window.location.href = "/api/export/excel"; }} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Export Goals (Excel)
              </CommandItem>
              <CommandItem value="export goals csv" onSelect={() => { setOpen(false); window.location.href = "/api/export/csv"; }} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Export Goals (CSV)
              </CommandItem>
              <CommandItem value="verify audit chain integrity" onSelect={() => navigate("/dashboard/admin/audit")} className="gap-2 cursor-pointer">
                <Shield className="w-4 h-4 text-muted-foreground" />
                Verify Audit Chain Integrity
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
