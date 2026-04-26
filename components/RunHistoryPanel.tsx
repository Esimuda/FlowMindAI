"use client";

import { useEffect, useState } from "react";
import { AgentRun } from "@/lib/types";
import { listRunHistory, clearRunHistory } from "@/lib/db/runHistory";
import ToolCallCard from "./ToolCallCard";

function elapsed(startedAt: number, completedAt?: number): string {
  const ms = (completedAt ?? Date.now()) - startedAt;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function RunCard({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false);

  const borderColor =
    run.status === "running" ? "var(--accent)" : run.status === "completed" ? "#22c55e" : "#ef4444";

  const statusColor =
    run.status === "running" ? "var(--accent)" : run.status === "completed" ? "#22c55e" : "#ef4444";

  return (
    <div
      className="rounded-xl p-3 mb-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p
          className="text-xs font-medium flex-1 min-w-0 truncate"
          style={{ color: "var(--foreground)" }}
          title={run.userMessage}
        >
          {run.userMessage}
        </p>
        <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: statusColor }}>
          {run.status}
        </span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>
          {run.toolCalls.length} tool{run.toolCalls.length !== 1 ? "s" : ""} · {elapsed(run.startedAt, run.completedAt)}
        </span>
        <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>
          {timeAgo(run.startedAt)}
        </span>
      </div>

      {run.toolCalls.length > 0 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[10px] flex items-center gap-1 transition-colors"
          style={{ color: "var(--foreground-3)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground-2)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-3)")}
        >
          <span>{expanded ? "▾" : "▸"}</span>
          <span>{expanded ? "Hide steps" : "Show steps"}</span>
        </button>
      )}

      {expanded && (
        <div className="mt-2 space-y-1">
          {run.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} tc={tc} />
          ))}
          {run.finalMessage && (
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--foreground-2)" }}>
              {run.finalMessage.slice(0, 300)}{run.finalMessage.length > 300 ? "…" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function RunHistoryPanel() {
  const [runs, setRuns] = useState<AgentRun[]>([]);

  const refresh = async () => setRuns(await listRunHistory());

  useEffect(() => {
    refresh();
    window.addEventListener("operant-run-saved", refresh);
    return () => window.removeEventListener("operant-run-saved", refresh);
  }, []);

  const handleClear = () => {
    clearRunHistory();
    refresh();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground-3)" }}>
            Run History
          </span>
          {runs.length > 0 && (
            <span
              className="ml-2 text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.25)" }}
            >
              {runs.length}
            </span>
          )}
        </div>
        {runs.length > 0 && (
          <button
            onClick={handleClear}
            className="text-[10px] px-2 py-1 rounded-lg transition-all"
            style={{ color: "var(--foreground-3)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "var(--accent-glow)", border: "1px solid rgba(218,119,86,0.2)" }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="var(--accent)" strokeWidth="1.5" />
                <path d="M10 7v3.5l2 2" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground-2)" }}>No runs yet</p>
            <p className="text-xs max-w-[180px]" style={{ color: "var(--foreground-muted)" }}>
              Completed agent runs will appear here across sessions
            </p>
          </div>
        ) : (
          runs.map((run) => <RunCard key={run.id} run={run} />)
        )}
      </div>
    </div>
  );
}
