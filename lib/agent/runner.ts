import Anthropic from "@anthropic-ai/sdk";
import { getActiveTools } from "./tools";
import { executeTool, RunContext } from "./executor";
import { AgentRun, AgentStreamEvent, BusinessProfile, IntegrationConfig, MemoryEntry } from "@/lib/types";
import { INTEGRATION_META } from "@/lib/integrations/meta";
import type { SavedWorkflow } from "@/lib/db/workflows";
import type { CustomTool } from "@/lib/db/customTools";

function buildBusinessContext(profile: BusinessProfile): string {
  const toolLines = Object.entries(profile.tools)
    .map(([k, v]) => `    ${k}: ${v}`)
    .join("\n");
  const workflowLines = profile.commonWorkflows.map((w) => `    - ${w}`).join("\n");
  const refLines = profile.defaultReferences
    ? Object.entries(profile.defaultReferences).map(([k, v]) => `    ${k}: ${v}`).join("\n")
    : "";

  return `
BUSINESS CONTEXT (always use this to inform your responses and tool calls):
  Company: ${profile.companyName}
  About: ${profile.description}
  Tools in use:
${toolLines}
  Common workflows:
${workflowLines}${refLines ? `\n  Default references:\n${refLines}` : ""}${profile.notes ? `\n  Notes: ${profile.notes}` : ""}
`;
}

function formatMemorySection(memories: MemoryEntry[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => {
    const prefix = m.type === "pattern" ? "[past failure]" : "[learned]";
    const val = typeof m.value === "object" && m.value !== null
      ? (() => {
          const v = m.value as Record<string, unknown>;
          if (m.type === "pattern") {
            return `${v.failure} (tool: ${v.tool ?? "unknown"}) → ${v.solution}`;
          }
          if (v.goal && Array.isArray(v.tools)) {
            return `${v.goal} — worked with: ${(v.tools as string[]).join(", ")}`;
          }
          return JSON.stringify(v).slice(0, 120);
        })()
      : String(m.value).slice(0, 120);
    return `  ${prefix} ${val}`;
  });
  return `\nMEMORY (apply this context — don't ask for information you already know):\n${lines.join("\n")}\n`;
}

function formatRecentRuns(runHistory: AgentRun[]): string {
  if (runHistory.length === 0) return "";
  const lines = runHistory.slice(0, 5).map((r, i) => {
    const tools = Array.from(new Set(r.toolCalls.map((tc) => tc.toolName)));
    const toolPart = tools.length > 0 ? ` (used: ${tools.join(", ")})` : "";
    return `  ${i + 1}. "${r.userMessage}" — ${r.status}${toolPart}`;
  });
  return `\nRECENT RUNS (use this to understand repeat or follow-up requests like "do it again" or "run that again"):\n${lines.join("\n")}\n`;
}

function buildSystemPrompt(config: IntegrationConfig, profile?: BusinessProfile | null, customTools: CustomTool[] = [], memoryContext?: MemoryEntry[], runHistory?: AgentRun[]): string {
  const connected = INTEGRATION_META.filter((m) => m.isConnected(config));
  const disconnected = INTEGRATION_META.filter((m) => !m.isConnected(config));

  const connectedSection =
    connected.length > 0
      ? connected.map((m) => `  - ${m.name}`).join("\n")
      : "  None";

  const disconnectedSection =
    disconnected.length > 0
      ? disconnected.map((m) => `  - ${m.name}`).join("\n")
      : "  None";

  const businessContext = profile ? buildBusinessContext(profile) : "";
  const memorySection = memoryContext ? formatMemorySection(memoryContext) : "";
  const recentRunsSection = runHistory ? formatRecentRuns(runHistory) : "";

  return `You are Operant AI — an intelligent operations agent built for automation and operations professionals.
${businessContext}${memorySection}${recentRunsSection}
CONNECTED INTEGRATIONS (you may use these tools):
${connectedSection}

NOT CONNECTED (never call tools for these — direct the user to add credentials in the Settings panel):
${disconnectedSection}

Available tools:
- notion_search_pages — find accessible Notion pages; always call this first to get a parent_page_id before calling notion_create_database
- notion_create_database — create a new Notion database with defined columns (always call notion_search_pages first to get the parent_page_id)
- notion_create_page / notion_query_database — Notion databases
- send_email — email via Resend
- slack_send_message — Slack notifications
- stripe_list_customers / stripe_list_charges — Stripe payments
- hubspot_create_contact / hubspot_search_contacts — HubSpot CRM
- airtable_create_record / airtable_list_records — Airtable
- sheets_read_rows / sheets_append_row / sheets_find_rows — Google Sheets
- gmail_send_email / gmail_search_emails / gmail_read_email — Gmail
- calendar_list_events / calendar_create_event — Google Calendar (uses Gmail credentials)
- build_workflow — always available: design a new multi-step automation blueprint with optional parallel steps
- execute_workflow — always available: run a named workflow using dependency-aware parallel execution
- list_workflows — always available: list all saved workflows in the library
- get_workflow — always available: read a saved workflow's full blueprint by name
- update_workflow — always available: modify and save changes to an existing workflow
- get_run_history — always available: view recent run results to debug failures

BEHAVIOR RULES:
1. ONLY call tools for CONNECTED integrations listed above. The tool list you receive is already filtered to your connected integrations — stay within it.
2. If a task needs a disconnected integration, name it and say: "Connect [Integration] in the Settings panel (top-right) to enable this."
3. Use the BUSINESS CONTEXT above to make smart defaults — use the right spreadsheet IDs, Slack channels, databases, etc. without asking every time.
4. TRIGGER-BASED REQUESTS — CRITICAL: If the user's message describes a future event using words like "when", "whenever", "every time", "if someone", "once a", "after a", or any similar trigger phrase (e.g. "when someone submits a form", "whenever a payment comes in", "every time a lead signs up") — this is ALWAYS a workflow design request. Call build_workflow only. Do NOT call any integration tools (notion_create_page, send_email, etc.) with live data. Just design the blueprint.
5. When asked to BUILD or DESIGN a workflow (not execute it), use build_workflow — this always works regardless of what is connected.
6. When creating a record in Notion, call notion_create_page directly. Do NOT call notion_query_database first to inspect the schema — just create the record with the fields you know.
7. After any tool use, always end your response with a clear Run Report section (see RESPONSE STYLE below).
8. For multi-step tasks, execute all steps in sequence unless an error occurs.
9. Be direct and professional. This is a tool for experts.
10. When a user asks to run a named workflow, call execute_workflow — it loads the blueprint, builds the dependency graph, and tells you exactly which tools to call and which can run in parallel. Follow its execution plan precisely.
11. When asked to modify, fix, or improve a workflow, call get_workflow to read the current blueprint, apply the requested changes, then call update_workflow to save the updated version.
12. When a workflow keeps failing or a user asks why something broke, call get_run_history to identify the pattern, then diagnose and fix it.
13. When building or updating workflows with independent steps (e.g. send email AND create Notion record, neither depends on the other), set dependencies: [] on those steps so execute_workflow can run them in parallel.

RESPONSE STYLE — follow these strictly:
- Write in plain prose. Do not use markdown formatting: no asterisks, no bold, no italics, no bullet point symbols, no hyphens as list markers, no headers with #.
- Do not use emojis of any kind.
- Do not use tables. Present data as simple numbered lists or plain sentences.
- Do not add motivational closings, offers to help further, or rhetorical questions at the end.

RUN REPORT — always include this section after any tool use, in this exact plain-text format:

Run Report
----------
What ran: [list each tool called and what it did in one sentence each]
What succeeded: [list each successful step and the key result or output]
What failed: [list each failed step, the exact error, and one concrete suggestion to fix it — or write "Nothing failed" if all steps succeeded]

You are not a general-purpose chatbot. Stay focused on automations, operations, and workflows.${
    customTools.length > 0
      ? `\n\nCUSTOM TOOLS (user-defined HTTP integrations — available for use):\n${customTools.filter((ct) => ct.enabled).map((ct) => `- ${ct.name}: ${ct.description}`).join("\n")}`
      : ""
  }`;
}

export interface RunnerOptions {
  message: string;
  conversationHistory: Anthropic.MessageParam[];
  runId: string;
  emit: (event: AgentStreamEvent) => void;
  config: IntegrationConfig;
  businessProfile?: BusinessProfile | null;
  savedWorkflows?: SavedWorkflow[];
  runHistory?: AgentRun[];
  customTools?: CustomTool[];
  memoryContext?: MemoryEntry[];
}

function buildCustomToolDefs(customTools: CustomTool[]): Anthropic.Tool[] {
  return customTools
    .filter((ct) => ct.enabled)
    .map((ct) => ({
      name: ct.name,
      description: ct.description,
      input_schema: {
        type: "object" as const,
        properties: Object.fromEntries(
          ct.params.map((p) => [
            p.name,
            { type: p.type, description: p.description },
          ])
        ),
        required: ct.params.filter((p) => p.required).map((p) => p.name),
      },
    }));
}

export async function runAgent(options: RunnerOptions): Promise<string> {
  const { message, conversationHistory, runId, emit, config, businessProfile, savedWorkflows, runHistory, customTools = [], memoryContext } = options;
  const runContext: RunContext = { savedWorkflows, runHistory, customTools };

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory,
    { role: "user", content: message },
  ];

  let finalMessage = "";
  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const customToolDefs = buildCustomToolDefs(customTools);
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: buildSystemPrompt(config, businessProfile, customTools, memoryContext, runHistory),
      tools: [...getActiveTools(config), ...customToolDefs],
      messages,
    });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      finalMessage = textBlock?.type === "text" ? textBlock.text : "";
      emit({ type: "text_delta", runId, text: finalMessage });
      break;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

      // Append assistant turn
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue;

        const startedAt = Date.now();
        emit({
          type: "tool_call_start",
          runId,
          toolCallId: block.id,
          toolName: block.name,
          input: block.input as Record<string, unknown>,
        });

        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          config,
          runContext
        );

        const durationMs = Date.now() - startedAt;

        if (result.isError) {
          emit({ type: "tool_call_error", runId, toolCallId: block.id, error: result.output, durationMs });
        } else {
          emit({ type: "tool_call_complete", runId, toolCallId: block.id, output: result.output, durationMs });
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.output,
          is_error: result.isError,
        });
      }

      // Append tool results as user turn
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason
    break;
  }

  return finalMessage;
}
