import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/workspaces/[id] — delete a workspace (owners only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const { data: ws } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (ws.owner_id !== user.id) return NextResponse.json({ error: "Only the owner can delete a workspace" }, { status: 403 });

  // Delete members first (cascade may handle this, but be explicit)
  await supabase.from("workspace_members").delete().eq("workspace_id", id);
  await supabase.from("workspaces").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
