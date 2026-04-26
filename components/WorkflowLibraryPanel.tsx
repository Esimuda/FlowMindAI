"use client";

import { useEffect, useState } from "react";
import { SavedWorkflow, listWorkflows, deleteWorkflow, saveWorkflow } from "@/lib/db/workflows";
import { WorkflowBlueprint } from "@/lib/export/n8n";
import { toN8nJson, toMakeJson } from "@/lib/export/n8n";
import { toZapierJson } from "@/lib/export/zapier";
import {
  ScheduleFrequency,
  ScheduledWorkflow,
  createSchedule,
  deleteSchedule,
  toggleSchedule,
  getScheduleForWorkflow,
  freqLabel,
  nextRunLabel,
  hourLabel,
} from "@/lib/db/schedules";

const TEMPLATES: WorkflowBlueprint[] = [
  {
    name: "New Stripe Customer → Notion + Welcome Email",
    trigger: "New Stripe customer created",
    steps: [
      { step: 1, tool: "stripe", action: "Fetch the latest new Stripe customer", output: "customer_data" },
      { step: 2, tool: "notion", action: "Create a CRM entry in Notion with the customer details", output: "notion_page" },
      { step: 3, tool: "resend", action: "Send a personalised welcome email to the new customer", output: "email_sent" },
    ],
    expected_outcome: "New customer is logged in Notion CRM and receives a welcome email automatically.",
  },
  {
    name: "Weekly Stripe Revenue → Slack Digest",
    trigger: "Every Monday morning (scheduled)",
    steps: [
      { step: 1, tool: "stripe", action: "Fetch all charges from the past 7 days and calculate totals", output: "charges_summary" },
      { step: 2, tool: "slack", action: "Post a revenue summary with total, count, and top transactions to #revenue", output: "slack_message" },
    ],
    expected_outcome: "Team receives a Slack digest of weekly revenue every Monday.",
  },
  {
    name: "HubSpot Lead → Notion CRM + Slack Alert",
    trigger: "New HubSpot contact created",
    steps: [
      { step: 1, tool: "hubspot", action: "Fetch the latest contact from HubSpot", output: "contact_data" },
      { step: 2, tool: "notion", action: "Add the contact as a new row in the Notion CRM database", output: "notion_entry" },
      { step: 3, tool: "slack", action: "Notify the sales team in Slack with the new lead details", output: "slack_alert" },
    ],
    expected_outcome: "Every new HubSpot lead is logged in Notion and the sales team is alerted on Slack.",
  },
  {
    name: "Daily Airtable Report → Email",
    trigger: "Every day at 9am (scheduled)",
    steps: [
      { step: 1, tool: "airtable", action: "Pull all records updated in the last 24 hours from Airtable", output: "records" },
      { step: 2, tool: "resend", action: "Format and email a daily summary report to the operations team", output: "report_sent" },
    ],
    expected_outcome: "Operations team receives a daily email summary of Airtable activity.",
  },
  {
    name: "GitHub Issue → Linear Ticket + Slack",
    trigger: "New GitHub issue opened",
    steps: [
      { step: 1, tool: "github", action: "Fetch the latest open issue from GitHub", output: "issue_data" },
      { step: 2, tool: "linear", action: "Create a corresponding ticket in Linear with the same title and description", output: "linear_ticket" },
      { step: 3, tool: "slack", action: "Post a notification in #engineering with links to both the GitHub issue and Linear ticket", output: "slack_notification" },
    ],
    expected_outcome: "Every GitHub issue is mirrored in Linear and the engineering team is notified.",
  },
  {
    name: "Google Sheets KPIs → Slack Weekly Summary",
    trigger: "Every Friday at 5pm (scheduled)",
    steps: [
      { step: 1, tool: "sheets", action: "Read KPI data from the weekly metrics Google Sheet", output: "kpi_data" },
      { step: 2, tool: "slack", action: "Post a formatted end-of-week KPI summary to #general", output: "slack_post" },
    ],
    expected_outcome: "Team receives a weekly KPI summary in Slack sourced directly from Google Sheets.",
  },
];

function TemplateCard({ blueprint, onLoad }: { blueprint: WorkflowBlueprint; onLoad: () => void }) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleLoad = async () => {
    setLoading(true);
    try {
      await saveWorkflow(blueprint);
      setLoaded(true);
      onLoad();
    } catch {
      // silently fail — user may not be authed
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl mb-2 overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug mb-0.5" style={{ color: "var(--foreground)" }}>
            {blueprint.name}
          </p>
          <p className="text-[10px] truncate mb-1" style={{ color: "var(--foreground-3)" }}>
            ⚡ {blueprint.trigger}
          </p>
          <div className="flex gap-1 flex-wrap">
            {blueprint.steps.map((s) => (
              <span
                key={s.step}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.12)" }}
              >
                {s.tool}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={handleLoad}
          disabled={loading || loaded}
          className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all"
          style={
            loaded
              ? { background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }
              : { background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }
          }
          onMouseEnter={(e) => { if (!loaded) e.currentTarget.style.background = "rgba(218,119,86,0.2)"; }}
          onMouseLeave={(e) => { if (!loaded) e.currentTarget.style.background = "var(--accent-glow)"; }}
        >
          {loading ? "..." : loaded ? "✓ Added" : "Load"}
        </button>
      </div>
    </div>
  );
}

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function WorkflowCard({
  saved,
  onDelete,
  onScheduleChange,
}: {
  saved: SavedWorkflow;
  onDelete: () => void;
  onScheduleChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedStep, setSchedStep] = useState<"freq" | "time">("freq");
  const [pendingFreq, setPendingFreq] = useState<ScheduleFrequency>("daily");
  const [schedHour, setSchedHour] = useState(9);
  const [showWebhook, setShowWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [runContext, setRunContext] = useState("");
  const [schedule, setSchedule] = useState<ScheduledWorkflow | undefined>(undefined);

  useEffect(() => {
    getScheduleForWorkflow(saved.id).then(setSchedule);
  }, [saved.id]);
  const { blueprint } = saved;
  const safeName = blueprint.name.replace(/\s+/g, "-").toLowerCase();

  const handleGetWebhook = async () => {
    setWebhookLoading(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowName: blueprint.name }),
      });
      const { webhook } = await res.json();
      if (webhook?.id) {
        setWebhookUrl(`${window.location.origin}/api/webhooks/${webhook.id}`);
        setShowWebhook(true);
        setExpanded(true);
      }
    } finally {
      setWebhookLoading(false);
    }
  };

  const copyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const refreshSchedule = () => getScheduleForWorkflow(saved.id).then(setSchedule);

  const handleSchedule = async (freq: ScheduleFrequency, runHour?: number) => {
    await createSchedule(saved.id, blueprint, freq, runHour);
    refreshSchedule();
    onScheduleChange();
    setShowSchedule(false);
    setSchedStep("freq");
  };

  const handleToggleSchedule = () => {
    if (schedule) { toggleSchedule(schedule.id).then(() => refreshSchedule()); onScheduleChange(); }
  };

  const handleDeleteSchedule = () => {
    if (schedule) { deleteSchedule(schedule.id).then(() => refreshSchedule()); onScheduleChange(); }
  };

  const handleRun = () => {
    const steps = blueprint.steps
      .map((s) => `  ${s.step}. [${s.tool}] ${s.action} → ${s.output}`)
      .join("\n");
    const prompt = [
      `Execute this workflow now using your tools — actually call each tool, do not just describe it.`,
      ``,
      `WORKFLOW: "${blueprint.name}"`,
      `TRIGGER: ${blueprint.trigger}`,
      runContext.trim() ? `CONTEXT: ${runContext.trim()}` : "",
      ``,
      `STEPS:`,
      steps,
      ``,
      `Execute each step in order. Summarise results when done.`,
    ].filter((l) => l !== undefined).join("\n");

    window.dispatchEvent(new CustomEvent("operant-run-workflow", { detail: { prompt } }));
    setShowRun(false);
    setRunContext("");
  };

  return (
    <div
      className="rounded-xl mb-3 overflow-hidden transition-all"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Card header */}
      <div
        className="flex items-start justify-between gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>
              {blueprint.name}
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }}
            >
              {blueprint.steps.length} step{blueprint.steps.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-[11px] truncate mb-1" style={{ color: "var(--foreground-3)" }}>
            ⚡ {blueprint.trigger}
          </p>
          <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>
            {relativeTime(saved.savedAt)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Schedule indicator */}
          {schedule && (
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleSchedule(); }}
              title={schedule.enabled ? `${freqLabel(schedule.frequency, schedule.runHour)} · next ${nextRunLabel(schedule.nextRunAt)}` : "Paused"}
              className="text-[10px] px-2 py-0.5 rounded-full transition-all"
              style={
                schedule.enabled
                  ? { background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }
                  : { background: "rgba(71,85,105,0.1)", color: "var(--foreground-3)", border: "1px solid var(--border)" }
              }
            >
              {schedule.enabled ? "⏰" : "⏸"}
            </button>
          )}
          {/* Webhook button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleGetWebhook(); }}
            disabled={webhookLoading}
            title="Get webhook URL"
            className="text-[10px] px-2 py-1 rounded-lg transition-all"
            style={{ color: "var(--foreground-3)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "rgba(218,119,86,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            {webhookLoading ? "..." : "⚡ Webhook"}
          </button>
          {/* Run button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowRun((v) => !v); setShowSchedule(false); setExpanded(true); }}
            className="text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all"
            style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.1)")}
          >
            ▶ Run
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-[10px] px-2 py-1 rounded-lg transition-all"
            style={{ color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            ✕
          </button>
          <span style={{ color: "var(--foreground-muted)", fontSize: 10 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Run context input */}
      {showRun && (
        <div className="px-4 pb-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-[10px] uppercase tracking-widest mt-3 mb-2" style={{ color: "var(--foreground-muted)" }}>
            Run context (optional)
          </p>
          <input
            type="text"
            value={runContext}
            onChange={(e) => setRunContext(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRun()}
            placeholder="e.g. customer: John Smith, john@co.com"
            autoFocus
            className="w-full text-xs rounded-lg px-3 py-2 outline-none mb-2"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground-2)", caretColor: "var(--accent)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(218,119,86,0.4)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
          <div className="flex gap-2">
            <button
              onClick={handleRun}
              className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff" }}
            >
              Execute Workflow
            </button>
            <button
              onClick={() => setShowRun(false)}
              className="px-3 py-2 rounded-lg text-[11px] transition-all"
              style={{ color: "var(--foreground-3)", border: "1px solid var(--border)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {/* Steps */}
          <div className="mt-3 space-y-2">
            {blueprint.steps.map((s) => (
              <div key={s.step} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                  style={{ background: "var(--accent-glow)", color: "var(--accent)" }}
                >
                  {s.step}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] leading-snug" style={{ color: "var(--foreground-2)" }}>{s.action}</p>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded mt-0.5 inline-block"
                    style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.15)" }}
                  >
                    {s.tool}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Outcome */}
          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
            {blueprint.expected_outcome}
          </p>

          {/* Webhook URL */}
          {showWebhook && webhookUrl && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--foreground-muted)" }}>
                Webhook URL — POST to trigger this workflow
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={webhookUrl}
                  className="flex-1 text-[10px] rounded-lg px-2 py-1.5 outline-none font-mono"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground-3)" }}
                />
                <button
                  onClick={copyWebhook}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-all"
                  style={webhookCopied
                    ? { background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }
                    : { background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }
                  }
                >
                  {webhookCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {/* Schedule section */}
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {schedule ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold" style={{ color: schedule.enabled ? "var(--accent)" : "var(--foreground-3)" }}>
                    {schedule.enabled ? `⏰ ${freqLabel(schedule.frequency, schedule.runHour)}` : `⏸ Paused (${freqLabel(schedule.frequency, schedule.runHour)})`}
                  </span>
                  {schedule.enabled && (
                    <span className="text-[10px] ml-2" style={{ color: "var(--foreground-muted)" }}>
                      next {nextRunLabel(schedule.nextRunAt)}
                    </span>
                  )}
                  {schedule.lastRunAt && (
                    <span className="text-[10px] ml-2" style={{ color: "var(--foreground-muted)" }}>
                      · last ran {Math.round((Date.now() - schedule.lastRunAt) / 60000)}m ago
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleToggleSchedule}
                    className="text-[10px] px-2 py-0.5 rounded-lg transition-all"
                    style={{ color: "var(--foreground-3)", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-3)")}
                  >
                    {schedule.enabled ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={handleDeleteSchedule}
                    className="text-[10px] px-2 py-0.5 rounded-lg transition-all"
                    style={{ color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {!showSchedule ? (
                  <button
                    onClick={() => { setShowSchedule(true); setSchedStep("freq"); }}
                    className="text-[10px] flex items-center gap-1.5 transition-all"
                    style={{ color: "var(--foreground-muted)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-muted)")}
                  >
                    <span>⏰</span> Schedule this workflow
                  </button>
                ) : schedStep === "freq" ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--foreground-muted)" }}>
                      Run automatically
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {(["hourly", "daily", "weekly"] as ScheduleFrequency[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setPendingFreq(f);
                            if (f === "hourly") { handleSchedule(f); } else { setSchedStep("time"); }
                          }}
                          className="text-[11px] px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(218,119,86,0.16)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-glow)")}
                        >
                          {freqLabel(f)}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowSchedule(false)}
                        className="text-[11px] px-2 py-1.5 rounded-lg"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--foreground-muted)" }}>
                      {pendingFreq === "daily" ? "Daily at" : "Weekly at"}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={schedHour}
                        onChange={(e) => setSchedHour(Number(e.target.value))}
                        className="text-[11px] px-2 py-1.5 rounded-lg"
                        style={{ background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>{hourLabel(h)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSchedule(pendingFreq, schedHour)}
                        className="text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all"
                        style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(218,119,86,0.16)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-glow)")}
                      >
                        Set schedule
                      </button>
                      <button
                        onClick={() => setSchedStep("freq")}
                        className="text-[11px] px-2 py-1.5 rounded-lg"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="mt-3 pt-3 flex gap-2 flex-wrap" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {[
              { label: "Zapier", fn: () => downloadJson(`${safeName}-zapier.json`, toZapierJson(blueprint)) },
              { label: "n8n",    fn: () => downloadJson(`${safeName}-n8n.json`,    toN8nJson(blueprint)) },
              { label: "Make",   fn: () => downloadJson(`${safeName}-make.json`,   toMakeJson(blueprint)) },
              { label: "Raw",    fn: () => downloadJson(`${safeName}.json`,        JSON.stringify(blueprint, null, 2)) },
            ].map(({ label, fn }) => (
              <button
                key={label}
                onClick={fn}
                className="text-[11px] px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(218,119,86,0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-glow)")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowLibraryPanel() {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [search, setSearch] = useState("");
  const [, setScheduleTick] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);

  const refresh = async () => setWorkflows(await listWorkflows());
  const refreshSchedules = () => setScheduleTick((t) => t + 1);

  useEffect(() => {
    refresh();
    window.addEventListener("operant-workflow-saved", refresh);
    window.addEventListener("operant-schedules-changed", refreshSchedules);
    return () => {
      window.removeEventListener("operant-workflow-saved", refresh);
      window.removeEventListener("operant-schedules-changed", refreshSchedules);
    };
  }, []);

  const handleDelete = (id: string) => {
    deleteWorkflow(id);
    refresh();
  };

  const filtered = workflows.filter((w) =>
    w.blueprint.name.toLowerCase().includes(search.toLowerCase()) ||
    w.blueprint.trigger.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>
            Workflow Library
          </p>
          {workflows.length > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }}
            >
              {workflows.length}
            </span>
          )}
        </div>
        <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
          Workflows auto-saved when the agent builds them.
        </p>
      </div>

      {/* Search */}
      {workflows.length > 0 && (
        <div className="flex-shrink-0 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows..."
            className="w-full text-xs rounded-xl px-4 py-2.5 outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground-2)", caretColor: "var(--accent)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(218,119,86,0.4)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {workflows.length === 0 ? (
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "var(--foreground-muted)" }}>
              Starter Templates
            </p>
            {TEMPLATES.map((t) => (
              <TemplateCard key={t.name} blueprint={t} onLoad={refresh} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-center pt-8" style={{ color: "var(--foreground-muted)" }}>
            No workflows match &ldquo;{search}&rdquo;
          </p>
        ) : (
          <>
            {filtered.map((w) => (
              <WorkflowCard key={w.id} saved={w} onDelete={() => handleDelete(w.id)} onScheduleChange={refreshSchedules} />
            ))}
            <div className="mt-2 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button
                onClick={() => setShowTemplates((v) => !v)}
                className="text-[10px] uppercase tracking-widest flex items-center gap-1.5 mb-3 transition-all"
                style={{ color: "var(--foreground-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-muted)")}
              >
                {showTemplates ? "▲" : "▼"} Templates
              </button>
              {showTemplates && TEMPLATES.map((t) => (
                <TemplateCard key={t.name} blueprint={t} onLoad={refresh} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
