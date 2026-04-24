import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScheduleFrequency, ScheduledWorkflow } from "@/lib/db/schedules";
import type { WorkflowBlueprint } from "@/lib/export/n8n";

const FREQ_MS: Record<ScheduleFrequency, number> = {
  hourly:  3_600_000,
  daily:   86_400_000,
  weekly:  604_800_000,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSchedule(row: Record<string, any>): ScheduledWorkflow {
  return {
    id:          row.id as string,
    workflowId:  row.workflow_id as string,
    blueprint:   row.blueprint as WorkflowBlueprint,
    frequency:   row.frequency as ScheduleFrequency,
    enabled:     row.enabled as boolean,
    lastRunAt:   row.last_run_at ? new Date(row.last_run_at as string).getTime() : undefined,
    nextRunAt:   new Date(row.next_run_at as string).getTime(),
    createdAt:   new Date(row.created_at as string).getTime(),
  };
}

// ── User-scoped operations (respect RLS via SSR client) ─────────────────────

export async function listSchedulesForUser(userId: string): Promise<ScheduledWorkflow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedules")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToSchedule);
}

export async function createScheduleDB(
  userId: string,
  workflowId: string,
  blueprint: WorkflowBlueprint,
  frequency: ScheduleFrequency
): Promise<ScheduledWorkflow> {
  const supabase = await createClient();
  const nextRunAt = new Date(Date.now() + FREQ_MS[frequency]).toISOString();
  const { data, error } = await supabase
    .from("schedules")
    .upsert(
      {
        user_id:       userId,
        workflow_id:   workflowId,
        workflow_name: blueprint.name,
        blueprint,
        frequency,
        enabled:       true,
        next_run_at:   nextRunAt,
      },
      { onConflict: "user_id,workflow_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return rowToSchedule(data);
}

export async function updateScheduleDB(
  id: string,
  patch: { enabled?: boolean; frequency?: ScheduleFrequency }
): Promise<void> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};
  if (patch.enabled !== undefined) updates.enabled = patch.enabled;
  if (patch.frequency) {
    updates.frequency   = patch.frequency;
    updates.next_run_at = new Date(Date.now() + FREQ_MS[patch.frequency]).toISOString();
  }
  await supabase.from("schedules").update(updates).eq("id", id);
}

export async function deleteScheduleDB(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("schedules").delete().eq("id", id);
}

export async function getScheduleEnabledState(id: string, userId: string): Promise<boolean | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedules")
    .select("enabled")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  return data ? (data.enabled as boolean) : null;
}

// ── Cron operations (service role — bypasses RLS) ───────────────────────────

export interface DueScheduleRow {
  id:            string;
  user_id:       string;
  workflow_id:   string;
  workflow_name: string;
  blueprint:     WorkflowBlueprint;
  frequency:     ScheduleFrequency;
}

export async function getDueSchedulesAdmin(): Promise<DueScheduleRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("schedules")
    .select("id, user_id, workflow_id, workflow_name, blueprint, frequency")
    .eq("enabled", true)
    .lte("next_run_at", new Date().toISOString());
  return (data ?? []) as DueScheduleRow[];
}

export async function markScheduleRanAdmin(id: string, frequency: ScheduleFrequency): Promise<void> {
  const admin = createAdminClient();
  const nextRunAt = new Date(Date.now() + FREQ_MS[frequency]).toISOString();
  await admin
    .from("schedules")
    .update({ last_run_at: new Date().toISOString(), next_run_at: nextRunAt })
    .eq("id", id);
}
