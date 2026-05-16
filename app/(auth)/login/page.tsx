// Login page with demo credential hints
"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useEffect } from "react";

const demoCredentials = [
  { role: "Admin", email: "admin@atomberg.com", password: "Admin@123", color: "bg-purple-500" },
  { role: "HR", email: "hr@atomberg.com", password: "Hr@123", color: "bg-pink-500" },
  { role: "Manager", email: "vikram.singh@atomberg.com", password: "Manager@123", color: "bg-blue-500" },
  { role: "Employee", email: "rahul.sharma@atomberg.com", password: "Employee@123", color: "bg-green-500" },
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
        toast.success("Welcome to AtomQuest!");
        // Force a full page reload to pick up session properly
        window.location.href = "/dashboard";
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
        // eslint-disable-next-line react-hooks/immutability
        window.location.href = dest;
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-blue-300 text-sm font-medium">AtomQuest Portal</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Welcome back
          </h1>
          <p className="text-slate-400">
            Sign in to your goal tracking dashboard
          </p>
        </div>

        {/* Login Form */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">Sign In</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your credentials to access the portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@atomberg.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-11"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>

              {/* Azure AD SSO placeholder */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-500">or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-700 bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 cursor-not-allowed opacity-60"
                disabled
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 21 21"><path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/></svg>
                Sign in with Microsoft
              </Button>
              <p className="text-xs text-slate-500 text-center">
                SSO available — configure Azure AD env vars to enable
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Demo Credentials — one-click login */}
        <Card className="border-slate-800 bg-slate-900/30 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Quick Login (Demo) — Click to sign in instantly
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {demoCredentials.map((cred) => (
              <button
                key={cred.email}
                onClick={() => handleQuickLogin(cred)}
                disabled={loading}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-all text-left group disabled:opacity-50"
              >
                <div className={`w-2 h-2 rounded-full ${cred.color}`} />
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                    {cred.role}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate max-w-[140px]">
                    {cred.email}
                  </p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-600">
          AtomQuest Hackathon 1.0 • Atomberg Technologies
        </p>
      </div>
    </div>
  );
}
