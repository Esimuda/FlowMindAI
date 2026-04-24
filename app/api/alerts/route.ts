import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveAlert, listAlerts, deleteAlert, toggleAlert } from "@/lib/db/alerts";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await listAlerts(user.id);
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    workflowId: string;
    workflowName: string;
    channel: "email" | "slack";
    destination: string;
    event: "failure" | "success" | "all";
  };

  if (!body.workflowId || !body.channel || !body.destination || !body.event) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const alert = await saveAlert({
    userId: user.id,
    workflowId: body.workflowId,
    workflowName: body.workflowName,
    channel: body.channel,
    destination: body.destination,
    event: body.event,
    enabled: true,
  });

  return NextResponse.json({ alert }, { status: 201 });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await deleteAlert(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, enabled } = await req.json() as { id: string; enabled: boolean };
  if (!id || enabled === undefined) return NextResponse.json({ error: "Missing id or enabled" }, { status: 400 });

  await toggleAlert(id, enabled);
  return NextResponse.json({ ok: true });
}
