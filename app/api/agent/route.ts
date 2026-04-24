import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runOrchestrator } from "@/lib/agent/orchestrator";
import { saveRun, updateRun } from "@/lib/db/runs";
import { createClient } from "@/lib/supabase/server";
import { loadIntegrationConfig } from "@/lib/db/integrations";
import { AgentRun, AgentStreamEvent, BusinessProfile, IntegrationConfig, ToolCallRecord } from "@/lib/types";
import type { SavedWorkflow } from "@/lib/db/workflows";
import { listCustomTools } from "@/lib/db/customTools";

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Supabase-stored keys take precedence over env vars; env vars are the fallback
function mergeWithEnv(stored: Partial<IntegrationConfig>): IntegrationConfig {
  return {
    notionApiKey:            stored.notionApiKey            || process.env.NOTION_API_KEY,
    notionDatabaseId:        stored.notionDatabaseId        || process.env.NOTION_DATABASE_ID,
    resendApiKey:            stored.resendApiKey            || process.env.RESEND_API_KEY,
    slackWebhookUrl:         stored.slackWebhookUrl         || process.env.SLACK_WEBHOOK_URL,
    stripeSecretKey:         stored.stripeSecretKey         || process.env.STRIPE_SECRET_KEY,
    hubspotApiKey:           stored.hubspotApiKey           || process.env.HUBSPOT_API_KEY,
    airtableApiKey:          stored.airtableApiKey          || process.env.AIRTABLE_API_KEY,
    airtableBaseId:          stored.airtableBaseId          || process.env.AIRTABLE_BASE_ID,
    googleSheetsClientEmail: stored.googleSheetsClientEmail || process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    googleSheetsPrivateKey:  stored.googleSheetsPrivateKey  || process.env.GOOGLE_SHEETS_PRIVATE_KEY,
    gmailClientId:           stored.gmailClientId           || process.env.GMAIL_CLIENT_ID,
    gmailClientSecret:       stored.gmailClientSecret       || process.env.GMAIL_CLIENT_SECRET,
    gmailRefreshToken:       stored.gmailRefreshToken       || process.env.GMAIL_REFRESH_TOKEN,
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const { message, conversationHistory = [], businessProfile, savedWorkflows, runHistory } = await req.json() as {
    message: string;
    conversationHistory?: Anthropic.MessageParam[];
    businessProfile?: BusinessProfile | null;
    savedWorkflows?: SavedWorkflow[];
    runHistory?: AgentRun[];
  };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), { status: 400 });
  }

  const runId = generateId();
  const run: AgentRun = {
    id: runId,
    status: "running",
    userMessage: message,
    toolCalls: [],
    startedAt: Date.now(),
  };
  saveRun(run);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: AgentStreamEvent) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));

        // Mirror tool call events into the run record
        if (event.type === "tool_call_start") {
          const tc: ToolCallRecord = {
            id: event.toolCallId,
            toolName: event.toolName,
            status: "calling",
            input: event.input,
            startedAt: Date.now(),
          };
          const existing = run.toolCalls;
          existing.push(tc);
          updateRun(runId, { toolCalls: existing });
        }

        if (event.type === "tool_call_complete") {
          const updated = run.toolCalls.map((tc) =>
            tc.id === event.toolCallId
              ? { ...tc, status: "success" as const, output: event.output, completedAt: Date.now() }
              : tc
          );
          updateRun(runId, { toolCalls: updated });
        }

        if (event.type === "tool_call_error") {
          const updated = run.toolCalls.map((tc) =>
            tc.id === event.toolCallId
              ? { ...tc, status: "error" as const, error: event.error, completedAt: Date.now() }
              : tc
          );
          updateRun(runId, { toolCalls: updated });
        }
      }

      emit({ type: "run_started", runId });

      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id ?? "anonymous";

        // Fetch credentials from Supabase server-side — keys never travel from client
        const storedConfig = userId !== "anonymous"
          ? await loadIntegrationConfig(userId)
          : {};
        const config = mergeWithEnv(storedConfig);

        const customTools = userId !== "anonymous" ? await listCustomTools(userId) : [];

        const finalMessage = await runOrchestrator({
          message,
          conversationHistory,
          runId,
          emit,
          config,
          businessProfile,
          savedWorkflows,
          runHistory,
          userId,
          customTools,
        });

        updateRun(runId, { status: "completed", finalMessage, completedAt: Date.now() });
        emit({ type: "run_complete", runId, finalMessage });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        updateRun(runId, { status: "failed", completedAt: Date.now() });
        emit({ type: "run_error", runId, error });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
