import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// List all webhooks for the authenticated user
export async function GET(): Promise<NextResponse> {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("webhooks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ webhooks: data ?? [] });
}

// Create a new webhook for a workflow
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workflowName } = await req.json() as { workflowName: string };
  if (!workflowName) return NextResponse.json({ error: "workflowName is required" }, { status: 400 });

  // Verify the workflow exists
  const { data: workflow } = await supabase
    .from("workflows")
    .select("name")
    .eq("user_id", user.id)
    .eq("name", workflowName)
    .single();

  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("webhooks")
    .upsert({
      user_id: user.id,
      workflow_name: workflowName,
      enabled: true,
      trigger_count: 0,
    }, { onConflict: "user_id,workflow_name" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhook: data });
}

// Delete a webhook
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  await supabase.from("webhooks").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
