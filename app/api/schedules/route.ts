import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listSchedulesForUser, createScheduleDB } from "@/lib/db/schedules-server";
import type { ScheduleFrequency } from "@/lib/db/schedules";
import type { WorkflowBlueprint } from "@/lib/export/n8n";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const schedules = await listSchedulesForUser(user.id);
  return NextResponse.json(schedules);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workflowId, blueprint, frequency } = await req.json() as {
    workflowId: string;
    blueprint: WorkflowBlueprint;
    frequency: ScheduleFrequency;
  };

  const schedule = await createScheduleDB(user.id, workflowId, blueprint, frequency);
  return NextResponse.json(schedule);
}
