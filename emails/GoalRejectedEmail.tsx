// Email sent to employee when their goal is rejected by a manager
import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Preview, Section, Text,
} from "@react-email/components";

interface Props {
  employeeName: string;
  goalTitle: string;
  goalId: string;
  reason: string;
  appUrl: string;
}

export default function GoalRejectedEmail({ employeeName, goalTitle, goalId, reason, appUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your goal &quot;{goalTitle}&quot; requires attention</Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", backgroundColor: "#ffffff", borderRadius: 8, overflow: "hidden" }}>
          <Section style={{ backgroundColor: "#DC2626", padding: "24px 32px" }}>
            <Heading style={{ color: "#ffffff", margin: 0, fontSize: 20 }}>AtomQuest</Heading>
            <Text style={{ color: "#fecaca", margin: "4px 0 0", fontSize: 13 }}>Goal Rejected</Text>
          </Section>
          <Section style={{ padding: "32px" }}>
            <Heading style={{ fontSize: 18, color: "#0f172a", marginTop: 0 }}>
              Action Required, {employeeName}
            </Heading>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              Your goal <strong>&quot;{goalTitle}&quot;</strong> was rejected by your manager.
            </Text>
            <Section style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "16px", margin: "16px 0" }}>
              <Text style={{ color: "#991b1b", margin: 0, fontSize: 14 }}>
                <strong>Reason:</strong> {reason}
              </Text>
            </Section>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              Please create a revised goal and resubmit before the goal-setting window closes.
            </Text>
            <Section style={{ textAlign: "center", margin: "32px 0" }}>
              <Button
                href={`${appUrl}/dashboard/employee/goals/${goalId}`}
                style={{ backgroundColor: "#DC2626", color: "#ffffff", padding: "12px 28px", borderRadius: 6, fontWeight: 600, textDecoration: "none", display: "inline-block" }}
              >
                View Goal →
              </Button>
            </Section>
            <Hr style={{ borderColor: "#e2e8f0" }} />
            <Text style={{ fontSize: 12, color: "#94a3b8", marginBottom: 0 }}>
              AtomQuest · Atomberg Technologies · This is an automated notification.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
