import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listAllCustomTools, createCustomTool, updateCustomTool, deleteCustomTool } from "@/lib/db/customTools";
import type { CustomTool } from "@/lib/db/customTools";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tools = await listAllCustomTools(user.id);
  return NextResponse.json({ tools });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<CustomTool>;

  if (!body.name || !body.description || !body.httpUrl || !body.httpMethod) {
    return NextResponse.json({ error: "name, description, httpUrl, httpMethod are required" }, { status: 400 });
  }

  const tool = await createCustomTool(user.id, {
    name:        body.name,
    description: body.description,
    httpUrl:     body.httpUrl,
    httpMethod:  body.httpMethod,
    headers:     body.headers ?? {},
    params:      body.params ?? [],
    enabled:     body.enabled ?? true,
  });

  return NextResponse.json({ tool }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<CustomTool> & { id: string };
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await updateCustomTool(body.id, user.id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await deleteCustomTool(id, user.id);
  return NextResponse.json({ ok: true });
}
