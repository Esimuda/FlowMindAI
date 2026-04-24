import { NextRequest, NextResponse } from "next/server";
import { saveIntegrationConfig, loadIntegrationConfig } from "@/lib/db/integrations";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${origin}/dashboard?error=slack-oauth-failed`);
  }

  const clientId = process.env.SLACK_CLIENT_ID!;
  const clientSecret = process.env.SLACK_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? origin}/api/oauth/slack/callback`;

  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
  });

  const data = await tokenRes.json() as { ok: boolean; incoming_webhook?: { url: string } };

  if (!data.ok || !data.incoming_webhook?.url) {
    return NextResponse.redirect(`${origin}/dashboard?error=slack-oauth-failed`);
  }

  const existing = await loadIntegrationConfig(userId);
  await saveIntegrationConfig(userId, {
    ...existing,
    slackWebhookUrl: data.incoming_webhook.url,
  });

  return NextResponse.redirect(`${origin}/dashboard?connected=slack`);
}
