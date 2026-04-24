import { createClient } from "@/lib/supabase/server";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface CustomToolParam {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

export interface CustomTool {
  id: string;
  userId: string;
  name: string;          // snake_case tool name, e.g. "my_crm_create"
  description: string;
  httpUrl: string;
  httpMethod: HttpMethod;
  headers: Record<string, string>;
  params: CustomToolParam[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

function rowToTool(row: Record<string, unknown>): CustomTool {
  return {
    id:          row.id as string,
    userId:      row.user_id as string,
    name:        row.name as string,
    description: row.description as string,
    httpUrl:     row.http_url as string,
    httpMethod:  row.http_method as HttpMethod,
    headers:     (row.headers as Record<string, string>) ?? {},
    params:      (row.params as CustomToolParam[]) ?? [],
    enabled:     row.enabled as boolean,
    createdAt:   new Date(row.created_at as string).getTime(),
    updatedAt:   new Date(row.updated_at as string).getTime(),
  };
}

export async function listCustomTools(userId: string): Promise<CustomTool[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_tools")
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToTool);
}

export async function listAllCustomTools(userId: string): Promise<CustomTool[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_tools")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToTool);
}

export async function createCustomTool(
  userId: string,
  tool: Omit<CustomTool, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<CustomTool> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_tools")
    .insert({
      user_id:     userId,
      name:        tool.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      description: tool.description,
      http_url:    tool.httpUrl,
      http_method: tool.httpMethod,
      headers:     tool.headers,
      params:      tool.params,
      enabled:     tool.enabled,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToTool(data);
}

export async function updateCustomTool(
  id: string,
  userId: string,
  patch: Partial<Omit<CustomTool, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<void> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined)        updates.name        = patch.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.httpUrl !== undefined)     updates.http_url    = patch.httpUrl;
  if (patch.httpMethod !== undefined)  updates.http_method = patch.httpMethod;
  if (patch.headers !== undefined)     updates.headers     = patch.headers;
  if (patch.params !== undefined)      updates.params      = patch.params;
  if (patch.enabled !== undefined)     updates.enabled     = patch.enabled;
  updates.updated_at = new Date().toISOString();
  await supabase.from("custom_tools").update(updates).eq("id", id).eq("user_id", userId);
}

export async function deleteCustomTool(id: string, userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("custom_tools").delete().eq("id", id).eq("user_id", userId);
}

// Execute a custom tool call by making an HTTP request
export async function executeCustomTool(
  tool: CustomTool,
  input: Record<string, unknown>
): Promise<string> {
  const url = tool.httpUrl;
  const isGet = tool.httpMethod === "GET";

  const resolvedUrl = isGet
    ? url + (url.includes("?") ? "&" : "?") + new URLSearchParams(
        Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v)]))
      ).toString()
    : url;

  const res = await fetch(resolvedUrl, {
    method: tool.httpMethod,
    headers: {
      "Content-Type": "application/json",
      ...tool.headers,
    },
    body: isGet ? undefined : JSON.stringify(input),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return text;
}
