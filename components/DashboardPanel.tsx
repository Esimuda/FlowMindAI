"use client";

import { useEffect, useState } from "react";
import type { DashboardStats } from "@/app/api/dashboard/route";

function elapsed(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function nextRunLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Due now";
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h`;
  return `in ${days}d`;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>{label}</p>
      <p className="text-2xl font-bold mb-0.5" style={{ color: color ?? "var(--foreground)" }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{sub}</p>}
    </div>
  );
}

function ActivityBar({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date().getDay(); // 0=Sun
  const labels = values.map((_, i) => {
    const dayIdx = (today - (6 - i) + 7) % 7;
    return days[dayIdx === 0 ? 6 : dayIdx - 1];
  });

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--foreground-muted)" }}>
        Activity — last 7 days
      </p>
      <div className="flex items-end gap-1.5 h-16">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-sm transition-all"
              style={{
                height: `${Math.max((v / max) * 56, v > 0 ? 4 : 2)}px`,
                background: v > 0 ? "var(--accent)" : "var(--accent-glow)",
              }}
            />
            <span className="text-[9px]" style={{ color: "var(--foreground-muted)" }}>{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "success" ? "#22c55e" : status === "failed" ? "#ef4444" : "#eab308";
  return <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />;
}

export default function DashboardPanel() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <span className="text-xs" style={{ color: "var(--foreground-3)" }}>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const successColor = stats.successRate >= 80 ? "#22c55e" : stats.successRate >= 50 ? "#eab308" : "#ef4444";

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin gap-4">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label="Total runs" value={stats.totalRuns} />
        <StatCard label="Success rate" value={`${stats.successRate}%`} color={successColor} sub={`${stats.successfulRuns} succeeded`} />
        <StatCard label="Failures" value={stats.failedRuns} color={stats.failedRuns > 0 ? "#ef4444" : "var(--foreground)"} />
        <StatCard label="Workflows" value={stats.totalWorkflows} sub="saved" />
      </div>

      {/* Activity bar */}
      <ActivityBar values={stats.activityLast7Days} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0">

        {/* Recent executions */}
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--foreground-muted)" }}>
            Recent executions
          </p>
          {stats.recentExecutions.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>No executions yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentExecutions.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={e.status} />
                    <span className="text-xs truncate" style={{ color: "var(--foreground-2)" }}>{e.workflowName}</span>
                    {e.retryCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(234,179,8,0.1)", color: "#eab308" }}>
                        {e.retryCount}x retry
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{elapsed(e.executionTimeMs)}</span>
                    <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{timeAgo(e.startedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Learned failure patterns */}
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--foreground-muted)" }}>
            Learned failure patterns
          </p>
          {stats.failurePatterns.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>No patterns learned yet. Patterns are stored after self-healing runs.</p>
          ) : (
            <div className="space-y-3">
              {stats.failurePatterns.map((p, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-[10px] font-medium mb-0.5" style={{ color: "#f87171" }}>{p.failure}</p>
                  <p className="text-[10px]" style={{ color: "#86efac" }}>Fix: {p.solution}</p>
                  {p.learnedAt > 0 && (
                    <p className="text-[9px] mt-1" style={{ color: "var(--foreground-muted)" }}>Learned {timeAgo(new Date(p.learnedAt).toISOString())}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scheduled workflows */}
      {stats.scheduledWorkflows.length > 0 && (
        <div className="rounded-xl p-4 flex-shrink-0" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--foreground-muted)" }}>
            Scheduled automations
          </p>
          <div className="space-y-2">
            {stats.scheduledWorkflows.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--foreground-2)" }}>{s.workflowName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full capitalize" style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }}>
                    {s.frequency}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--foreground-3)" }}>{nextRunLabel(s.nextRun)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
