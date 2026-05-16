// Email sent when an escalation is triggered (to employee, manager, skip-level, or HR)
import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Preview, Section, Text,
} from "@react-email/components";

type TriggerType = "GOAL_NOT_SUBMITTED" | "GOAL_NOT_APPROVED" | "CHECKIN_NOT_COMPLETED";

interface Props {
  recipientName: string;
  employeeName: string;
  trigger: TriggerType;
  cycleName: string;
  appUrl: string;
}

const TRIGGER_MESSAGES: Record<TriggerType, { subject: string; body: string; link: string }> = {
  GOAL_NOT_SUBMITTED: {
    subject: "has not submitted their goals yet",
    body: "has not yet submitted their goals for the current performance cycle. Please follow up to ensure they complete their goal setting on time.",
    link: "/dashboard/manager/team",
  },
  GOAL_NOT_APPROVED: {
    subject: "has pending goals awaiting approval",
    body: "has submitted goals that have been awaiting your approval for an extended period. Please review and take action to avoid delays.",
    link: "/dashboard/manager/approvals",
  },
  CHECKIN_NOT_COMPLETED: {
    subject: "has not completed their quarterly check-in",
    body: "has not completed their quarterly check-in. This may impact their performance review. Please remind them to update their progress.",
    link: "/dashboard/manager/checkins",
  },
};

export default function EscalationEmail({ recipientName, employeeName, trigger, cycleName, appUrl }: Props) {
  const msg = TRIGGER_MESSAGES[trigger];
  return (
    <Html>
      <Head />
      <Preview>Escalation: {employeeName} {msg.subject}</Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", backgroundColor: "#ffffff", borderRadius: 8, overflow: "hidden" }}>
          <Section style={{ backgroundColor: "#7C3AED", padding: "24px 32px" }}>
            <Heading style={{ color: "#ffffff", margin: 0, fontSize: 20 }}>AtomQuest</Heading>
            <Text style={{ color: "#ddd6fe", margin: "4px 0 0", fontSize: 13 }}>Escalation Alert</Text>
          </Section>
          <Section style={{ padding: "32px" }}>
            <Heading style={{ fontSize: 18, color: "#0f172a", marginTop: 0 }}>
              Action Required: {employeeName}
            </Heading>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>Hi {recipientName},</Text>
            <Section style={{ backgroundColor: "#faf5ff", border: "1px solid #ddd6fe", borderRadius: 6, padding: "16px", margin: "16px 0" }}>
              <Text style={{ color: "#5b21b6", margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                <strong>{employeeName}</strong> {msg.body}
              </Text>
              <Text style={{ color: "#7c3aed", margin: "8px 0 0", fontSize: 13 }}>
                Cycle: {cycleName}
              </Text>
            </Section>
            <Section style={{ textAlign: "center", margin: "32px 0" }}>
              <Button
                href={`${appUrl}${msg.link}`}
                style={{ backgroundColor: "#7C3AED", color: "#ffffff", padding: "12px 28px", borderRadius: 6, fontWeight: 600, textDecoration: "none", display: "inline-block" }}
              >
                Take Action →
              </Button>
            </Section>
            <Hr style={{ borderColor: "#e2e8f0" }} />
            <Text style={{ fontSize: 12, color: "#94a3b8", marginBottom: 0 }}>
              AtomQuest · Atomberg Technologies · Automated escalation from the performance management system.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
