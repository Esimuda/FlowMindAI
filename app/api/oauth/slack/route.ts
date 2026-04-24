import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SCOPES = "incoming-webhook,chat:write";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth", req.url));

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "SLACK_CLIENT_ID not configured" }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin}/api/oauth/slack/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: user.id,
  });

  return NextResponse.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
}
