"use client";

import { useEffect, useRef, useState } from "react";
import { AgentRun, AgentStage, ExecutionObservation, ReflectionResult } from "@/lib/types";
import ToolCallCard from "./ToolCallCard";
import { toN8nJson, toMakeJson, WorkflowBlueprint } from "@/lib/export/n8n";
import { toZapierJson, toZapierMarkdown } from "@/lib/export/zapier";
import { saveWorkflow } from "@/lib/db/workflows";
import WorkflowVisualizer from "./WorkflowVisualizer";
import { createSchedule, freqLabel, hourLabel, ScheduleFrequency } from "@/lib/db/schedules";

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, content: string) {
  downloadFile(filename, content, "application/json");
}

function ExportButtons({ workflow }: { workflow: WorkflowBlueprint }) {
  const safeName = workflow.name.replace(/\s+/g, "-").toLowerCase();
  return (
    <div
      className="rounded-xl p-3 mt-2"
      style={{ background: "var(--accent-glow)", border: "1px solid rgba(218,119,86,0.2)" }}
    >
      <p className="text-[11px] font-semibold mb-2" style={{ color: "var(--accent)" }}>
        Export Workflow
      </p>
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Zapier Guide", fn: () => downloadFile(`${safeName}-zapier-guide.md`, toZapierMarkdown(workflow), "text/markdown") },
          { label: "Zapier JSON",  fn: () => downloadJson(`${safeName}-zapier.json`, toZapierJson(workflow)) },
          { label: "n8n JSON",     fn: () => downloadJson(`${safeName}-n8n.json`,    toN8nJson(workflow)) },
          { label: "Make JSON",    fn: () => downloadJson(`${safeName}-make.json`,   toMakeJson(workflow)) },
          { label: "Raw JSON",     fn: () => downloadJson(`${safeName}.json`,        JSON.stringify(workflow, null, 2)) },
        ].map(({ label, fn }) => (
          <button
            key={label}
            onClick={fn}
            className="text-[11px] px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "var(--accent-glow)", color: "var(--foreground-2)", border: "1px solid rgba(218,119,86,0.25)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-2)")}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function ScheduleSection({ workflow }: { workflow: WorkflowBlueprint }) {
  const [step, setStep] = useState<"idle" | "freq" | "time" | "saved">("idle");
  const [freq, setFreq] = useState<ScheduleFrequency>("daily");
  const [hour, setHour] = useState(9);
  const [saving, setSaving] = useState(false);

  async function save(f: ScheduleFrequency, h?: number) {
    setSaving(true);
    try {
      const workflowId = workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await createSchedule(workflowId, workflow, f, h);
      setStep("saved");
    } catch {
      setSaving(false);
    }
  }

  if (step === "saved") {
    return (
      <div
        className="rounded-xl px-3 py-2 mt-2 flex items-center gap-2"
        style={{ background: "var(--accent-glow)", border: "1px solid rgba(218,119,86,0.2)" }}
      >
        <span className="text-[11px]" style={{ color: "var(--accent)" }}>⏰</span>
        <span className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
          Scheduled — {freqLabel(freq, freq === "hourly" ? undefined : hour)}
        </span>
      </div>
    );
  }

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("freq")}
        className="mt-2 text-[11px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
        style={{ background: "var(--accent-glow)", color: "var(--foreground-3)", border: "1px solid rgba(218,119,86,0.15)" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "rgba(218,119,86,0.3)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-3)"; e.currentTarget.style.borderColor = "rgba(218,119,86,0.15)"; }}
      >
        ⏰ Schedule this workflow
      </button>
    );
  }

  if (step === "freq") {
    return (
      <div
        className="rounded-xl p-3 mt-2"
        style={{ background: "var(--accent-glow)", border: "1px solid rgba(218,119,86,0.18)" }}
      >
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--foreground-muted)" }}>Run automatically</p>
        <div className="flex gap-2 flex-wrap">
          {(["hourly", "daily", "weekly"] as ScheduleFrequency[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFreq(f);
                if (f === "hourly") { save(f); } else { setStep("time"); }
              }}
              className="text-[11px] px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "var(--surface)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
            >
              {freqLabel(f)}
            </button>
          ))}
          <button
            onClick={() => setStep("idle")}
            className="text-[11px] px-2 py-1.5 rounded-lg"
            style={{ color: "var(--foreground-3)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // step === "time"
  return (
    <div
      className="rounded-xl p-3 mt-2"
      style={{ background: "var(--accent-glow)", border: "1px solid rgba(218,119,86,0.18)" }}
    >
      <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--foreground-muted)" }}>
        {freq === "daily" ? "Daily at" : "Weekly at"}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          className="text-[11px] px-2 py-1.5 rounded-lg"
          style={{ background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)" }}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>{hourLabel(h)}</option>
          ))}
        </select>
        <button
          onClick={() => save(freq, hour)}
          disabled={saving}
          className="text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all"
          style={{ background: "var(--accent)", color: "#fff", border: "none" }}
        >
          {saving ? "Saving…" : "Set schedule"}
        </button>
        <button
          onClick={() => setStep("freq")}
          className="text-[11px] px-2 py-1.5 rounded-lg"
          style={{ color: "var(--foreground-3)" }}
        >
          Back
        </button>
      </div>
    </div>
  );
}

function extractWorkflowFromOutput(output: string): WorkflowBlueprint | null {
  const marker = "__WORKFLOW_JSON__:";
  const idx = output.indexOf(marker);
  if (idx === -1) return null;
  try {
    return JSON.parse(output.slice(idx + marker.length)) as WorkflowBlueprint;
  } catch {
    return null;
  }
}

function elapsed(startedAt: number, completedAt?: number): string {
  const ms = (completedAt ?? Date.now()) - startedAt;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusBadge({ status }: { status: AgentRun["status"] }) {
  if (status === "running") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
        style={{ background: "var(--accent-glow)", border: "1px solid rgba(218,119,86,0.3)", color: "var(--accent)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
        Running
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
        style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
        Complete
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ef4444" }} />
      Failed
    </span>
  );
}

const STAGE_LABELS: Record<AgentStage, string> = {
  interpreting:    "Interpreting intent",
  planning:        "Planning steps",
  selecting_tools: "Selecting tools",
  building:        "Building workflow",
  executing:       "Executing",
  observing:       "Observing results",
  reflecting:      "Reflecting",
  optimizing:      "Optimizing",
  complete:        "Complete",
};

function StageIndicator({ stage, description }: { stage: AgentStage; description: string }) {
  const stages: AgentStage[] = [
    "interpreting", "planning", "selecting_tools", "building",
    "executing", "observing", "reflecting", "optimizing",
  ];
  const idx = stages.indexOf(stage);

  return (
    <div
      className="rounded-xl p-3 mb-3"
      style={{ background: "var(--accent-glow)", border: "1px solid rgba(218,119,86,0.18)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
          style={{ background: "var(--accent)" }}
        />
        <span className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
          {STAGE_LABELS[stage]}
        </span>
        <span className="text-[10px] ml-1" style={{ color: "var(--foreground-3)" }}>
          {description}
        </span>
      </div>
      <div className="flex gap-1">
        {stages.map((s, i) => (
          <div
            key={s}
            className="flex-1 h-0.5 rounded-full transition-all duration-500"
            style={{
              background: i < idx
                ? "var(--accent)"
                : i === idx
                ? "rgba(218,119,86,0.6)"
                : "rgba(218,119,86,0.12)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ReflectionCard({ reflection }: { reflection: ReflectionResult }) {
  if (!reflection.hasIssues) return null;
  return (
    <div
      className="rounded-xl p-3 mt-2"
      style={{ background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.18)" }}
    >
      <p className="text-[11px] font-semibold mb-1.5" style={{ color: "#eab308" }}>
        Reflection — {reflection.summary}
      </p>
      {reflection.issues.slice(0, 3).map((issue, i) => (
        <div key={i} className="mb-1 last:mb-0">
          <p className="text-[10px]" style={{ color: "var(--foreground-2)" }}>
            <span style={{ color: "#fbbf24" }}>Issue:</span> {issue.issue}
          </p>
          <p className="text-[10px]" style={{ color: "var(--foreground-2)" }}>
            <span style={{ color: "#86efac" }}>Fix:</span> {issue.fix}
          </p>
        </div>
      ))}
      {reflection.shouldRetry && (
        <p className="text-[10px] mt-1.5 font-medium" style={{ color: "var(--accent)" }}>
          Self-healing retry queued
        </p>
      )}
    </div>
  );
}

function ObservationCard({ obs }: { obs: ExecutionObservation }) {
  const pct = Math.round(obs.successRate * 100);
  return (
    <div
      className="rounded-xl p-3 mt-2"
      style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}
    >
      <p className="text-[11px] font-semibold mb-1" style={{ color: "#22c55e" }}>
        Execution metrics
      </p>
      <div className="flex gap-4 flex-wrap">
        <span className="text-[10px]" style={{ color: "var(--foreground-2)" }}>
          Success rate: <span style={{ color: pct === 100 ? "#22c55e" : "#eab308" }}>{pct}%</span>
        </span>
        <span className="text-[10px]" style={{ color: "var(--foreground-2)" }}>
          Tools called: {obs.toolCallCount}
        </span>
        <span className="text-[10px]" style={{ color: "var(--foreground-2)" }}>
          Time: {obs.executionTimeMs < 1000 ? `${obs.executionTimeMs}ms` : `${(obs.executionTimeMs / 1000).toFixed(1)}s`}
        </span>
        {obs.totalRetries > 0 && (
          <span className="text-[10px]" style={{ color: "var(--foreground-2)" }}>
            Retries: {obs.totalRetries}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "var(--accent-glow)", border: "1px solid rgba(218,119,86,0.15)" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3v3M10 14v3M3 10h3M14 10h3M5.05 5.05l2.122 2.122M12.828 12.828l2.122 2.122M5.05 14.95l2.122-2.122M12.828 7.172l2.122-2.122" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground-2)" }}>
        Agent ready
      </p>
      <p className="text-xs max-w-[200px]" style={{ color: "var(--foreground-muted)" }}>
        Ask me to send emails, create Notion records, check Stripe, or build a workflow
      </p>
    </div>
  );
}

export default function AgentRunPanel({
  run,
  currentStage,
  reflection,
  observation,
}: {
  run: AgentRun | null;
  currentStage?: { stage: AgentStage; description: string } | null;
  reflection?: ReflectionResult | null;
  observation?: ExecutionObservation | null;
}) {
  const savedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!run) return;
    for (const tc of run.toolCalls) {
      const isWorkflowTool = tc.toolName === "build_workflow" || tc.toolName === "update_workflow";
      if (isWorkflowTool && tc.status === "success" && tc.output && !savedIds.current.has(tc.id)) {
        const workflow = extractWorkflowFromOutput(tc.output);
        if (workflow) {
          savedIds.current.add(tc.id);
          saveWorkflow(workflow).then(() => {
            window.dispatchEvent(new CustomEvent("operant-workflow-saved"));
          }).catch(console.error);
        }
      }
    }
  }, [run]);

  if (!run) return <EmptyState />;

  return (
    <div className="flex flex-col h-full">
      {/* Run header */}
      <div
        className="flex-shrink-0 rounded-xl p-4 mb-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }} title={run.userMessage}>
            {run.userMessage.length > 80 ? run.userMessage.slice(0, 80) + "…" : run.userMessage}
          </p>
          <StatusBadge status={run.status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>
            {run.toolCalls.length} tool call{run.toolCalls.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px] font-mono" style={{ color: "var(--foreground-muted)" }}>
            {elapsed(run.startedAt, run.completedAt)}
          </span>
        </div>
      </div>

      {/* AOS stage + metrics */}
      {currentStage && currentStage.stage !== "complete" && (
        <StageIndicator stage={currentStage.stage} description={currentStage.description} />
      )}

      {/* Tool call timeline */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {run.toolCalls.length === 0 && run.status === "running" && !currentStage ? (
          <div className="flex items-center gap-2 py-3">
            <span
              className="w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <span className="text-xs" style={{ color: "var(--foreground-3)" }}>
              Thinking...
            </span>
          </div>
        ) : (
          run.toolCalls.map((tc) => {
          const workflow = (tc.toolName === "build_workflow" || tc.toolName === "update_workflow") && tc.output
            ? extractWorkflowFromOutput(tc.output)
            : null;
          return (
            <div key={tc.id}>
              <ToolCallCard tc={tc} />
              {workflow && (
                <>
                  <WorkflowVisualizer workflow={workflow} />
                  <ExportButtons workflow={workflow} />
                  <ScheduleSection workflow={workflow} />
                </>
              )}
            </div>
          );
        })
        )}

        {/* Observation + reflection */}
        {observation && <ObservationCard obs={observation} />}
        {reflection && <ReflectionCard reflection={reflection} />}

        {/* Final message */}
        {run.finalMessage && (
          <div
            className="rounded-xl p-3 mt-2"
            style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)" }}
          >
            <p className="text-[11px] font-semibold mb-1" style={{ color: "#22c55e" }}>
              Agent response
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-2)" }}>
              {run.finalMessage}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
