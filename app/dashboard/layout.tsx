// Dashboard layout with sidebar + header + main content area
"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080c10]">
      <Sidebar />
      <div className={cn("transition-all duration-300 ease-in-out", sidebarCollapsed ? "ml-[60px]" : "ml-60")}>
        <Header />
        <main className="p-5 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
