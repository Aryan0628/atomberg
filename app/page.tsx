// Root page — redirects to login (auth redirects handled by session)
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user) {
      const role = session.user.role;
      if (role === "ADMIN" || role === "HR") {
        router.replace("/dashboard/admin/dashboard");
      } else if (role === "MANAGER") {
        router.replace("/dashboard/manager/dashboard");
      } else {
        router.replace("/dashboard/employee/dashboard");
      }
    } else {
      router.replace("/login");
    }
  }, [status, session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
