import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/workspaces/leave — leave a workspace (non-owners only)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await req.json() as { workspaceId: string };
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  // Check the user's role in this workspace
  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!member) return NextResponse.json({ error: "You are not a member of this workspace" }, { status: 404 });
  if (member.role === "owner") {
    return NextResponse.json({ error: "Owners cannot leave their own workspace. Delete it instead." }, { status: 403 });
  }

  await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
