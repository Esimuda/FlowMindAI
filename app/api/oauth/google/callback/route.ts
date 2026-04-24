import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveIntegrationConfig, loadIntegrationConfig } from "@/lib/db/integrations";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${origin}/dashboard?error=google-oauth-failed`);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? origin}/api/oauth/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/dashboard?error=google-token-exchange-failed`);
  }

  const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string };

  // Merge into existing integration config
  const existing = await loadIntegrationConfig(userId);
  await saveIntegrationConfig(userId, {
    ...existing,
    gmailClientId: clientId,
    gmailClientSecret: clientSecret,
    gmailRefreshToken: tokens.refresh_token ?? existing.gmailRefreshToken,
    googleSheetsClientEmail: existing.googleSheetsClientEmail,
    googleSheetsPrivateKey: existing.googleSheetsPrivateKey,
  });

  return NextResponse.redirect(`${origin}/dashboard?connected=google`);
}
