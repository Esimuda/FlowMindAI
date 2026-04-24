import type { WorkflowBlueprint } from "@/lib/export/n8n";

export type ScheduleFrequency = "hourly" | "daily" | "weekly";

export interface ScheduledWorkflow {
  id: string;
  workflowId: string;
  blueprint: WorkflowBlueprint;
  frequency: ScheduleFrequency;
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt: number;
  createdAt: number;
}

// ── API-backed schedule operations ──────────────────────────────────────────

export async function createSchedule(
  workflowId: string,
  blueprint: WorkflowBlueprint,
  frequency: ScheduleFrequency
): Promise<ScheduledWorkflow> {
  const res = await fetch("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflowId, blueprint, frequency }),
  });
  if (!res.ok) throw new Error("Failed to create schedule");
  return res.json() as Promise<ScheduledWorkflow>;
}

export async function deleteSchedule(id: string): Promise<void> {
  await fetch(`/api/schedules/${id}`, { method: "DELETE" });
}

export async function toggleSchedule(id: string): Promise<void> {
  await fetch(`/api/schedules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toggle: true }),
  });
}

export async function listSchedules(): Promise<ScheduledWorkflow[]> {
  const res = await fetch("/api/schedules");
  if (!res.ok) return [];
  return res.json() as Promise<ScheduledWorkflow[]>;
}

export async function getScheduleForWorkflow(workflowId: string): Promise<ScheduledWorkflow | undefined> {
  const all = await listSchedules();
  return all.find((s) => s.workflowId === workflowId);
}

// ── Display utilities ────────────────────────────────────────────────────────

export function freqLabel(f: ScheduleFrequency): string {
  return { hourly: "Every hour", daily: "Every day", weekly: "Every week" }[f];
}

export function nextRunLabel(nextRunAt: number): string {
  const diff = nextRunAt - Date.now();
  if (diff <= 0) return "Due now";
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60) return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h`;
  return `in ${days}d`;
}
