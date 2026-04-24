import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDueSchedulesAdmin, markScheduleRanAdmin } from "@/lib/db/schedules-server";
import { runOrchestrator } from "@/lib/agent/orchestrator";
import { saveRun, updateRun } from "@/lib/db/runs";
import { sendAlertNotification } from "@/lib/monitoring/notify";
import type { AgentRun, IntegrationConfig } from "@/lib/types";

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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

function buildScheduledPrompt(schedule: { blueprint: { name: string; trigger: string; steps: Array<{ step: number; tool: string; action: string; output: string }> }; frequency: string }): string {
  const steps = schedule.blueprint.steps
    .map((s) => `  ${s.step}. [${s.tool}] ${s.action} → ${s.output}`)
    .join("\n");
  return [
    `Execute this scheduled workflow now — call each tool in sequence using your actual tools. Do not describe or summarise; execute.`,
    ``,
    `WORKFLOW: "${schedule.blueprint.name}"`,
    `TRIGGER: ${schedule.blueprint.trigger} (scheduled — ${schedule.frequency})`,
    ``,
    `STEPS:`,
    steps,
    ``,
    `Run each step in order. If a step fails, log the error and continue. After all steps, give a plain summary of what succeeded and what failed.`,
  ].join("\n");
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Vercel automatically sends Authorization: Bearer <CRON_SECRET> for cron jobs.
  // Allow unauthenticated calls in local dev (no CRON_SECRET set).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const dueSchedules = await getDueSchedulesAdmin();

  if (dueSchedules.length === 0) {
    return NextResponse.json({ ran: 0 });
  }

  const admin = createAdminClient();

  const results = await Promise.allSettled(
    dueSchedules.map(async (schedule) => {
      // Load user's integration config (admin bypasses RLS)
      const { data: integData } = await admin
        .from("user_integrations")
        .select("config")
        .eq("user_id", schedule.user_id)
        .single();

      const config = mergeWithEnv((integData?.config ?? {}) as Partial<IntegrationConfig>);

      const runId = generateId();
      const run: AgentRun = {
        id: runId,
        status: "running",
        userMessage: `[Scheduled] ${schedule.workflow_name}`,
        toolCalls: [],
        startedAt: Date.now(),
      };
      saveRun(run);

      let finalMessage = "";
      let runStatus: "success" | "failure" = "success";
      const startedAt = Date.now();
      // Track step results for alert payloads
      let succeededSteps = 0;
      let failedSteps = 0;

      const trackEmit = (event: { type: string }) => {
        if (event.type === "tool_call_complete") succeededSteps++;
        if (event.type === "tool_call_error") failedSteps++;
      };

      try {
        finalMessage = await runOrchestrator({
          message: buildScheduledPrompt(schedule as Parameters<typeof buildScheduledPrompt>[0]),
          conversationHistory: [],
          runId,
          emit: trackEmit as Parameters<typeof runOrchestrator>[0]["emit"],
          config,
          userId: schedule.user_id,
        });

        updateRun(runId, { status: "completed", finalMessage, completedAt: Date.now() });

        await admin.from("run_history").upsert({
          id: runId,
          user_id: schedule.user_id,
          run: { ...run, status: "completed", finalMessage, completedAt: Date.now() },
          started_at: new Date(run.startedAt).toISOString(),
        });
      } catch (err) {
        runStatus = "failure";
        updateRun(runId, { status: "failed", completedAt: Date.now() });
        const errMsg = err instanceof Error ? err.message : String(err);
        finalMessage = `Error: ${errMsg}`;
        await admin.from("run_history").upsert({
          id: runId,
          user_id: schedule.user_id,
          run: { ...run, status: "failed", finalMessage, completedAt: Date.now() },
          started_at: new Date(run.startedAt).toISOString(),
        });
      }

      // Fire alert notifications (non-blocking)
      const { data: alertRows } = await admin
        .from("workflow_alerts")
        .select("*")
        .eq("user_id", schedule.user_id)
        .eq("workflow_id", schedule.workflow_id)
        .eq("enabled", true);

      if (alertRows && alertRows.length > 0) {
        const notifyPayload = {
          workflowName: schedule.workflow_name,
          status: runStatus,
          runId,
          summary: finalMessage.slice(0, 200),
          succeededSteps,
          failedSteps,
          durationMs: Date.now() - startedAt,
        };
        await Promise.allSettled(
          alertRows.map((row: Record<string, unknown>) =>
            sendAlertNotification(
              {
                id: row.id as string,
                userId: row.user_id as string,
                workflowId: row.workflow_id as string,
                workflowName: row.workflow_name as string,
                channel: row.channel as "email" | "slack",
                destination: row.destination as string,
                event: row.event as "failure" | "success" | "all",
                enabled: row.enabled as boolean,
                createdAt: new Date(row.created_at as string).getTime(),
              },
              notifyPayload
            )
          )
        );
      }

      // Always advance the schedule's next_run_at so it doesn't retrigger immediately
      await markScheduleRanAdmin(schedule.id, schedule.frequency, schedule.run_hour, schedule.next_run_at);
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ ran: dueSchedules.length, succeeded, failed });
}
