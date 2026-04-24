"use client";

import { useState } from "react";
import type { WorkflowBlueprint } from "@/lib/export/n8n";

const TOOL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  notion:    { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.35)",  text: "#818cf8" },
  gmail:     { bg: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.3)",    text: "#f87171" },
  sheets:    { bg: "rgba(34,197,94,0.1)",    border: "rgba(34,197,94,0.3)",    text: "#4ade80" },
  calendar:  { bg: "rgba(16,185,129,0.1)",   border: "rgba(16,185,129,0.3)",   text: "#34d399" },
  slack:     { bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.25)",  text: "#86efac" },
  stripe:    { bg: "rgba(99,102,241,0.1)",   border: "rgba(99,102,241,0.25)",  text: "#a5b4fc" },
  hubspot:   { bg: "rgba(251,146,60,0.1)",   border: "rgba(251,146,60,0.3)",   text: "#fb923c" },
  airtable:  { bg: "rgba(6,182,212,0.1)",    border: "rgba(6,182,212,0.3)",    text: "#22d3ee" },
  resend:    { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   text: "#fca5a5" },
  twilio:    { bg: "rgba(220,38,38,0.1)",    border: "rgba(220,38,38,0.25)",   text: "#f87171" },
  github:    { bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)", text: "#94a3b8" },
  linear:    { bg: "rgba(124,58,237,0.1)",   border: "rgba(124,58,237,0.3)",   text: "#a78bfa" },
  discord:   { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.3)",   text: "#818cf8" },
  mailchimp: { bg: "rgba(234,179,8,0.1)",    border: "rgba(234,179,8,0.3)",    text: "#facc15" },
  default:   { bg: "rgba(124,58,237,0.08)",  border: "rgba(124,58,237,0.25)", text: "#c4b5fd" },
};

function toolColor(tool: string) {
  const key = Object.keys(TOOL_COLORS).find((k) =>
    tool.toLowerCase().includes(k)
  );
  return key ? TOOL_COLORS[key] : TOOL_COLORS.default;
}

function toolEmoji(tool: string): string {
  const t = tool.toLowerCase();
  if (t.includes("notion"))    return "📄";
  if (t.includes("gmail") || t.includes("email") || t.includes("resend")) return "✉️";
  if (t.includes("sheets"))    return "📊";
  if (t.includes("calendar"))  return "📅";
  if (t.includes("slack"))     return "💬";
  if (t.includes("stripe"))    return "💳";
  if (t.includes("hubspot"))   return "🤝";
  if (t.includes("airtable"))  return "🗂️";
  if (t.includes("twilio"))    return "📱";
  if (t.includes("github"))    return "🐙";
  if (t.includes("linear"))    return "📌";
  if (t.includes("discord"))   return "🎮";
  if (t.includes("mailchimp")) return "📨";
  return "⚙️";
}

interface NodeProps {
  label: string;
  sublabel?: string;
  tool: string;
  isTrigger?: boolean;
  selected: boolean;
  onClick: () => void;
}

function FlowNode({ label, sublabel, tool, isTrigger, selected, onClick }: NodeProps) {
  const color = isTrigger
    ? { bg: "rgba(6,182,212,0.1)", border: "rgba(6,182,212,0.4)", text: "#22d3ee" }
    : toolColor(tool);

  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl px-3 py-2.5 w-full transition-all duration-150"
      style={{
        background: selected ? color.bg.replace("0.1", "0.2").replace("0.08", "0.18") : color.bg,
        border: `1.5px solid ${selected ? color.border : color.border.replace("0.3", "0.18").replace("0.35", "0.22").replace("0.25", "0.15").replace("0.4", "0.22")}`,
        boxShadow: selected ? `0 0 0 2px ${color.border}` : "none",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{isTrigger ? "⚡" : toolEmoji(tool)}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: color.text }}>
            {label}
          </p>
          {sublabel && (
            <p className="text-[10px] leading-tight truncate mt-0.5" style={{ color: "#475569" }}>
              {sublabel}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function Arrow({ isParallel }: { isParallel?: boolean }) {
  return (
    <div className="flex flex-col items-center py-0.5">
      <div
        className="w-px flex-1"
        style={{
          background: isParallel ? "rgba(6,182,212,0.3)" : "rgba(124,58,237,0.25)",
          minHeight: 16,
        }}
      />
      <svg width="8" height="6" viewBox="0 0 8 6" fill="none" style={{ marginTop: -1 }}>
        <path
          d="M4 6L0 0h8L4 6z"
          fill={isParallel ? "rgba(6,182,212,0.5)" : "rgba(124,58,237,0.4)"}
        />
      </svg>
    </div>
  );
}

interface DetailPanelProps {
  step: WorkflowBlueprint["steps"][number] | null;
  onClose: () => void;
  onUpdate: (stepId: number, field: "action" | "output", value: string) => void;
}

function DetailPanel({ step, onClose, onUpdate }: DetailPanelProps) {
  if (!step) return null;
  const color = toolColor(step.tool);

  return (
    <div
      className="rounded-xl p-3 mt-3"
      style={{ background: "#0d0d12", border: `1px solid ${color.border}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold" style={{ color: color.text }}>
          {toolEmoji(step.tool)} Step {step.step}
        </span>
        <button onClick={onClose} className="text-[11px] px-1.5 py-0.5 rounded" style={{ color: "#475569" }}>
          ×
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: "#334155" }}>
            Action
          </label>
          <textarea
            defaultValue={step.action}
            rows={2}
            onBlur={(e) => onUpdate(step.step, "action", e.target.value)}
            className="w-full text-[11px] px-2.5 py-1.5 rounded-lg resize-none outline-none"
            style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#e2e8f0", lineHeight: 1.5 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = color.border)}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: "#334155" }}>
            Expected output
          </label>
          <textarea
            defaultValue={step.output}
            rows={2}
            onBlur={(e) => onUpdate(step.step, "output", e.target.value)}
            className="w-full text-[11px] px-2.5 py-1.5 rounded-lg resize-none outline-none"
            style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#e2e8f0", lineHeight: 1.5 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = color.border)}
          />
        </div>
        {step.dependencies && step.dependencies.length > 0 && (
          <p className="text-[10px]" style={{ color: "#334155" }}>
            Depends on: Step{step.dependencies.length > 1 ? "s" : ""} {step.dependencies.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

// Group steps by dependency layers for visual layout
function buildLayers(steps: WorkflowBlueprint["steps"]): WorkflowBlueprint["steps"][] {
  const placed = new Set<number>();
  const layers: WorkflowBlueprint["steps"][] = [];

  let remaining = [...steps];
  while (remaining.length > 0) {
    const layer = remaining.filter(
      (s) => !s.dependencies || s.dependencies.every((d) => placed.has(d))
    );
    if (layer.length === 0) {
      // Fallback: push all remaining (circular deps or missing)
      layers.push(remaining);
      break;
    }
    layer.forEach((s) => placed.add(s.step));
    layers.push(layer);
    remaining = remaining.filter((s) => !placed.has(s.step));
  }
  return layers;
}

interface WorkflowVisualizerProps {
  workflow: WorkflowBlueprint;
  onWorkflowChange?: (updated: WorkflowBlueprint) => void;
}

export default function WorkflowVisualizer({ workflow, onWorkflowChange }: WorkflowVisualizerProps) {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [localWorkflow, setLocalWorkflow] = useState<WorkflowBlueprint>(workflow);

  const layers = buildLayers(localWorkflow.steps);
  const selectedStepObj = selectedStep !== null
    ? localWorkflow.steps.find((s) => s.step === selectedStep) ?? null
    : null;

  function handleUpdate(stepId: number, field: "action" | "output", value: string) {
    const updated: WorkflowBlueprint = {
      ...localWorkflow,
      steps: localWorkflow.steps.map((s) =>
        s.step === stepId ? { ...s, [field]: value } : s
      ),
    };
    setLocalWorkflow(updated);
    onWorkflowChange?.(updated);
  }

  return (
    <div
      className="rounded-xl p-3 mt-2"
      style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.18)" }}
    >
      <p className="text-[11px] font-semibold mb-3" style={{ color: "#a78bfa" }}>
        ⬡ Visual workflow — click any step to edit
      </p>

      {/* Trigger node */}
      <FlowNode
        label={localWorkflow.trigger.length > 50 ? localWorkflow.trigger.slice(0, 50) + "…" : localWorkflow.trigger}
        tool="trigger"
        isTrigger
        selected={selectedStep === -1}
        onClick={() => setSelectedStep(selectedStep === -1 ? null : -1)}
      />

      {/* Step layers */}
      {layers.map((layer, layerIdx) => (
        <div key={layerIdx}>
          <Arrow isParallel={layer.length > 1} />
          {layer.length > 1 ? (
            // Parallel steps — horizontal row
            <div className="flex gap-2">
              {layer.map((step) => (
                <div key={step.step} className="flex-1 min-w-0">
                  <FlowNode
                    label={step.action.length > 40 ? step.action.slice(0, 40) + "…" : step.action}
                    sublabel={step.tool}
                    tool={step.tool}
                    selected={selectedStep === step.step}
                    onClick={() => setSelectedStep(selectedStep === step.step ? null : step.step)}
                  />
                </div>
              ))}
            </div>
          ) : (
            // Single step
            <FlowNode
              label={layer[0].action.length > 55 ? layer[0].action.slice(0, 55) + "…" : layer[0].action}
              sublabel={layer[0].tool}
              tool={layer[0].tool}
              selected={selectedStep === layer[0].step}
              onClick={() => setSelectedStep(selectedStep === layer[0].step ? null : layer[0].step)}
            />
          )}
        </div>
      ))}

      {/* Outcome node */}
      {localWorkflow.expected_outcome && (
        <>
          <Arrow />
          <div
            className="rounded-xl px-3 py-2"
            style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <p className="text-[10px] font-medium" style={{ color: "#4ade80" }}>
              ✓ {localWorkflow.expected_outcome.length > 70
                ? localWorkflow.expected_outcome.slice(0, 70) + "…"
                : localWorkflow.expected_outcome}
            </p>
          </div>
        </>
      )}

      {/* Detail panel for selected step */}
      <DetailPanel
        step={selectedStepObj}
        onClose={() => setSelectedStep(null)}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
