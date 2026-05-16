// Dashboard root — redirects by role
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardRoot() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.replace("/login");
      return;
    }

    const role = session.user.role;
    if (role === "ADMIN" || role === "HR") {
      router.replace("/dashboard/admin/dashboard");
    } else if (role === "MANAGER") {
      router.replace("/dashboard/manager/dashboard");
    } else {
      router.replace("/dashboard/employee/dashboard");
    }
  }, [session, status, router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
