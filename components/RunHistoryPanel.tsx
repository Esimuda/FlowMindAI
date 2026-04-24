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
    run.status === "running" ? "#7c3aed" : run.status === "completed" ? "#22c55e" : "#ef4444";

  return (
    <div
      className="rounded-xl p-3 mb-3"
      style={{ background: "#0d0d12", border: "1px solid #1a1a2e", borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p
          className="text-xs font-medium flex-1 min-w-0 truncate"
          style={{ color: "#e2e8f0" }}
          title={run.userMessage}
        >
          {run.userMessage}
        </p>
        <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: borderColor }}>
          {run.status}
        </span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px]" style={{ color: "#334155" }}>
          {run.toolCalls.length} tool{run.toolCalls.length !== 1 ? "s" : ""} · {elapsed(run.startedAt, run.completedAt)}
        </span>
        <span className="text-[10px]" style={{ color: "#334155" }}>
          {timeAgo(run.startedAt)}
        </span>
      </div>

      {run.toolCalls.length > 0 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[10px] flex items-center gap-1 transition-colors"
          style={{ color: "#475569" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#64748b")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
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
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "#475569" }}>
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
    window.addEventListener("flowmind-run-saved", refresh);
    return () => window.removeEventListener("flowmind-run-saved", refresh);
  }, []);

  const handleClear = () => {
    clearRunHistory();
    refresh();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>
            Run History
          </span>
          {runs.length > 0 && (
            <span
              className="ml-2 text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(124,58,237,0.1)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.2)" }}
            >
              {runs.length}
            </span>
          )}
        </div>
        {runs.length > 0 && (
          <button
            onClick={handleClear}
            className="text-[10px] px-2 py-1 rounded-lg transition-all"
            style={{ color: "#334155", border: "1px solid #1a1a2e" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#334155"; e.currentTarget.style.borderColor = "#1a1a2e"; }}
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
              style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}
            >
              <span className="text-xl">📋</span>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "#475569" }}>No runs yet</p>
            <p className="text-xs max-w-[180px]" style={{ color: "#1e293b" }}>
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
