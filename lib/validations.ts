// lib/validations.ts
// All Zod schemas — shared between frontend (React Hook Form) and API routes.
// Single source of truth for validation. No duplication.

import { z } from "zod";

// ─── Goal Creation ───────────────────────────────────────────

export const GoalCreateSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200),
    description: z.string().max(1000).optional(),
    thrustArea: z.string().min(1, "Thrust area is required"),
    uomType: z.enum([
      "NUMERIC_MIN",
      "NUMERIC_MAX",
      "TIMELINE",
      "ZERO",
      "PERCENTAGE",
    ]),
    uomUnit: z.string().optional(),
    target: z.number().positive("Target must be positive").optional(),
    targetDate: z.coerce.date().optional(),
    weightage: z
      .number()
      .min(10, "Minimum 10%")
      .max(100, "Maximum 100%"),
  })
  .refine(
    (d) => {
      if (
        ["NUMERIC_MIN", "NUMERIC_MAX", "PERCENTAGE"].includes(d.uomType) &&
        !d.target
      )
        return false;
      if (d.uomType === "TIMELINE" && !d.targetDate) return false;
      return true;
    },
    { message: "Target or Target Date required for selected UoM type" }
  );

export type GoalCreateInput = z.infer<typeof GoalCreateSchema>;

// ─── Goal Update ─────────────────────────────────────────────

export const GoalUpdateSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(1000).optional(),
    thrustArea: z.string().min(1).optional(),
    uomType: z
      .enum(["NUMERIC_MIN", "NUMERIC_MAX", "TIMELINE", "ZERO", "PERCENTAGE"])
      .optional(),
    uomUnit: z.string().optional(),
    target: z.number().positive().optional(),
    targetDate: z.coerce.date().optional(),
    weightage: z.number().min(10).max(100).optional(),
  });

export type GoalUpdateInput = z.infer<typeof GoalUpdateSchema>;

// ─── Check-in ────────────────────────────────────────────────

export const CheckinSchema = z.object({
  goalId: z.string().cuid(),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  actualValue: z.number().optional(),
  actualDate: z.coerce.date().optional(),
  progressStatus: z.enum([
    "NOT_STARTED",
    "ON_TRACK",
    "AT_RISK",
    "COMPLETED",
    "OVERDUE",
  ]),
  employeeNote: z.string().max(500).optional(),
  selfRating: z.number().min(1).max(5).optional(),
  whatWentWell: z.string().max(500).optional(),
  blockers: z.string().max(500).optional(),
});

export type CheckinInput = z.infer<typeof CheckinSchema>;

// ─── Manager Approval ────────────────────────────────────────

export const ManagerApprovalSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT", "RETURN"]),
    targetOverride: z.number().positive().optional(),
    weightageOverride: z.number().min(10).max(100).optional(),
    rejectReason: z.string().min(10, "Reason must be at least 10 characters").optional(),
    returnReason: z.string().min(10, "Reason must be at least 10 characters").optional(),
  })
  .refine((d) => !(d.action === "REJECT" && !d.rejectReason), {
    message: "Reject reason required",
    path: ["rejectReason"],
  })
  .refine((d) => !(d.action === "RETURN" && !d.returnReason), {
    message: "Return reason required",
    path: ["returnReason"],
  });

export type ManagerApprovalInput = z.infer<typeof ManagerApprovalSchema>;

// ─── Manager Check-in Review ─────────────────────────────────

export const ManagerCheckinReviewSchema = z.object({
  managerComment: z.string().min(5, "Comment must be at least 5 characters").max(500),
  managerRating: z.number().min(1).max(5),
});

export type ManagerCheckinReviewInput = z.infer<typeof ManagerCheckinReviewSchema>;

// ─── User Creation ───────────────────────────────────────────

export const UserCreateSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN", "HR"]),
  department: z.string().optional(),
  designation: z.string().optional(),
  employeeCode: z.string().optional(),
  managerId: z.string().optional(),
  skipManagerId: z.string().optional(),
});

export type UserCreateInput = z.infer<typeof UserCreateSchema>;

// ─── User Update ─────────────────────────────────────────────

export const UserUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN", "HR"]).optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  managerId: z.string().nullable().optional(),
  skipManagerId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;

// ─── Cycle Creation ──────────────────────────────────────────

export const CycleCreateSchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    fiscalYear: z.string().min(4),
    goalSettingOpen: z.coerce.date(),
    goalSettingClose: z.coerce.date(),
    q1Open: z.coerce.date(),
    q1Close: z.coerce.date(),
    q2Open: z.coerce.date(),
    q2Close: z.coerce.date(),
    q3Open: z.coerce.date(),
    q3Close: z.coerce.date(),
    q4Open: z.coerce.date(),
    q4Close: z.coerce.date(),
  })
  .refine((d) => d.goalSettingClose > d.goalSettingOpen, {
    message: "Goal setting window must close after it opens",
    path: ["goalSettingClose"],
  })
  .refine((d) => d.q1Close > d.q1Open, { message: "Q1 must close after it opens", path: ["q1Close"] })
  .refine((d) => d.q2Close > d.q2Open, { message: "Q2 must close after it opens", path: ["q2Close"] })
  .refine((d) => d.q3Close > d.q3Open, { message: "Q3 must close after it opens", path: ["q3Close"] })
  .refine((d) => d.q4Close > d.q4Open, { message: "Q4 must close after it opens", path: ["q4Close"] })
  .refine((d) => d.q1Open >= d.goalSettingClose, {
    message: "Q1 window must start on or after the goal-setting window closes",
    path: ["q1Open"],
  });

export type CycleCreateInput = z.infer<typeof CycleCreateSchema>;

// ─── Goal Comment ────────────────────────────────────────────

export const GoalCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(1000),
  isInternal: z.boolean().default(false),
});

export type GoalCommentInput = z.infer<typeof GoalCommentSchema>;

// ─── Goal Template ───────────────────────────────────────────

export const GoalTemplateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  thrustArea: z.string().min(1),
  uomType: z.enum(["NUMERIC_MIN", "NUMERIC_MAX", "TIMELINE", "ZERO", "PERCENTAGE"]),
  uomUnit: z.string().optional(),
  suggestedTarget: z.number().positive().optional(),
  suggestedWeightage: z.number().min(10).max(100).default(20),
});

export type GoalTemplateInput = z.infer<typeof GoalTemplateSchema>;

// ─── Escalation Rule ─────────────────────────────────────────

export const EscalationRuleSchema = z.object({
  trigger: z.enum([
    "GOAL_NOT_SUBMITTED",
    "GOAL_NOT_APPROVED",
    "CHECKIN_NOT_COMPLETED",
  ]),
  daysAfterTrigger: z.number().min(1).max(90),
  escalateTo: z.enum(["EMPLOYEE", "MANAGER", "SKIP_LEVEL", "HR"]),
});

export type EscalationRuleInput = z.infer<typeof EscalationRuleSchema>;

// ─── Login ───────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
