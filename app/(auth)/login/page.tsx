// Login page with demo credential hints
"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Controlled via NEXT_PUBLIC_DEMO_MODE env var — set to "true" on Vercel for judges.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const demoCredentials = [
  { role: "Admin",    email: "admin@atomberg.com",        password: "Admin@123" },
  { role: "HR",       email: "hr@atomberg.com",            password: "Hr@123" },
  { role: "Manager",  email: "vikram.singh@atomberg.com",  password: "Manager@123" },
  { role: "Employee", email: "rahul.sharma@atomberg.com",  password: "Employee@123" },
];

function getRoleDashboard(role?: string) {
  switch (role) {
    case "ADMIN":
    case "HR":
      return "/dashboard/admin/dashboard";
    case "MANAGER":
      return "/dashboard/manager/dashboard";
    default:
      return "/dashboard/employee/dashboard";
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const dest = getRoleDashboard(session.user.role);
      router.replace(dest);
    }
  }, [status, session, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        toast.error("Login failed");
      } else {
        toast.success("Welcome to Atomberg");
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (cred: typeof demoCredentials[0]) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: cred.email,
        password: cred.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid credentials");
        toast.error("Login failed");
      } else {
        toast.success(`Welcome! Logged in as ${cred.role}`);
        const dest = getRoleDashboard(
          cred.role === "Admin" ? "ADMIN" :
          cred.role === "HR" ? "HR" :
          cred.role === "Manager" ? "MANAGER" : "EMPLOYEE"
        );
        router.push(dest);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state if already authenticated
  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px] space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center rounded-lg mx-auto mb-6">
            <span className="font-bold text-lg">A</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sign in to Atomberg
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your details to access your dashboard
          </p>
        </div>

        {/* Login Form */}
        <div className="border border-border rounded-xl bg-card p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@atomberg.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-medium"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>

            {/* Azure AD SSO placeholder */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-10 font-medium cursor-not-allowed text-muted-foreground"
              disabled
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 21 21"><path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/></svg>
              Sign in with Microsoft
            </Button>
          </form>
        </div>

        {/* Demo Credentials — only visible when NEXT_PUBLIC_DEMO_MODE=true */}
        {IS_DEMO && (
          <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
            <p className="text-xs font-medium text-foreground mb-3 text-center">
              Quick Login (Demo)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoCredentials.map((cred) => (
                <button
                  key={cred.email}
                  onClick={() => handleQuickLogin(cred)}
                  disabled={loading}
                  className="flex flex-col items-start p-2.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 text-left"
                >
                  <span className="text-sm font-medium text-foreground">
                    {cred.role}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate w-full">
                    {cred.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
