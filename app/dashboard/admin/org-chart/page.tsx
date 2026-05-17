// Admin Org Chart — interactive reporting hierarchy using SVG
"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ChevronRight } from "lucide-react";

interface OrgUser {
  id: string;
  name: string;
  role: string;
  department: string | null;
  designation: string | null;
  managerId: string | null;
  _count: { reports: number; ownedGoals: number };
}

function useOrgUsers() {
  return useQuery({
    queryKey: ["org-users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<OrgUser[]>;
    },
    staleTime: 60_000,
  });
}

interface TreeNode {
  user: OrgUser;
  children: TreeNode[];
  depth: number;
}

function buildTree(users: OrgUser[]): TreeNode[] {
  const map = new Map<string, OrgUser>(users.map((u) => [u.id, u]));
  const roots: TreeNode[] = [];

  function buildNode(user: OrgUser, depth: number): TreeNode {
    const children = users
      .filter((u) => u.managerId === user.id)
      .map((u) => buildNode(u, depth + 1));
    return { user, children, depth };
  }

  for (const user of users) {
    if (!user.managerId || !map.has(user.managerId)) {
      roots.push(buildNode(user, 0));
    }
  }

  return roots;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  HR: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  EMPLOYEE: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
};

function OrgNode({ node, isLast: _isLast }: { node: TreeNode; isLast: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;
  const colorClass = ROLE_COLORS[node.user.role] || ROLE_COLORS.EMPLOYEE;

  return (
    <div className="relative">
      <div className="flex items-start gap-3">
        {/* Tree connector */}
        {node.depth > 0 && (
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 border-l-2 border-b-2 border-slate-200 dark:border-slate-700 rounded-bl-lg flex-shrink-0" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* User card */}
          <div
            className={`inline-flex items-center gap-3 p-3 rounded-lg border ${colorClass} cursor-pointer hover:shadow-sm transition-shadow mb-2`}
            onClick={() => hasChildren && setCollapsed(!collapsed)}
          >
            <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {node.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{node.user.name}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] opacity-70">{node.user.role}</span>
                {node.user.department && <span className="text-[10px] opacity-60">• {node.user.department}</span>}
                {node.user._count.ownedGoals > 0 && (
                  <span className="text-[10px] opacity-60">• {node.user._count.ownedGoals} goals</span>
                )}
              </div>
            </div>
            {hasChildren && (
              <ChevronRight className={`w-4 h-4 opacity-50 transition-transform flex-shrink-0 ${collapsed ? "" : "rotate-90"}`} />
            )}
          </div>

          {/* Children */}
          {hasChildren && !collapsed && (
            <div className="ml-4 space-y-0 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
              {node.children.map((child, i) => (
                <OrgNode key={child.user.id} node={child} isLast={i === node.children.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminOrgChartPage() {
  const { data: users, isLoading } = useOrgUsers();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const tree = users ? buildTree(users) : [];

  const roleCounts = users?.reduce((acc: Record<string, number>, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organization Chart</h1>
          <p className="text-sm text-slate-500 mt-1">Reporting hierarchy — click a node to expand/collapse</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(roleCounts).map(([role, count]) => (
            <Badge key={role} className={ROLE_COLORS[role]} variant="outline">
              {role}: {count}
            </Badge>
          ))}
        </div>
      </div>

      {tree.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Users className="w-12 h-12 text-blue-400 mb-4" />
            <p className="text-lg font-medium">No users in the system yet</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> Org Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tree.map((node, i) => (
              <OrgNode key={node.user.id} node={node} isLast={i === tree.length - 1} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-xs">
        {Object.entries(ROLE_COLORS).map(([role, cls]) => (
          <div key={role} className={`px-2 py-1 rounded border ${cls}`}>{role}</div>
        ))}
      </div>
    </div>
  );
}
