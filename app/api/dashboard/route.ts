import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface DashboardStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  totalWorkflows: number;
  recentExecutions: Array<{
    id: string;
    workflowName: string;
    status: string;
    retryCount: number;
    startedAt: string;
    completedAt: string | null;
    executionTimeMs: number | null;
  }>;
  failurePatterns: Array<{ key: string; failure: string; solution: string; learnedAt: number }>;
  scheduledWorkflows: Array<{ workflowName: string; frequency: string; nextRun: string }>;
  activityLast7Days: number[];
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = user.id;

  const [execRes, workflowRes, memoryRes, scheduleRes, historyRes] = await Promise.all([
    supabase.from("workflow_executions").select("id, workflow_name, status, retry_count, started_at, completed_at, observations").eq("user_id", uid).order("started_at", { ascending: false }).limit(50),
    supabase.from("workflows").select("id", { count: "exact" }).eq("user_id", uid),
    supabase.from("agent_memory").select("key, value").eq("user_id", uid).eq("type", "pattern").limit(10),
    supabase.from("schedules").select("workflow_name, frequency, next_run").eq("user_id", uid).eq("enabled", true).order("next_run", { ascending: true }).limit(5),
    supabase.from("run_history").select("id", { count: "exact" }).eq("user_id", uid),
  ]);

  const executions = execRes.data ?? [];
  const successful = executions.filter((e) => e.status === "success").length;
  const failed = executions.filter((e) => e.status === "failed").length;
  const total = historyRes.count ?? executions.length;

  // Activity for last 7 days
  const activityLast7Days = Array(7).fill(0);
  const now = Date.now();
  for (const e of executions) {
    const daysAgo = Math.floor((now - new Date(e.started_at).getTime()) / 86400000);
    if (daysAgo >= 0 && daysAgo < 7) activityLast7Days[6 - daysAgo]++;
  }

  const stats: DashboardStats = {
    totalRuns: total,
    successfulRuns: successful,
    failedRuns: failed,
    successRate: executions.length > 0 ? Math.round((successful / executions.length) * 100) : 0,
    totalWorkflows: workflowRes.count ?? 0,
    recentExecutions: executions.slice(0, 8).map((e) => ({
      id: e.id,
      workflowName: e.workflow_name ?? "Unnamed",
      status: e.status,
      retryCount: e.retry_count ?? 0,
      startedAt: e.started_at,
      completedAt: e.completed_at,
      executionTimeMs: e.observations?.executionTimeMs ?? null,
    })),
    failurePatterns: (memoryRes.data ?? []).map((m) => {
      const v = m.value as Record<string, unknown>;
      return {
        key: m.key,
        failure: String(v.failure ?? ""),
        solution: String(v.solution ?? ""),
        learnedAt: Number(v.learnedAt ?? 0),
      };
    }),
    scheduledWorkflows: (scheduleRes.data ?? []).map((s) => ({
      workflowName: s.workflow_name,
      frequency: s.frequency,
      nextRun: s.next_run,
    })),
    activityLast7Days,
  };

  return NextResponse.json(stats);
}
