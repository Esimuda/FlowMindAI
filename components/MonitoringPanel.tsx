"use client";

import { useEffect, useState, useCallback } from "react";
import type { ScheduledWorkflow } from "@/lib/db/schedules";
import { listSchedules, toggleSchedule, deleteSchedule, nextRunLabel, freqLabel } from "@/lib/db/schedules";

type AlertChannel = "email" | "slack";
type AlertEvent = "failure" | "success" | "all";

interface WorkflowAlert {
  id: string;
  workflowId: string;
  workflowName: string;
  channel: AlertChannel;
  destination: string;
  event: AlertEvent;
  enabled: boolean;
}

async function fetchAlerts(): Promise<WorkflowAlert[]> {
  const res = await fetch("/api/alerts");
  if (!res.ok) return [];
  const json = await res.json() as { alerts: WorkflowAlert[] };
  return json.alerts ?? [];
}

async function createAlert(
  workflowId: string,
  workflowName: string,
  channel: AlertChannel,
  destination: string,
  event: AlertEvent
): Promise<void> {
  await fetch("/api/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflowId, workflowName, channel, destination, event }),
  });
}

async function removeAlert(id: string): Promise<void> {
  await fetch("/api/alerts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

async function patchAlert(id: string, enabled: boolean): Promise<void> {
  await fetch("/api/alerts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, enabled }),
  });
}

const EVENT_LABELS: Record<AlertEvent, string> = {
  failure: "On failure",
  success: "On success",
  all: "Always",
};

const CHANNEL_ICONS: Record<AlertChannel, string> = {
  email: "✉️",
  slack: "💬",
};

export default function MonitoringPanel() {
  const [schedules, setSchedules] = useState<ScheduledWorkflow[]>([]);
  const [alerts, setAlerts] = useState<WorkflowAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-alert form state
  const [addingFor, setAddingFor] = useState<{ id: string; name: string } | null>(null);
  const [newChannel, setNewChannel] = useState<AlertChannel>("email");
  const [newDest, setNewDest] = useState("");
  const [newEvent, setNewEvent] = useState<AlertEvent>("failure");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const [s, a] = await Promise.all([listSchedules(), fetchAlerts()]);
    setSchedules(s);
    setAlerts(a);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleToggle(id: string) {
    await toggleSchedule(id);
    reload();
  }

  async function handleDelete(id: string) {
    await deleteSchedule(id);
    reload();
  }

  async function handleAddAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!addingFor || !newDest.trim()) return;
    setSaving(true);
    await createAlert(addingFor.id, addingFor.name, newChannel, newDest.trim(), newEvent);
    setAddingFor(null);
    setNewDest("");
    setSaving(false);
    reload();
  }

  async function handleDeleteAlert(id: string) {
    await removeAlert(id);
    reload();
  }

  async function handleToggleAlert(id: string, current: boolean) {
    await patchAlert(id, !current);
    reload();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8">
        <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#7c3aed", borderTopColor: "transparent" }} />
        <span className="text-sm" style={{ color: "#475569" }}>Loading monitors...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin pr-1">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-sm font-bold mb-1" style={{ color: "#e2e8f0" }}>Workflow Monitoring</h2>
        <p className="text-xs" style={{ color: "#475569" }}>
          Track scheduled workflows and configure alerts for failures or completions.
        </p>
      </div>

      {schedules.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "#0d0d12", border: "1px solid #1a1a2e" }}
        >
          <p className="text-sm mb-1" style={{ color: "#334155" }}>No scheduled workflows</p>
          <p className="text-xs" style={{ color: "#1e293b" }}>
            Build a workflow and click &ldquo;Schedule this workflow&rdquo; to start monitoring.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => {
            const workflowAlerts = alerts.filter((a) => a.workflowId === schedule.workflowId);
            const isAddingAlert = addingFor?.id === schedule.workflowId;

            return (
              <div
                key={schedule.id}
                className="rounded-xl p-4"
                style={{ background: "#0d0d12", border: "1px solid #1a1a2e" }}
              >
                {/* Schedule header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "#e2e8f0" }}>
                      {schedule.blueprint.name}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#475569" }}>
                      {freqLabel(schedule.frequency, schedule.runHour)} · Next: {nextRunLabel(schedule.nextRunAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Enable/disable toggle */}
                    <button
                      onClick={() => handleToggle(schedule.id)}
                      className="text-[10px] px-2 py-1 rounded-lg transition-all"
                      style={{
                        background: schedule.enabled ? "rgba(34,197,94,0.08)" : "rgba(100,116,139,0.08)",
                        color: schedule.enabled ? "#22c55e" : "#64748b",
                        border: `1px solid ${schedule.enabled ? "rgba(34,197,94,0.2)" : "rgba(100,116,139,0.2)"}`,
                      }}
                    >
                      {schedule.enabled ? "Active" : "Paused"}
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="text-[10px] px-2 py-1 rounded-lg"
                      style={{ color: "#475569", border: "1px solid #1a1a2e" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "#1a1a2e"; }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Status pill */}
                <div className="flex items-center gap-3 mb-3">
                  {schedule.lastRunAt ? (
                    <span className="text-[10px]" style={{ color: "#334155" }}>
                      Last ran: {new Date(schedule.lastRunAt).toLocaleDateString()} at{" "}
                      {new Date(schedule.lastRunAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: "#1e293b" }}>Never run</span>
                  )}
                </div>

                {/* Alerts for this workflow */}
                {workflowAlerts.length > 0 && (
                  <div className="space-y-1.5 mb-2.5">
                    {workflowAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                        style={{ background: "#050508", border: "1px solid #0f0f18" }}
                      >
                        <span className="text-[11px]">{CHANNEL_ICONS[alert.channel]}</span>
                        <span className="text-[10px] flex-1 truncate" style={{ color: "#64748b" }}>
                          {EVENT_LABELS[alert.event]} → {alert.destination}
                        </span>
                        <button
                          onClick={() => handleToggleAlert(alert.id, alert.enabled)}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            color: alert.enabled ? "#22c55e" : "#475569",
                            background: alert.enabled ? "rgba(34,197,94,0.06)" : "transparent",
                          }}
                        >
                          {alert.enabled ? "On" : "Off"}
                        </button>
                        <button
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ color: "#334155" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add alert button / form */}
                {!isAddingAlert ? (
                  <button
                    onClick={() => setAddingFor({ id: schedule.workflowId, name: schedule.blueprint.name })}
                    className="text-[10px] flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all"
                    style={{ color: "#334155", border: "1px dashed #1a1a2e" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#7c3aed"; e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#334155"; e.currentTarget.style.borderColor = "#1a1a2e"; }}
                  >
                    + Add alert
                  </button>
                ) : (
                  <form
                    onSubmit={handleAddAlert}
                    className="mt-1 pt-3 space-y-2"
                    style={{ borderTop: "1px solid #1a1a2e" }}
                  >
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: "#334155" }}>
                      New alert
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={newChannel}
                        onChange={(e) => setNewChannel(e.target.value as AlertChannel)}
                        className="text-[11px] px-2 py-1.5 rounded-lg"
                        style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#94a3b8" }}
                      >
                        <option value="email">Email</option>
                        <option value="slack">Slack</option>
                      </select>
                      <select
                        value={newEvent}
                        onChange={(e) => setNewEvent(e.target.value as AlertEvent)}
                        className="text-[11px] px-2 py-1.5 rounded-lg"
                        style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#94a3b8" }}
                      >
                        <option value="failure">On failure</option>
                        <option value="success">On success</option>
                        <option value="all">Always</option>
                      </select>
                    </div>
                    <input
                      type={newChannel === "email" ? "email" : "text"}
                      value={newDest}
                      onChange={(e) => setNewDest(e.target.value)}
                      placeholder={newChannel === "email" ? "your@email.com" : "https://hooks.slack.com/..."}
                      className="w-full text-[11px] px-2.5 py-1.5 rounded-lg outline-none"
                      style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#e2e8f0" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#1a1a2e")}
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving || !newDest.trim()}
                        className="text-[11px] px-3 py-1.5 rounded-lg font-semibold"
                        style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "#fff" }}
                      >
                        {saving ? "Saving..." : "Save alert"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddingFor(null); setNewDest(""); }}
                        className="text-[11px] px-2 py-1.5 rounded-lg"
                        style={{ color: "#475569" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
