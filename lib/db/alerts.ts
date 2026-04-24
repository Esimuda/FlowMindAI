import { createClient } from "@/lib/supabase/server";

export type AlertChannel = "email" | "slack";
export type AlertEvent = "failure" | "success" | "all";

export interface WorkflowAlert {
  id: string;
  userId: string;
  workflowId: string;
  workflowName: string;
  channel: AlertChannel;
  destination: string; // email address or Slack webhook URL
  event: AlertEvent;
  enabled: boolean;
  createdAt: number;
}

export async function saveAlert(
  alert: Omit<WorkflowAlert, "id" | "createdAt">
): Promise<WorkflowAlert> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_alerts")
    .insert({
      user_id: alert.userId,
      workflow_id: alert.workflowId,
      workflow_name: alert.workflowName,
      channel: alert.channel,
      destination: alert.destination,
      event: alert.event,
      enabled: alert.enabled,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToAlert(data);
}

export async function listAlerts(userId: string): Promise<WorkflowAlert[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflow_alerts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToAlert);
}

export async function listAlertsForWorkflow(
  userId: string,
  workflowId: string
): Promise<WorkflowAlert[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflow_alerts")
    .select("*")
    .eq("user_id", userId)
    .eq("workflow_id", workflowId);
  return (data ?? []).map(rowToAlert);
}

export async function deleteAlert(alertId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("workflow_alerts").delete().eq("id", alertId);
}

export async function toggleAlert(alertId: string, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from("workflow_alerts").update({ enabled }).eq("id", alertId);
}

function rowToAlert(row: Record<string, unknown>): WorkflowAlert {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    workflowId: row.workflow_id as string,
    workflowName: row.workflow_name as string,
    channel: row.channel as AlertChannel,
    destination: row.destination as string,
    event: row.event as AlertEvent,
    enabled: row.enabled as boolean,
    createdAt: new Date(row.created_at as string).getTime(),
  };
}
