import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

// Parse the DATABASE_URL from prisma dev
let connectionString = process.env.DATABASE_URL || "";
if (connectionString.startsWith("prisma+postgres://")) {
  const url = new URL(connectionString);
  const apiKey = url.searchParams.get("api_key");
  if (apiKey) {
    try {
      const decoded = JSON.parse(Buffer.from(apiKey, "base64").toString());
      connectionString = decoded.databaseUrl || connectionString;
    } catch {
      const host = url.hostname || "localhost";
      const port = parseInt(url.port || "5432") + 1;
      connectionString = `postgres://postgres:postgres@${host}:${port}/template1?sslmode=disable`;
    }
  }
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...");

  // Clean existing data
  await prisma.goalComment.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.escalationLog.deleteMany();
  await prisma.escalationRule.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.cycle.deleteMany();
  await prisma.goalTemplate.deleteMany();
  await prisma.thrustArea.deleteMany();
  await prisma.user.deleteMany();

  // ─── THRUST AREAS ────────────────────────────────────────────
  console.log("  Creating thrust areas...");
  const thrustAreas = await Promise.all([
    prisma.thrustArea.create({ data: { name: "Sales Revenue", description: "Revenue generation and sales growth targets" } }),
    prisma.thrustArea.create({ data: { name: "Customer Experience", description: "Customer satisfaction, NPS, and service quality" } }),
    prisma.thrustArea.create({ data: { name: "Operational Excellence", description: "Process efficiency, uptime, and quality metrics" } }),
    prisma.thrustArea.create({ data: { name: "Safety & Compliance", description: "Workplace safety and regulatory compliance" } }),
    prisma.thrustArea.create({ data: { name: "People Development", description: "Training, mentoring, and team growth" } }),
    prisma.thrustArea.create({ data: { name: "Cost Efficiency", description: "Budget optimization and cost reduction" } }),
    prisma.thrustArea.create({ data: { name: "Innovation", description: "New product development and process innovation" } }),
    prisma.thrustArea.create({ data: { name: "Digital Transformation", description: "Automation, digitization, and tech adoption" } }),
  ]);

  // ─── USERS ───────────────────────────────────────────────────
  console.log("  Creating users...");
  const hashedPassword = await bcrypt.hash("Admin@123", 10);
  const hashedManagerPw = await bcrypt.hash("Manager@123", 10);
  const hashedEmpPw = await bcrypt.hash("Employee@123", 10);
  const hashedHrPw = await bcrypt.hash("Hr@123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@atomberg.com",
      name: "Admin User",
      password: hashedPassword,
      role: "ADMIN",
      department: "Management",
      designation: "System Administrator",
      employeeCode: "ATB001",
    },
  });

  const hr = await prisma.user.create({
    data: {
      email: "hr@atomberg.com",
      name: "HR User",
      password: hashedHrPw,
      role: "HR",
      department: "HR",
      designation: "HR Manager",
      employeeCode: "ATB002",
    },
  });

  const vikram = await prisma.user.create({
    data: {
      email: "vikram.singh@atomberg.com",
      name: "Vikram Singh",
      password: hashedManagerPw,
      role: "MANAGER",
      department: "Sales",
      designation: "Sales Manager",
      employeeCode: "ATB003",
      managerId: admin.id,
    },
  });

  const deepa = await prisma.user.create({
    data: {
      email: "deepa.nair@atomberg.com",
      name: "Deepa Nair",
      password: hashedManagerPw,
      role: "MANAGER",
      department: "Operations",
      designation: "Operations Manager",
      employeeCode: "ATB004",
      managerId: admin.id,
    },
  });

  const rahul = await prisma.user.create({
    data: {
      email: "rahul.sharma@atomberg.com",
      name: "Rahul Sharma",
      password: hashedEmpPw,
      role: "EMPLOYEE",
      department: "Sales",
      designation: "Senior Sales Executive",
      employeeCode: "ATB005",
      managerId: vikram.id,
      skipManagerId: admin.id,
    },
  });

  const priya = await prisma.user.create({
    data: {
      email: "priya.mehta@atomberg.com",
      name: "Priya Mehta",
      password: hashedEmpPw,
      role: "EMPLOYEE",
      department: "Sales",
      designation: "Sales Executive",
      employeeCode: "ATB006",
      managerId: vikram.id,
      skipManagerId: admin.id,
    },
  });

  const arjun = await prisma.user.create({
    data: {
      email: "arjun.patel@atomberg.com",
      name: "Arjun Patel",
      password: hashedEmpPw,
      role: "EMPLOYEE",
      department: "Operations",
      designation: "Operations Analyst",
      employeeCode: "ATB007",
      managerId: deepa.id,
    },
  });

  const sneha = await prisma.user.create({
    data: {
      email: "sneha.roy@atomberg.com",
      name: "Sneha Roy",
      password: hashedEmpPw,
      role: "EMPLOYEE",
      department: "Engineering",
      designation: "Software Engineer",
      employeeCode: "ATB008",
    },
  });

  // ─── ACTIVE CYCLE: FY 2026-27 ─────────────────────────────
  console.log("  Creating cycle...");
  const cycle = await prisma.cycle.create({
    data: {
      name: "FY 2026-27",
      fiscalYear: "2026-27",
      isActive: true,
      createdBy: admin.id,
      goalSettingOpen: new Date("2026-05-01T00:00:00Z"),
      goalSettingClose: new Date("2026-05-31T23:59:59Z"),
      q1Open: new Date("2026-07-01T00:00:00Z"),
      q1Close: new Date("2026-07-31T23:59:59Z"),
      q2Open: new Date("2026-10-01T00:00:00Z"),
      q2Close: new Date("2026-10-31T23:59:59Z"),
      q3Open: new Date("2027-01-01T00:00:00Z"),
      q3Close: new Date("2027-01-31T23:59:59Z"),
      q4Open: new Date("2027-03-15T00:00:00Z"),
      q4Close: new Date("2027-04-15T23:59:59Z"),
    },
  });

  // ─── RAHUL'S GOALS (LOCKED, Q1 check-ins complete) ────────
  console.log("  Creating Rahul's goals...");
  const rahulGoal1 = await prisma.goal.create({
    data: {
      title: "Quarterly Sales Revenue Achievement",
      description: "Achieve quarterly sales target of 50L through direct sales and channel partnerships",
      thrustArea: "Sales Revenue",
      uomType: "NUMERIC_MIN",
      uomUnit: "Lakhs (₹)",
      target: 50,
      weightage: 40,
      status: "LOCKED",
      isLocked: true,
      lockedAt: new Date("2026-05-31T23:59:59Z"),
      ownerId: rahul.id,
      approverId: vikram.id,
      cycleId: cycle.id,
      submittedAt: new Date("2026-05-10T10:00:00Z"),
      approvedAt: new Date("2026-05-12T14:00:00Z"),
      latestScore: 84,
      latestStatus: "ON_TRACK",
    },
  });

  const rahulGoal2 = await prisma.goal.create({
    data: {
      title: "Customer Response TAT Reduction",
      description: "Reduce average customer response turnaround time to under 48 hours",
      thrustArea: "Customer Experience",
      uomType: "NUMERIC_MAX",
      uomUnit: "Hours",
      target: 48,
      weightage: 30,
      status: "LOCKED",
      isLocked: true,
      lockedAt: new Date("2026-05-31T23:59:59Z"),
      ownerId: rahul.id,
      approverId: vikram.id,
      cycleId: cycle.id,
      submittedAt: new Date("2026-05-10T10:00:00Z"),
      approvedAt: new Date("2026-05-12T14:00:00Z"),
      latestScore: 92.3,
      latestStatus: "ON_TRACK",
    },
  });

  const rahulGoal3 = await prisma.goal.create({
    data: {
      title: "Zero Safety Incidents",
      description: "Maintain zero workplace safety incidents throughout the fiscal year",
      thrustArea: "Safety & Compliance",
      uomType: "ZERO",
      uomUnit: "Incidents",
      target: 0,
      weightage: 20,
      status: "LOCKED",
      isLocked: true,
      lockedAt: new Date("2026-05-31T23:59:59Z"),
      ownerId: rahul.id,
      approverId: vikram.id,
      cycleId: cycle.id,
      submittedAt: new Date("2026-05-10T10:00:00Z"),
      approvedAt: new Date("2026-05-12T14:00:00Z"),
      latestScore: 100,
      latestStatus: "COMPLETED",
    },
  });

  const rahulGoal4 = await prisma.goal.create({
    data: {
      title: "Sales Training Completion",
      description: "Complete advanced sales certification training program by end of Q2",
      thrustArea: "People Development",
      uomType: "TIMELINE",
      targetDate: new Date("2026-06-30T00:00:00Z"),
      weightage: 10,
      status: "LOCKED",
      isLocked: true,
      lockedAt: new Date("2026-05-31T23:59:59Z"),
      ownerId: rahul.id,
      approverId: vikram.id,
      cycleId: cycle.id,
      submittedAt: new Date("2026-05-10T10:00:00Z"),
      approvedAt: new Date("2026-05-12T14:00:00Z"),
      latestScore: null,
      latestStatus: "ON_TRACK",
    },
  });

  // ─── RAHUL'S Q1 CHECK-INS ─────────────────────────────────
  console.log("  Creating Rahul's check-ins...");
  await prisma.checkin.create({
    data: {
      quarter: "Q1", goalId: rahulGoal1.id, cycleId: cycle.id, employeeId: rahul.id,
      actualValue: 42, progressStatus: "ON_TRACK",
      employeeNote: "Strong Q1 with 42L achieved. Pipeline looks solid for Q2.",
      selfRating: 4, whatWentWell: "Closed 3 major enterprise deals", blockers: "Supply chain delays affected 2 orders",
      progressScore: 0.84, scorePercentage: 84, submittedAt: new Date("2026-07-15T10:00:00Z"),
      managerCheckedIn: true, managerComment: "Good progress, keep pushing the pipeline", managerRating: 4,
      checkedInBy: vikram.id, checkedInAt: new Date("2026-07-16T11:00:00Z"),
    },
  });

  await prisma.checkin.create({
    data: {
      quarter: "Q1", goalId: rahulGoal2.id, cycleId: cycle.id, employeeId: rahul.id,
      actualValue: 52, progressStatus: "ON_TRACK",
      employeeNote: "Reduced from 65h to 52h. Implementing new CRM workflow to push below 48h.",
      selfRating: 4, whatWentWell: "New ticketing system deployed", blockers: "High volume during festival season",
      progressScore: 0.923, scorePercentage: 92.3, submittedAt: new Date("2026-07-15T10:00:00Z"),
      managerCheckedIn: true, managerComment: "Great improvement, on track to hit target", managerRating: 4,
      checkedInBy: vikram.id, checkedInAt: new Date("2026-07-16T11:00:00Z"),
    },
  });

  await prisma.checkin.create({
    data: {
      quarter: "Q1", goalId: rahulGoal3.id, cycleId: cycle.id, employeeId: rahul.id,
      actualValue: 0, progressStatus: "COMPLETED",
      employeeNote: "Zero incidents reported. Team completed safety training on schedule.",
      selfRating: 5, whatWentWell: "100% safety training compliance", blockers: "None",
      progressScore: 1.0, scorePercentage: 100, submittedAt: new Date("2026-07-15T10:00:00Z"),
      managerCheckedIn: true, managerComment: "Excellent safety record", managerRating: 5,
      checkedInBy: vikram.id, checkedInAt: new Date("2026-07-16T11:00:00Z"),
    },
  });

  // ─── PRIYA'S GOALS (SUBMITTED, awaiting approval) ─────────
  console.log("  Creating Priya's goals...");
  await prisma.goal.create({
    data: {
      title: "New Client Acquisition",
      description: "Acquire 15 new enterprise clients through targeted outreach and networking",
      thrustArea: "Sales Revenue",
      uomType: "NUMERIC_MIN",
      uomUnit: "Clients",
      target: 15,
      weightage: 50,
      status: "SUBMITTED",
      ownerId: priya.id,
      cycleId: cycle.id,
      submittedAt: new Date("2026-05-14T09:00:00Z"),
    },
  });

  await prisma.goal.create({
    data: {
      title: "Client Satisfaction Score",
      description: "Achieve 85% or higher client satisfaction score across all accounts",
      thrustArea: "Customer Experience",
      uomType: "PERCENTAGE",
      uomUnit: "%",
      target: 85,
      weightage: 30,
      status: "SUBMITTED",
      ownerId: priya.id,
      cycleId: cycle.id,
      submittedAt: new Date("2026-05-14T09:00:00Z"),
    },
  });

  await prisma.goal.create({
    data: {
      title: "Proposal Turnaround Time",
      description: "Reduce proposal TAT to 5 days or less for all client requests",
      thrustArea: "Operational Excellence",
      uomType: "NUMERIC_MAX",
      uomUnit: "Days",
      target: 5,
      weightage: 20,
      status: "SUBMITTED",
      ownerId: priya.id,
      cycleId: cycle.id,
      submittedAt: new Date("2026-05-14T09:00:00Z"),
    },
  });

  // ─── ARJUN'S GOALS (APPROVED, not locked) ─────────────────
  console.log("  Creating Arjun's goals...");
  await prisma.goal.create({
    data: {
      title: "Production Line Uptime",
      description: "Maintain 99.5% production line uptime through preventive maintenance",
      thrustArea: "Operational Excellence",
      uomType: "PERCENTAGE",
      uomUnit: "%",
      target: 99.5,
      weightage: 40,
      status: "APPROVED",
      ownerId: arjun.id,
      approverId: deepa.id,
      cycleId: cycle.id,
      submittedAt: new Date("2026-05-08T10:00:00Z"),
      approvedAt: new Date("2026-05-10T14:00:00Z"),
    },
  });

  await prisma.goal.create({
    data: {
      title: "Operational Cost Reduction",
      description: "Reduce operational costs by 12L through process optimization and waste elimination",
      thrustArea: "Cost Efficiency",
      uomType: "NUMERIC_MIN",
      uomUnit: "Lakhs (₹)",
      target: 12,
      weightage: 35,
      status: "APPROVED",
      ownerId: arjun.id,
      approverId: deepa.id,
      cycleId: cycle.id,
      submittedAt: new Date("2026-05-08T10:00:00Z"),
      approvedAt: new Date("2026-05-10T14:00:00Z"),
    },
  });

  await prisma.goal.create({
    data: {
      title: "Zero Manufacturing Defects",
      description: "Achieve zero critical manufacturing defects in production output",
      thrustArea: "Safety & Compliance",
      uomType: "ZERO",
      uomUnit: "Defects",
      target: 0,
      weightage: 25,
      status: "APPROVED",
      ownerId: arjun.id,
      approverId: deepa.id,
      cycleId: cycle.id,
      submittedAt: new Date("2026-05-08T10:00:00Z"),
      approvedAt: new Date("2026-05-10T14:00:00Z"),
    },
  });

  // ─── SNEHA'S GOALS (DRAFT) ────────────────────────────────
  console.log("  Creating Sneha's goals...");
  await prisma.goal.create({
    data: {
      title: "Feature Delivery Count",
      description: "Deliver 8 major features across product sprints this fiscal year",
      thrustArea: "Innovation",
      uomType: "NUMERIC_MIN",
      uomUnit: "Features",
      target: 8,
      weightage: 60,
      status: "DRAFT",
      ownerId: sneha.id,
      cycleId: cycle.id,
    },
  });

  await prisma.goal.create({
    data: {
      title: "Bug Resolution Time",
      description: "Reduce average bug resolution time to under 48 hours",
      thrustArea: "Operational Excellence",
      uomType: "NUMERIC_MAX",
      uomUnit: "Hours",
      target: 48,
      weightage: 40,
      status: "DRAFT",
      ownerId: sneha.id,
      cycleId: cycle.id,
    },
  });

  // ─── ESCALATION RULES ─────────────────────────────────────
  console.log("  Creating escalation rules...");
  await prisma.escalationRule.createMany({
    data: [
      { cycleId: cycle.id, trigger: "GOAL_NOT_SUBMITTED", daysAfterTrigger: 7, escalateTo: "EMPLOYEE" },
      { cycleId: cycle.id, trigger: "GOAL_NOT_SUBMITTED", daysAfterTrigger: 14, escalateTo: "MANAGER" },
      { cycleId: cycle.id, trigger: "GOAL_NOT_APPROVED", daysAfterTrigger: 5, escalateTo: "MANAGER" },
      { cycleId: cycle.id, trigger: "GOAL_NOT_APPROVED", daysAfterTrigger: 10, escalateTo: "SKIP_LEVEL" },
      { cycleId: cycle.id, trigger: "CHECKIN_NOT_COMPLETED", daysAfterTrigger: 10, escalateTo: "EMPLOYEE" },
    ],
  });

  // ─── GOAL TEMPLATES ────────────────────────────────────────
  console.log("  Creating goal templates...");
  await prisma.goalTemplate.createMany({
    data: [
      { title: "Quarterly Revenue Achievement", thrustArea: "Sales Revenue", uomType: "NUMERIC_MIN", uomUnit: "Lakhs (₹)", suggestedTarget: 50, suggestedWeightage: 40, createdById: admin.id },
      { title: "Customer TAT Reduction", thrustArea: "Customer Experience", uomType: "NUMERIC_MAX", uomUnit: "Hours", suggestedTarget: 48, suggestedWeightage: 30, createdById: admin.id },
      { title: "Zero Safety Incidents", thrustArea: "Safety & Compliance", uomType: "ZERO", uomUnit: "Incidents", suggestedTarget: 0, suggestedWeightage: 20, createdById: admin.id },
      { title: "Training Completion", thrustArea: "People Development", uomType: "TIMELINE", suggestedWeightage: 20, createdById: admin.id },
      { title: "Production Uptime", thrustArea: "Operational Excellence", uomType: "PERCENTAGE", uomUnit: "%", suggestedTarget: 99.5, suggestedWeightage: 40, createdById: admin.id },
      { title: "Cost Reduction vs Budget", thrustArea: "Cost Efficiency", uomType: "NUMERIC_MIN", uomUnit: "Lakhs (₹)", suggestedTarget: 10, suggestedWeightage: 30, createdById: admin.id },
      { title: "Feature Delivery Count", thrustArea: "Innovation", uomType: "NUMERIC_MIN", uomUnit: "Features", suggestedTarget: 8, suggestedWeightage: 40, createdById: admin.id },
      { title: "Process Automation Coverage", thrustArea: "Digital Transformation", uomType: "PERCENTAGE", uomUnit: "%", suggestedTarget: 80, suggestedWeightage: 25, createdById: admin.id },
    ],
  });

  // ─── NOTIFICATIONS ─────────────────────────────────────────
  console.log("  Creating notifications...");
  await prisma.notification.createMany({
    data: [
      {
        userId: vikram.id, type: "GOAL_SUBMITTED_FOR_APPROVAL",
        title: "Priya Mehta submitted 3 goals for review",
        message: "3 goal(s) submitted — total weightage 100%",
        link: "/dashboard/manager/approvals",
      },
      {
        userId: rahul.id, type: "GOAL_APPROVED",
        title: "Q1 check-in submitted successfully",
        message: "Your Q1 check-ins have been reviewed by your manager.",
        link: "/dashboard/employee/goals",
        read: true, readAt: new Date("2026-07-16T12:00:00Z"),
      },
      {
        userId: admin.id, type: "ESCALATION_TRIGGERED",
        title: "Escalation run completed",
        message: "2 employees notified for overdue goal submissions",
        link: "/dashboard/admin/escalations",
      },
    ],
  });

  // ─── AUDIT LOGS ────────────────────────────────────────────
  console.log("  Creating audit logs...");
  await prisma.auditLog.createMany({
    data: [
      {
        userId: rahul.id, action: "GOAL_CREATED", entityType: "Goal", entityId: rahulGoal1.id, goalId: rahulGoal1.id,
        newValue: { title: "Quarterly Sales Revenue Achievement", weightage: 40 },
        createdAt: new Date("2026-05-10T09:00:00Z"),
      },
      {
        userId: rahul.id, action: "GOAL_SUBMITTED", entityType: "Goal", entityId: rahulGoal1.id, goalId: rahulGoal1.id,
        newValue: { count: 4, status: "SUBMITTED" },
        createdAt: new Date("2026-05-10T10:00:00Z"),
      },
      {
        userId: vikram.id, action: "GOAL_APPROVED", entityType: "Goal", entityId: rahulGoal1.id, goalId: rahulGoal1.id,
        oldValue: { status: "SUBMITTED", target: 50, weightage: 40 },
        newValue: { status: "APPROVED" },
        createdAt: new Date("2026-05-12T14:00:00Z"),
      },
      {
        userId: rahul.id, action: "CHECKIN_SUBMITTED", entityType: "Checkin", entityId: rahulGoal1.id, goalId: rahulGoal1.id,
        newValue: { quarter: "Q1", score: 84, progressStatus: "ON_TRACK" },
        createdAt: new Date("2026-07-15T10:00:00Z"),
      },
      {
        userId: priya.id, action: "GOAL_SUBMITTED", entityType: "Goal", entityId: cycle.id,
        newValue: { count: 3, status: "SUBMITTED" },
        createdAt: new Date("2026-05-14T09:00:00Z"),
      },
    ],
  });

  console.log("✅ Seed completed successfully!");
  console.log("\n📋 Demo Credentials:");
  console.log("  Admin:    admin@atomberg.com / Admin@123");
  console.log("  HR:       hr@atomberg.com / Hr@123");
  console.log("  Manager:  vikram.singh@atomberg.com / Manager@123");
  console.log("  Manager:  deepa.nair@atomberg.com / Manager@123");
  console.log("  Employee: rahul.sharma@atomberg.com / Employee@123");
  console.log("  Employee: priya.mehta@atomberg.com / Employee@123");
  console.log("  Employee: arjun.patel@atomberg.com / Employee@123");
  console.log("  Employee: sneha.roy@atomberg.com / Employee@123");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
