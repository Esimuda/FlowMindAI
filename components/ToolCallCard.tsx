"use client";

import { useState } from "react";
import { ToolCallRecord } from "@/lib/types";

const TOOL_LABELS: Record<string, string> = {
  notion_create_page: "Notion · Create page",
  notion_query_database: "Notion · Query database",
  send_email: "Email · Send",
  slack_send_message: "Slack · Send message",
  stripe_list_customers: "Stripe · List customers",
  stripe_list_charges: "Stripe · List charges",
  build_workflow: "Workflow · Build",
};

function elapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ToolCallCard({ tc }: { tc: ToolCallRecord }) {
  const [expanded, setExpanded] = useState(false);

  const borderColor =
    tc.status === "calling" ? "var(--accent)" : tc.status === "success" ? "#22c55e" : "#ef4444";

  const statusText =
    tc.status === "calling" ? "Running..." : tc.status === "success" ? "Done" : "Failed";

  const statusColor =
    tc.status === "calling" ? "var(--accent)" : tc.status === "success" ? "#22c55e" : "#ef4444";

  const label = TOOL_LABELS[tc.toolName] ?? tc.toolName;
  const durationMs = tc.completedAt ? tc.completedAt - tc.startedAt : undefined;
  const inputEntries = Object.entries(tc.input).filter(([, v]) => v !== undefined && v !== "");

  return (
    <div
      className="rounded-xl p-3 mb-2"
      style={{
        background: "var(--surface)",
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] font-semibold truncate" style={{ color: "var(--accent)" }}>
            {label}
          </span>
          {tc.status === "calling" && (
            <span
              className="w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {durationMs !== undefined && (
            <span className="text-[10px] font-mono" style={{ color: "var(--foreground-muted)" }}>
              {elapsed(durationMs)}
            </span>
          )}
          <span className="text-[10px] font-semibold" style={{ color: statusColor }}>
            {statusText}
          </span>
        </div>
      </div>

      {inputEntries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {inputEntries.slice(0, 3).map(([k, v]) => (
            <span
              key={k}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "var(--surface-2)", color: "var(--foreground-3)" }}
            >
              {k}: {typeof v === "string" ? v.slice(0, 30) + (v.length > 30 ? "…" : "") : JSON.stringify(v).slice(0, 30)}
            </span>
          ))}
        </div>
      )}

      {(tc.output || tc.error) && (
        <div className="mt-2">
          <button
            className="text-[10px] flex items-center gap-1"
            style={{ color: "var(--foreground-3)" }}
            onClick={() => setExpanded((e) => !e)}
          >
            <span>{expanded ? "▾" : "▸"}</span>
            <span>{expanded ? "Hide output" : "Show output"}</span>
          </button>
          {expanded && (
            <pre
              className="mt-1.5 text-[10px] font-mono whitespace-pre-wrap rounded p-2 overflow-auto max-h-32"
              style={{
                background: "var(--surface-2)",
                color: tc.error ? "#ef4444" : "var(--foreground-2)",
                border: "1px solid var(--border)",
              }}
            >
              {tc.output ?? tc.error}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
