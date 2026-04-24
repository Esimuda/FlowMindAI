export async function sendMessage(
  webhookUrl: string,
  content: string,
  username?: string,
  embedTitle?: string,
  embedDescription?: string,
  embedColor?: number
): Promise<string> {
  const body: Record<string, unknown> = { content };
  if (username) body.username = username;
  if (embedTitle || embedDescription) {
    body.embeds = [
      {
        title: embedTitle,
        description: embedDescription,
        color: embedColor ?? 0x7c3aed,
      },
    ];
    body.content = content || undefined;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook error ${res.status}: ${text}`);
  }
  return "Discord message sent successfully.";
}
