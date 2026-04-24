import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadIntegrationConfig } from "@/lib/db/integrations";
import { runOrchestrator } from "@/lib/agent/orchestrator";

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient();

  // Look up the webhook by ID
  const { data: webhook } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", params.id)
    .eq("enabled", true)
    .single();

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  // Parse incoming payload
  let payload: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) payload = JSON.parse(text);
  } catch {
    // Non-JSON payloads are fine
  }

  const userId: string = webhook.user_id;
  const workflowName: string = webhook.workflow_name;

  // Load the workflow blueprint
  const { data: workflowRow } = await supabase
    .from("workflows")
    .select("blueprint")
    .eq("user_id", userId)
    .eq("name", workflowName)
    .single();

  if (!workflowRow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  // Record the trigger
  await supabase.from("webhooks").update({
    last_triggered_at: new Date().toISOString(),
    trigger_count: (webhook.trigger_count ?? 0) + 1,
  }).eq("id", params.id);

  const config = await loadIntegrationConfig(userId);

  const runId = generateId();

  // Fire and forget — respond immediately, run async
  (async () => {
    try {
      await runOrchestrator({
        message: `Execute workflow "${workflowName}". Triggered by webhook with payload: ${JSON.stringify(payload)}`,
        conversationHistory: [],
        runId,
        emit: () => {},
        config: {
          notionApiKey: config.notionApiKey || process.env.NOTION_API_KEY,
          notionDatabaseId: config.notionDatabaseId || process.env.NOTION_DATABASE_ID,
          resendApiKey: config.resendApiKey || process.env.RESEND_API_KEY,
          slackWebhookUrl: config.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL,
          stripeSecretKey: config.stripeSecretKey || process.env.STRIPE_SECRET_KEY,
          hubspotApiKey: config.hubspotApiKey || process.env.HUBSPOT_API_KEY,
          airtableApiKey: config.airtableApiKey || process.env.AIRTABLE_API_KEY,
          airtableBaseId: config.airtableBaseId || process.env.AIRTABLE_BASE_ID,
          googleSheetsClientEmail: config.googleSheetsClientEmail || process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
          googleSheetsPrivateKey: config.googleSheetsPrivateKey || process.env.GOOGLE_SHEETS_PRIVATE_KEY,
          gmailClientId: config.gmailClientId || process.env.GMAIL_CLIENT_ID,
          gmailClientSecret: config.gmailClientSecret || process.env.GMAIL_CLIENT_SECRET,
          gmailRefreshToken: config.gmailRefreshToken || process.env.GMAIL_REFRESH_TOKEN,
        },
        userId,
      });
    } catch {
      // Background execution — errors are recorded in workflow_executions table
    }
  })();

  return NextResponse.json({ ok: true, runId, message: `Workflow "${workflowName}" triggered` });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: webhook } = await supabase
    .from("webhooks")
    .select("id, workflow_name, created_at, last_triggered_at, trigger_count")
    .eq("id", params.id)
    .eq("enabled", true)
    .single();

  if (!webhook) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ webhook });
}
