"use client";

import { useCallback, useEffect, useState } from "react";
import type { MemoryEntry, MemoryType } from "@/lib/types";

type Tab = "learned" | "patterns";

function timeAgo(ts?: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatValue(entry: MemoryEntry): string {
  const v = entry.value;
  if (typeof v === "string") return v;
  if (typeof v !== "object" || v === null) return String(v);
  const obj = v as Record<string, unknown>;
  if (entry.type === "pattern") {
    const parts: string[] = [];
    if (obj.failure) parts.push(`Failure: ${obj.failure}`);
    if (obj.cause)   parts.push(`Cause: ${obj.cause}`);
    if (obj.solution) parts.push(`Fix: ${obj.solution}`);
    if (obj.tool)    parts.push(`Tool: ${obj.tool}`);
    return parts.join("\n");
  }
  if (obj.goal) {
    const tools = Array.isArray(obj.tools) ? (obj.tools as string[]).join(", ") : "";
    const steps = Array.isArray(obj.steps) ? (obj.steps as string[]).join(" → ") : "";
    return [
      `Goal: ${obj.goal}`,
      steps && `Steps: ${steps}`,
      tools && `Tools: ${tools}`,
    ].filter(Boolean).join("\n");
  }
  return JSON.stringify(v, null, 2);
}

function MemoryCard({
  entry,
  onDelete,
  deleting,
}: {
  entry: MemoryEntry;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const formatted = formatValue(entry);
  const lines = formatted.split("\n");
  const preview = lines[0];
  const hasMore = lines.length > 1;

  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] font-mono mb-1.5 truncate"
            style={{ color: "var(--foreground-3)" }}
            title={entry.key}
          >
            {entry.key}
          </p>
          <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground-2)" }}>
            {expanded ? formatted : preview}
          </p>
          {hasMore && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-[10px] mt-1.5 transition-colors"
              style={{ color: "var(--foreground-3)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-3)"; }}
            >
              {expanded ? "Show less" : `+${lines.length - 1} more lines`}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{timeAgo(entry.updatedAt)}</p>
            <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>
              {Math.round(entry.relevance * 100)}% rel
            </p>
          </div>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
            style={{ color: "var(--foreground-muted)", border: "1px solid transparent" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f87171";
              e.currentTarget.style.borderColor = "rgba(248,113,113,0.2)";
              e.currentTarget.style.background = "rgba(248,113,113,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--foreground-muted)";
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.background = "transparent";
            }}
            title="Delete"
          >
            {deleting ? (
              <svg width="10" height="10" viewBox="0 0 10 10" className="animate-spin">
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6" fill="none" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7" stroke="var(--foreground-muted)" strokeWidth="1.5" />
          <path d="M6 9h6M9 6v6" stroke="var(--foreground-muted)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-xs text-center" style={{ color: "var(--foreground-muted)" }}>
        {tab === "learned"
          ? "No learned context yet.\nRun a few workflows and the agent will start learning."
          : "No failure patterns recorded.\nPatterns are saved when the agent self-heals a failed step."}
      </p>
    </div>
  );
}

export default function MemoryPanel() {
  const [tab, setTab] = useState<Tab>("learned");
  const [longTerm, setLongTerm] = useState<MemoryEntry[]>([]);
  const [patterns, setPatterns] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());
  const [clearingTab, setClearingTab] = useState<Tab | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memory");
      if (res.ok) {
        const data = await res.json();
        setLongTerm(data.longTerm ?? []);
        setPatterns(data.patterns ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(type: MemoryType, key: string) {
    const k = `${type}:${key}`;
    setDeletingKeys((prev) => new Set(prev).add(k));
    try {
      await fetch("/api/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, key }),
      });
      if (type === "long_term") setLongTerm((prev) => prev.filter((e) => e.key !== key));
      else setPatterns((prev) => prev.filter((e) => e.key !== key));
    } finally {
      setDeletingKeys((prev) => { const s = new Set(prev); s.delete(k); return s; });
    }
  }

  async function handleClearAll(type: MemoryType, tabName: Tab) {
    setClearingTab(tabName);
    try {
      await fetch("/api/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, clearAll: true }),
      });
      if (type === "long_term") setLongTerm([]);
      else setPatterns([]);
    } finally {
      setClearingTab(null);
    }
  }

  const activeEntries = tab === "learned" ? longTerm : patterns;
  const activeType: MemoryType = tab === "learned" ? "long_term" : "pattern";

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Memory</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
            What the agent has learned about your business and workflows
          </p>
        </div>
        <button
          onClick={load}
          className="text-[11px] px-3 py-1.5 rounded-lg transition-all"
          style={{ color: "var(--foreground-3)", border: "1px solid var(--border)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground-2)"; e.currentTarget.style.borderColor = "var(--foreground-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-lg flex-shrink-0"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {(["learned", "patterns"] as Tab[]).map((t) => {
          const count = t === "learned" ? longTerm.length : patterns.length;
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all"
              style={
                isActive
                  ? { background: "var(--accent)", color: "#fff" }
                  : { color: "var(--foreground-2)" }
              }
            >
              {t === "learned" ? "Learned" : "Failure patterns"}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={
                  isActive
                    ? { background: "rgba(255,255,255,0.15)", color: "#fff" }
                    : { background: "var(--border)", color: "var(--foreground-3)" }
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : activeEntries.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="flex flex-col gap-2 pb-4">
            {activeEntries.map((entry) => (
              <MemoryCard
                key={`${entry.type}:${entry.key}`}
                entry={entry}
                deleting={deletingKeys.has(`${entry.type}:${entry.key}`)}
                onDelete={() => handleDelete(activeType, entry.key)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer: clear all */}
      {activeEntries.length > 0 && (
        <div className="flex-shrink-0 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => handleClearAll(activeType, tab)}
            disabled={clearingTab === tab}
            className="text-[11px] px-3 py-1.5 rounded-lg transition-all"
            style={{ color: "var(--foreground-3)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            {clearingTab === tab ? "Clearing..." : `Clear all ${tab === "learned" ? "learned context" : "failure patterns"}`}
          </button>
        </div>
      )}
    </div>
  );
}
