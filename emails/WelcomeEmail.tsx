// Email sent to new users when their account is created by admin
import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Preview, Section, Text,
} from "@react-email/components";

interface Props {
  name: string;
  email: string;
  tempPassword: string;
  role: string;
  appUrl: string;
}

export default function WelcomeEmail({ name, email, tempPassword, role, appUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to AtomQuest, {name}! Your account is ready.</Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", backgroundColor: "#ffffff", borderRadius: 8, overflow: "hidden" }}>
          <Section style={{ backgroundColor: "#1D4ED8", padding: "24px 32px" }}>
            <Heading style={{ color: "#ffffff", margin: 0, fontSize: 20 }}>AtomQuest</Heading>
            <Text style={{ color: "#bfdbfe", margin: "4px 0 0", fontSize: 13 }}>Goal Setting & Tracking Portal · Atomberg Technologies</Text>
          </Section>
          <Section style={{ padding: "32px" }}>
            <Heading style={{ fontSize: 18, color: "#0f172a", marginTop: 0 }}>
              Welcome to AtomQuest, {name}!
            </Heading>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              Your account has been created as <strong>{role}</strong>. Use the credentials below to log in.
            </Text>

            <Section style={{ backgroundColor: "#f1f5f9", borderRadius: 6, padding: "20px", margin: "20px 0" }}>
              <Text style={{ margin: "0 0 8px", fontSize: 14, color: "#64748b" }}>
                <strong>Email:</strong> {email}
              </Text>
              <Text style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
                <strong>Temporary Password:</strong>{" "}
                <span style={{ fontFamily: "monospace", backgroundColor: "#e2e8f0", padding: "2px 6px", borderRadius: 4 }}>
                  {tempPassword}
                </span>
              </Text>
            </Section>

            <Text style={{ color: "#dc2626", fontSize: 13, lineHeight: 1.6 }}>
              ⚠️ Please change your password immediately after your first login.
            </Text>

            <Section style={{ textAlign: "center", margin: "32px 0" }}>
              <Button
                href={`${appUrl}/login`}
                style={{ backgroundColor: "#1D4ED8", color: "#ffffff", padding: "12px 28px", borderRadius: 6, fontWeight: 600, textDecoration: "none", display: "inline-block" }}
              >
                Log In to AtomQuest →
              </Button>
            </Section>
            <Hr style={{ borderColor: "#e2e8f0" }} />
            <Text style={{ fontSize: 12, color: "#94a3b8", marginBottom: 0 }}>
              AtomQuest · Atomberg Technologies · If you did not expect this email, please contact your HR team.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
