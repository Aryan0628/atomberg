// lib/teams.ts
// COST: Incoming webhooks are free via Microsoft Teams — no app registration needed.

interface TeamsCard {
  title: string;
  text: string;
  actions?: { type: "OpenUrl"; title: string; url: string }[];
}

export async function sendTeamsCard(card: TeamsCard): Promise<void> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) return;

  const body = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "1D4ED8",
    summary: card.title,
    sections: [{ activityTitle: card.title, activityText: card.text }],
    potentialAction:
      card.actions?.map((a) => ({
        "@type": "OpenUri",
        name: a.title,
        targets: [{ os: "default", uri: a.url }],
      })) ?? [],
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((err) => console.error("[TEAMS ERROR]", err));
}
