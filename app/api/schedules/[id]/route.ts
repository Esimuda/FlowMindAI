import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateScheduleDB, deleteScheduleDB, getScheduleEnabledState } from "@/lib/db/schedules-server";
import type { ScheduleFrequency } from "@/lib/db/schedules";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { toggle?: boolean; enabled?: boolean; frequency?: ScheduleFrequency };

  if (body.toggle) {
    const current = await getScheduleEnabledState(params.id, user.id);
    if (current === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await updateScheduleDB(params.id, { enabled: !current });
  } else {
    await updateScheduleDB(params.id, body);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteScheduleDB(params.id);
  return NextResponse.json({ ok: true });
}
