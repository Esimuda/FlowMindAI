import { AgentRun, IntegrationConfig } from "@/lib/types";
import type { SavedWorkflow } from "@/lib/db/workflows";
import type { CustomTool } from "@/lib/db/customTools";
import { executeCustomTool } from "@/lib/db/customTools";
import { buildExecutionPlan, formatExecutionPlan, type DagStep } from "@/lib/agent/dag";
import * as notion from "@/lib/integrations/notion";
import * as resend from "@/lib/integrations/resend";
import * as slack from "@/lib/integrations/slack";
import * as stripe from "@/lib/integrations/stripe";
import * as hubspot from "@/lib/integrations/hubspot";
import * as airtable from "@/lib/integrations/airtable";
import * as sheets from "@/lib/integrations/sheets";
import * as gmail from "@/lib/integrations/gmail";
import * as calendar from "@/lib/integrations/calendar";
import * as twilio from "@/lib/integrations/twilio";
import * as github from "@/lib/integrations/github";
import * as linear from "@/lib/integrations/linear";
import * as discord from "@/lib/integrations/discord";
import * as mailchimp from "@/lib/integrations/mailchimp";

export interface RunContext {
  savedWorkflows?: SavedWorkflow[];
  runHistory?: AgentRun[];
  customTools?: CustomTool[];
}

export interface ToolResult {
  output: string;
  isError: boolean;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  config: IntegrationConfig,
  context?: RunContext
): Promise<ToolResult> {
  try {
    const output = await dispatch(toolName, input, config, context);
    return { output, isError: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: message, isError: true };
  }
}

async function dispatch(
  toolName: string,
  input: Record<string, unknown>,
  config: IntegrationConfig,
  context?: RunContext
): Promise<string> {
  switch (toolName) {
    case "notion_create_page": {
      const apiKey = config.notionApiKey;
      const dbId = (input.database_id as string | undefined) ?? config.notionDatabaseId;
      if (!apiKey) throw new Error("Notion is not connected. Please add NOTION_API_KEY.");
      if (!dbId) throw new Error("No Notion database configured. Please add NOTION_DATABASE_ID.");
      return notion.createPage(
        apiKey,
        dbId,
        input.title as string,
        (input.properties as Record<string, unknown>) ?? {},
        input.content as string | undefined
      );
    }

    case "notion_query_database": {
      const apiKey = config.notionApiKey;
      const dbId = (input.database_id as string | undefined) ?? config.notionDatabaseId;
      if (!apiKey) throw new Error("Notion is not connected. Please add NOTION_API_KEY.");
      if (!dbId) throw new Error("No Notion database configured. Please add NOTION_DATABASE_ID.");
      return notion.queryDatabase(
        apiKey,
        dbId,
        input.filter_property as string | undefined,
        input.filter_value as string | undefined,
        (input.page_size as number | undefined) ?? 10
      );
    }

    case "send_email": {
      const apiKey = config.resendApiKey;
      if (!apiKey) throw new Error("Email is not connected. Please add RESEND_API_KEY.");
      return resend.sendEmail(
        apiKey,
        input.to as string,
        input.subject as string,
        input.body_html as string,
        (input.from_name as string | undefined) ?? "Operant AI",
        input.reply_to as string | undefined
      );
    }

    case "slack_send_message": {
      const webhookUrl = (input.webhook_url as string | undefined) ?? config.slackWebhookUrl;
      if (!webhookUrl) throw new Error("Slack is not connected. Please add SLACK_WEBHOOK_URL.");
      return slack.sendMessage(webhookUrl, input.message as string);
    }

    case "stripe_list_customers": {
      const secretKey = config.stripeSecretKey;
      if (!secretKey) throw new Error("Stripe is not connected. Please add STRIPE_SECRET_KEY.");
      return stripe.listCustomers(
        secretKey,
        (input.limit as number | undefined) ?? 10,
        input.email as string | undefined
      );
    }

    case "stripe_list_charges": {
      const secretKey = config.stripeSecretKey;
      if (!secretKey) throw new Error("Stripe is not connected. Please add STRIPE_SECRET_KEY.");
      return stripe.listCharges(
        secretKey,
        (input.limit as number | undefined) ?? 10,
        input.customer_id as string | undefined
      );
    }

    case "build_workflow": {
      const steps = input.steps as Array<{ step: number; action: string; tool: string; output: string }>;
      const summary = steps.map((s) => `  ${s.step}. [${s.tool}] ${s.action}`).join("\n");
      return `Workflow "${input.name}" designed:\nTrigger: ${input.trigger}\nSteps:\n${summary}\nOutcome: ${input.expected_outcome}\n__WORKFLOW_JSON__:${JSON.stringify(input)}`;
    }

    case "hubspot_create_contact": {
      const apiKey = config.hubspotApiKey;
      if (!apiKey) throw new Error("HubSpot is not connected. Please add HUBSPOT_API_KEY.");
      return hubspot.createContact(
        apiKey,
        input.email as string,
        input.first_name as string | undefined,
        input.last_name as string | undefined,
        input.company as string | undefined,
        input.phone as string | undefined
      );
    }

    case "hubspot_search_contacts": {
      const apiKey = config.hubspotApiKey;
      if (!apiKey) throw new Error("HubSpot is not connected. Please add HUBSPOT_API_KEY.");
      return hubspot.searchContacts(
        apiKey,
        input.query as string,
        (input.limit as number | undefined) ?? 10
      );
    }

    case "airtable_create_record": {
      const apiKey = config.airtableApiKey;
      const baseId = (input.base_id as string | undefined) ?? config.airtableBaseId;
      if (!apiKey) throw new Error("Airtable is not connected. Please add AIRTABLE_API_KEY.");
      if (!baseId) throw new Error("No Airtable base configured. Please add AIRTABLE_BASE_ID.");
      return airtable.createRecord(
        apiKey,
        baseId,
        input.table_name as string,
        input.fields as Record<string, unknown>
      );
    }

    case "airtable_list_records": {
      const apiKey = config.airtableApiKey;
      const baseId = (input.base_id as string | undefined) ?? config.airtableBaseId;
      if (!apiKey) throw new Error("Airtable is not connected. Please add AIRTABLE_API_KEY.");
      if (!baseId) throw new Error("No Airtable base configured. Please add AIRTABLE_BASE_ID.");
      return airtable.listRecords(
        apiKey,
        baseId,
        input.table_name as string,
        (input.max_records as number | undefined) ?? 10
      );
    }

    case "sheets_read_rows": {
      const email = config.googleSheetsClientEmail;
      const key = config.googleSheetsPrivateKey;
      if (!email || !key) throw new Error("Google Sheets is not connected. Please add your service account credentials in Settings.");
      return sheets.readRows(email, key, input.spreadsheet_id as string, input.range as string);
    }

    case "sheets_append_row": {
      const email = config.googleSheetsClientEmail;
      const key = config.googleSheetsPrivateKey;
      if (!email || !key) throw new Error("Google Sheets is not connected. Please add your service account credentials in Settings.");
      return sheets.appendRow(email, key, input.spreadsheet_id as string, input.range as string, input.values as string[]);
    }

    case "sheets_find_rows": {
      const email = config.googleSheetsClientEmail;
      const key = config.googleSheetsPrivateKey;
      if (!email || !key) throw new Error("Google Sheets is not connected. Please add your service account credentials in Settings.");
      return sheets.findRows(email, key, input.spreadsheet_id as string, input.range as string, input.search_value as string);
    }

    case "calendar_list_events": {
      const { gmailClientId: cid, gmailClientSecret: csec, gmailRefreshToken: rtok } = config;
      if (!cid || !csec || !rtok) throw new Error("Google Calendar is not connected. Add Gmail OAuth credentials in Settings (Calendar uses the same credentials).");
      return calendar.listEvents(cid, csec, rtok, (input.max_results as number | undefined) ?? 10, (input.calendar_id as string | undefined) ?? "primary", input.time_min as string | undefined);
    }

    case "calendar_create_event": {
      const { gmailClientId: cid, gmailClientSecret: csec, gmailRefreshToken: rtok } = config;
      if (!cid || !csec || !rtok) throw new Error("Google Calendar is not connected. Add Gmail OAuth credentials in Settings.");
      return calendar.createEvent(cid, csec, rtok, input.summary as string, input.start_datetime as string, input.end_datetime as string, input.description as string | undefined, input.attendee_emails as string | undefined, (input.calendar_id as string | undefined) ?? "primary");
    }

    case "gmail_send_email": {
      const { gmailClientId: cid, gmailClientSecret: csec, gmailRefreshToken: rtok } = config;
      if (!cid || !csec || !rtok) throw new Error("Gmail is not connected. Please add your OAuth2 credentials in Settings.");
      return gmail.sendEmail(cid, csec, rtok, input.to as string, input.subject as string, input.body as string, input.from as string | undefined);
    }

    case "gmail_search_emails": {
      const { gmailClientId: cid, gmailClientSecret: csec, gmailRefreshToken: rtok } = config;
      if (!cid || !csec || !rtok) throw new Error("Gmail is not connected. Please add your OAuth2 credentials in Settings.");
      return gmail.searchEmails(cid, csec, rtok, input.query as string, (input.max_results as number | undefined) ?? 10);
    }

    case "gmail_read_email": {
      const { gmailClientId: cid, gmailClientSecret: csec, gmailRefreshToken: rtok } = config;
      if (!cid || !csec || !rtok) throw new Error("Gmail is not connected. Please add your OAuth2 credentials in Settings.");
      return gmail.readEmail(cid, csec, rtok, input.message_id as string);
    }

    // ── Twilio ──────────────────────────────────────────────────────────────
    case "twilio_send_sms": {
      const { twilioAccountSid: sid, twilioAuthToken: tok, twilioFromNumber: fromNum } = config;
      if (!sid || !tok) throw new Error("Twilio is not connected. Please add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
      const from = (input.from as string | undefined) ?? fromNum;
      if (!from) throw new Error("No Twilio from-number configured. Add TWILIO_FROM_NUMBER in Settings.");
      return twilio.sendSms(sid, tok, from, input.to as string, input.body as string);
    }

    case "twilio_send_whatsapp": {
      const { twilioAccountSid: sid, twilioAuthToken: tok, twilioFromNumber: fromNum } = config;
      if (!sid || !tok) throw new Error("Twilio is not connected. Please add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
      const from = (input.from as string | undefined) ?? fromNum;
      if (!from) throw new Error("No Twilio from-number configured. Add TWILIO_FROM_NUMBER in Settings.");
      return twilio.sendWhatsApp(sid, tok, from, input.to as string, input.body as string);
    }

    // ── GitHub ──────────────────────────────────────────────────────────────
    case "github_create_issue": {
      const token = config.githubToken;
      if (!token) throw new Error("GitHub is not connected. Please add GITHUB_TOKEN in Settings.");
      return github.createIssue(token, input.owner as string, input.repo as string, input.title as string, input.body as string | undefined, input.labels as string[] | undefined);
    }

    case "github_list_issues": {
      const token = config.githubToken;
      if (!token) throw new Error("GitHub is not connected. Please add GITHUB_TOKEN in Settings.");
      return github.listIssues(token, input.owner as string, input.repo as string, (input.state as "open" | "closed" | "all" | undefined) ?? "open", (input.limit as number | undefined) ?? 10);
    }

    case "github_list_repos": {
      const token = config.githubToken;
      if (!token) throw new Error("GitHub is not connected. Please add GITHUB_TOKEN in Settings.");
      return github.listRepos(token, (input.limit as number | undefined) ?? 10);
    }

    // ── Linear ──────────────────────────────────────────────────────────────
    case "linear_create_issue": {
      const apiKey = config.linearApiKey;
      if (!apiKey) throw new Error("Linear is not connected. Please add LINEAR_API_KEY in Settings.");
      return linear.createIssue(apiKey, input.title as string, input.description as string | undefined, input.team_id as string | undefined, input.priority as number | undefined);
    }

    case "linear_list_issues": {
      const apiKey = config.linearApiKey;
      if (!apiKey) throw new Error("Linear is not connected. Please add LINEAR_API_KEY in Settings.");
      return linear.listIssues(apiKey, (input.limit as number | undefined) ?? 10, input.team_id as string | undefined);
    }

    // ── Discord ─────────────────────────────────────────────────────────────
    case "discord_send_message": {
      const webhookUrl = (input.webhook_url as string | undefined) ?? config.discordWebhookUrl;
      if (!webhookUrl) throw new Error("Discord is not connected. Please add DISCORD_WEBHOOK_URL in Settings.");
      return discord.sendMessage(webhookUrl, input.content as string, input.username as string | undefined, input.embed_title as string | undefined, input.embed_description as string | undefined);
    }

    // ── Mailchimp ───────────────────────────────────────────────────────────
    case "mailchimp_add_contact": {
      const apiKey = config.mailchimpApiKey;
      const listId = (input.list_id as string | undefined) ?? config.mailchimpListId;
      if (!apiKey) throw new Error("Mailchimp is not connected. Please add MAILCHIMP_API_KEY in Settings.");
      if (!listId) throw new Error("No Mailchimp list configured. Add MAILCHIMP_LIST_ID in Settings.");
      return mailchimp.addContact(apiKey, listId, input.email as string, input.first_name as string | undefined, input.last_name as string | undefined, input.tags as string[] | undefined);
    }

    case "mailchimp_list_contacts": {
      const apiKey = config.mailchimpApiKey;
      const listId = (input.list_id as string | undefined) ?? config.mailchimpListId;
      if (!apiKey) throw new Error("Mailchimp is not connected. Please add MAILCHIMP_API_KEY in Settings.");
      if (!listId) throw new Error("No Mailchimp list configured. Add MAILCHIMP_LIST_ID in Settings.");
      return mailchimp.listContacts(apiKey, listId, (input.limit as number | undefined) ?? 10);
    }

    case "mailchimp_list_audiences": {
      const apiKey = config.mailchimpApiKey;
      if (!apiKey) throw new Error("Mailchimp is not connected. Please add MAILCHIMP_API_KEY in Settings.");
      return mailchimp.listAudiences(apiKey);
    }

    case "execute_workflow": {
      const name = input.name as string;
      const workflows = context?.savedWorkflows ?? [];
      const found = workflows.find(
        (w) => w.blueprint.name.toLowerCase() === name.toLowerCase()
      );
      if (!found) {
        const names = workflows.map((w) => `"${w.blueprint.name}"`).join(", ");
        return `No workflow named "${name}" found. Available: ${names || "none"}.`;
      }
      const bp = found.blueprint;
      const rounds = buildExecutionPlan(bp.steps as DagStep[]);
      return formatExecutionPlan(bp.name, bp.trigger, rounds);
    }

    case "list_workflows": {
      const workflows = context?.savedWorkflows ?? [];
      if (workflows.length === 0) {
        return "No workflows saved yet. Use build_workflow to create one.";
      }
      const lines = workflows.map(
        (w, i) =>
          `${i + 1}. "${w.blueprint.name}" — Trigger: ${w.blueprint.trigger} — ${w.blueprint.steps.length} step${w.blueprint.steps.length !== 1 ? "s" : ""}`
      );
      return `${workflows.length} workflow${workflows.length !== 1 ? "s" : ""} saved:\n${lines.join("\n")}`;
    }

    case "get_workflow": {
      const name = input.name as string;
      const workflows = context?.savedWorkflows ?? [];
      const found = workflows.find(
        (w) => w.blueprint.name.toLowerCase() === name.toLowerCase()
      );
      if (!found) {
        const names = workflows.map((w) => `"${w.blueprint.name}"`).join(", ");
        return `No workflow named "${name}" found. Available workflows: ${names || "none"}.`;
      }
      const bp = found.blueprint;
      const steps = bp.steps
        .map((s) => `  ${s.step}. [${s.tool}] ${s.action} → ${s.output}`)
        .join("\n");
      return `Workflow: "${bp.name}"\nTrigger: ${bp.trigger}\nSteps:\n${steps}\nExpected outcome: ${bp.expected_outcome}\n\nTo modify this workflow, call update_workflow with the full updated blueprint.\nBlueprint JSON: ${JSON.stringify(bp)}`;
    }

    case "update_workflow": {
      const { change_summary, ...blueprintRaw } = input as {
        name: string;
        trigger: string;
        steps: Array<{ step: number; action: string; tool: string; output: string }>;
        expected_outcome: string;
        change_summary?: string;
      };
      const steps = blueprintRaw.steps
        .map((s) => `  ${s.step}. [${s.tool}] ${s.action}`)
        .join("\n");
      const changeNote = change_summary ? `Changes: ${change_summary}\n` : "";
      return `Workflow "${blueprintRaw.name}" updated and saved.\n${changeNote}Steps:\n${steps}\n__WORKFLOW_JSON__:${JSON.stringify(blueprintRaw)}`;
    }

    case "get_run_history": {
      const limit = Math.min((input.limit as number | undefined) ?? 5, 20);
      const filter = input.filter as string | undefined;
      const runs = context?.runHistory ?? [];
      const filtered = filter
        ? runs.filter((r) =>
            r.userMessage.toLowerCase().includes(filter.toLowerCase())
          )
        : runs;
      const recent = filtered.slice(0, limit);
      if (recent.length === 0) {
        return filter
          ? `No runs found matching "${filter}".`
          : "No run history available yet.";
      }
      const lines = recent.map((r, i) => {
        const status = r.status === "completed" ? "OK" : "FAILED";
        const tools = r.toolCalls.map((tc) => tc.toolName).join(", ");
        const errors = r.toolCalls
          .filter((tc) => tc.status === "error")
          .map((tc) => `    - ${tc.toolName}: ${tc.error}`)
          .join("\n");
        const date = new Date(r.startedAt).toLocaleString();
        return `${i + 1}. [${status}] "${r.userMessage.slice(0, 70)}${r.userMessage.length > 70 ? "…" : ""}"\n   ${date} | Tools used: ${tools || "none"}${errors ? `\n   Errors:\n${errors}` : ""}`;
      });
      return `Last ${recent.length} run${recent.length !== 1 ? "s" : ""}:\n\n${lines.join("\n\n")}`;
    }

    default: {
      // Check user-defined custom tools (prefixed or exact name match)
      const customTool = context?.customTools?.find(
        (ct) => ct.name === toolName || `custom_${ct.name}` === toolName
      );
      if (customTool) {
        return executeCustomTool(customTool, input);
      }
      throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
