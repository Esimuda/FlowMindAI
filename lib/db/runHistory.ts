import { createClient } from "@/lib/supabase/client";
import { AgentRun } from "@/lib/types";

const MAX_RUNS = 50;

export async function persistRun(run: AgentRun): Promise<void> {
  if (run.status === "running") return;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("run_history").upsert(
    { id: run.id, user_id: user.id, run, started_at: new Date(run.startedAt).toISOString() },
    { onConflict: "id" }
  );

  // Keep only the last MAX_RUNS per user
  const { data } = await supabase
    .from("run_history")
    .select("id, started_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });

  if (data && data.length > MAX_RUNS) {
    const toDelete = data.slice(MAX_RUNS).map((r) => r.id as string);
    await supabase.from("run_history").delete().in("id", toDelete).eq("user_id", user.id);
  }

  window.dispatchEvent(new CustomEvent("operant-run-saved"));
}

export async function listRunHistory(): Promise<AgentRun[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("run_history")
    .select("run")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(MAX_RUNS);

  if (error || !data) return [];
  return data.map((row) => row.run as AgentRun);
}

export async function deleteRun(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("run_history").delete().eq("id", id).eq("user_id", user.id);
  window.dispatchEvent(new CustomEvent("operant-run-saved"));
}

export async function clearRunHistory(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("run_history").delete().eq("user_id", user.id);
  window.dispatchEvent(new CustomEvent("operant-run-saved"));
}
