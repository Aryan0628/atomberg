// Email sent to employees when a check-in window opens
import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Preview, Section, Text,
} from "@react-email/components";

interface Props {
  employeeName: string;
  quarter: string;
  closeDate: string;
  appUrl: string;
}

export default function CheckinReminderEmail({ employeeName, quarter, closeDate, appUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{quarter} check-in window is now open — complete by {closeDate}</Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", backgroundColor: "#ffffff", borderRadius: 8, overflow: "hidden" }}>
          <Section style={{ backgroundColor: "#F59E0B", padding: "24px 32px" }}>
            <Heading style={{ color: "#ffffff", margin: 0, fontSize: 20 }}>AtomQuest</Heading>
            <Text style={{ color: "#fef3c7", margin: "4px 0 0", fontSize: 13 }}>Check-in Reminder</Text>
          </Section>
          <Section style={{ padding: "32px" }}>
            <Heading style={{ fontSize: 18, color: "#0f172a", marginTop: 0 }}>
              {quarter} Check-in Window is Open
            </Heading>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              Hi {employeeName},
            </Text>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              The <strong>{quarter} check-in window</strong> is now open. Please update your progress for all approved goals before <strong>{closeDate}</strong>.
            </Text>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              Completing your check-in on time ensures your manager has accurate visibility into your achievements.
            </Text>
            <Section style={{ textAlign: "center", margin: "32px 0" }}>
              <Button
                href={`${appUrl}/dashboard/employee/goals`}
                style={{ backgroundColor: "#F59E0B", color: "#ffffff", padding: "12px 28px", borderRadius: 6, fontWeight: 600, textDecoration: "none", display: "inline-block" }}
              >
                Complete Check-in →
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
