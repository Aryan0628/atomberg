// types/index.ts
// All shared TypeScript interfaces & enums for the AtomQuest Portal

import type {
  User,
  Goal,
  Cycle,
  Checkin,
  AuditLog,
  Notification,
  EscalationRule,
  EscalationLog,
  GoalTemplate,
  GoalComment,
  ThrustArea,
  Role,
  UoMType,
  Quarter,
} from "@/lib/generated/prisma/client";

// Re-export Prisma types for convenience
export type {
  User,
  Goal,
  Cycle,
  Checkin,
  AuditLog,
  Notification,
  EscalationRule,
  EscalationLog,
  GoalTemplate,
  GoalComment,
  ThrustArea,
};

export {
  Role,
  GoalStatus,
  ProgressStatus,
  UoMType,
  Quarter,
  AuditAction,
  NotificationType,
  EscalationTrigger,
  EscalateeTo,
} from "@/lib/generated/prisma/client";

// ─── Extended Session Types ──────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  managerId?: string | null;
  department?: string | null;
  avatarUrl?: string | null;
}

// ─── Goal with relations ─────────────────────────────────────

export interface GoalWithRelations extends Goal {
  owner: User;
  approver?: User | null;
  cycle: Cycle;
  checkins: Checkin[];
  comments: GoalComment[];
  sharedWith: User[];
}

export interface GoalWithOwner extends Goal {
  owner: Pick<User, "id" | "name" | "email" | "department" | "avatarUrl">;
}

// ─── Check-in with relations ─────────────────────────────────

export interface CheckinWithRelations extends Checkin {
  goal: Goal;
  employee: User;
}

// ─── User with relations ─────────────────────────────────────

export interface UserWithRelations extends User {
  manager?: User | null;
  reports: User[];
  ownedGoals: Goal[];
}

// ─── Audit Log with relations ────────────────────────────────

export interface AuditLogWithRelations extends AuditLog {
  user: Pick<User, "id" | "name" | "email">;
  goal?: Pick<Goal, "id" | "title"> | null;
}

// ─── Analytics Types ─────────────────────────────────────────

export interface OrgOverviewStats {
  totalEmployees: number;
  totalGoals: number;
  goalsSubmitted: number;
  goalsApproved: number;
  goalsLocked: number;
  avgScore: number;
  checkinCompletionRate: number;
}

export interface QoQDataPoint {
  quarter: Quarter;
  department: string;
  avgScore: number;
  goalCount: number;
}

export interface HeatmapCell {
  employeeId: string;
  employeeName: string;
  department: string;
  quarter: Quarter;
  score: number;
}

export interface GoalDistribution {
  thrustArea: string;
  uomType: UoMType;
  count: number;
}

export interface ManagerEffectiveness {
  managerId: string;
  managerName: string;
  totalReports: number;
  checkinCompletionRate: number;
  avgApprovalTime: number;
}

// ─── Action Items ────────────────────────────────────────────

export interface ActionItem {
  severity: "high" | "medium" | "low";
  message: string;
  link: string;
  icon?: string;
}

// ─── Wellness Score ──────────────────────────────────────────

export interface WellnessResult {
  score: number;
  grade: "A" | "B" | "C" | "D";
  issues: string[];
}

// ─── Weightage Suggestion ────────────────────────────────────

export interface WeightageSuggestion {
  id: string;
  currentWeightage: number;
  suggestedWeightage: number;
}

// ─── API Response Types ──────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── NextAuth Type Augmentation ──────────────────────────────

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }

  interface User {
    role: Role;
    managerId?: string | null;
    department?: string | null;
    avatarUrl?: string | null;
  }
}

// JWT augmentation is handled in lib/auth.ts callbacks directly.
// The next-auth/jwt module path varies by version — extending session is sufficient.
