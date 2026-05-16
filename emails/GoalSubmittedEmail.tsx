// Email sent to manager when an employee submits their goals for review
import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Preview, Section, Text,
} from "@react-email/components";

interface Props {
  managerName: string;
  employeeName: string;
  goalCount: number;
  appUrl: string;
}

export default function GoalSubmittedEmail({ managerName, employeeName, goalCount, appUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{`${employeeName} submitted ${goalCount} goal(s) for your review`}</Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", backgroundColor: "#ffffff", borderRadius: 8, overflow: "hidden" }}>
          <Section style={{ backgroundColor: "#1D4ED8", padding: "24px 32px" }}>
            <Heading style={{ color: "#ffffff", margin: 0, fontSize: 20 }}>AtomQuest</Heading>
            <Text style={{ color: "#bfdbfe", margin: "4px 0 0", fontSize: 13 }}>Goal Setting & Tracking Portal</Text>
          </Section>
          <Section style={{ padding: "32px" }}>
            <Heading style={{ fontSize: 18, color: "#0f172a", marginTop: 0 }}>
              Goals Submitted for Review
            </Heading>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              Hi {managerName},
            </Text>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              <strong>{employeeName}</strong> has submitted <strong>{goalCount} goal(s)</strong> for your approval.
              Please review and approve, return, or reject them within 5 working days.
            </Text>
            <Section style={{ textAlign: "center", margin: "32px 0" }}>
              <Button
                href={`${appUrl}/dashboard/manager/approvals`}
                style={{ backgroundColor: "#1D4ED8", color: "#ffffff", padding: "12px 28px", borderRadius: 6, fontWeight: 600, textDecoration: "none", display: "inline-block" }}
              >
                Review Goals →
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
