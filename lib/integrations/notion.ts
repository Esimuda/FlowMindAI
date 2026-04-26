import { Client } from "@notionhq/client";

// Pin to the stable 2022-06-28 API version so all standard endpoints work
// regardless of the SDK's default version (v5 defaults to 2025-09-03 which
// replaced several endpoints and broke backwards compatibility).
function client(apiKey: string) {
  return new Client({ auth: apiKey, notionVersion: "2022-06-28" } as ConstructorParameters<typeof Client>[0]);
}

// Extracts a clean 32-char hex UUID from whatever the user pasted (full URL, with dashes, etc.)
function sanitizeId(raw: string): string {
  const hex = raw.replace(/[^0-9a-f]/gi, "");
  if (hex.length !== 32) {
    throw new Error(
      `Invalid Notion ID "${raw.slice(0, 80)}": expected a 32-character hex ID. Copy the ID from your Notion database URL or the Settings panel.`
    );
  }
  return hex;
}

export async function searchPages(apiKey: string): Promise<string> {
  const notion = client(apiKey);

  const response = await notion.request<{
    results: Array<{ id: string; object: string; properties?: Record<string, unknown>; title?: Array<{ plain_text: string }> }>;
  }>({
    path: "search",
    method: "post",
    body: { filter: { property: "object", value: "page" }, page_size: 10 },
  });

  if (response.results.length === 0) {
    return "No pages found. Make sure at least one Notion page is shared with your integration.";
  }

  const pages = response.results.map((p) => {
    const titleArr = p.title ?? (p.properties?.title as { title: Array<{ plain_text: string }> } | undefined)?.title ?? [];
    const name = titleArr.map((t) => t.plain_text).join("") || "Untitled";
    return `${name} (id: ${p.id.replace(/-/g, "")})`;
  });

  return `Accessible pages:\n${pages.join("\n")}\n\nUse one of these IDs as parent_page_id when creating a database.`;
}

export async function createDatabase(
  apiKey: string,
  title: string,
  columns: Record<string, "rich_text" | "email" | "number" | "select" | "date" | "checkbox" | "url" | "phone_number">,
  parentPageId?: string
): Promise<string> {
  const notion = client(apiKey);

  const properties: Record<string, unknown> = {
    Name: { title: {} },
  };
  for (const [name, type] of Object.entries(columns)) {
    if (name === "Name") continue;
    properties[name] = { [type]: {} };
  }

  const parent: Record<string, unknown> =
    parentPageId && parentPageId.toLowerCase() !== "root" && parentPageId.toLowerCase() !== "workspace"
      ? { page_id: sanitizeId(parentPageId) }
      : { workspace: true };

  const db = await notion.request<{ id: string }>({
    path: "databases",
    method: "post",
    body: {
      parent,
      title: [{ type: "text", text: { content: title } }],
      properties,
    },
  });

  return `Created Notion database: "${title}" (id: ${db.id}). Columns: Name (title), ${Object.keys(columns).join(", ")}.`;
}

export async function createPage(
  apiKey: string,
  databaseId: string,
  title: string,
  properties: Record<string, unknown> = {},
  content?: string
): Promise<string> {
  const notion = client(apiKey);

  const builtProps: Record<string, unknown> = {
    Name: { title: [{ text: { content: title } }] },
  };

  for (const [key, value] of Object.entries(properties)) {
    if (key === "Name") continue;
    if (typeof value === "string") {
      builtProps[key] = { rich_text: [{ text: { content: value } }] };
    } else {
      builtProps[key] = value;
    }
  }

  const children: unknown[] = content
    ? [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content } }] } }]
    : [];

  const page = await notion.pages.create({
    parent: { database_id: sanitizeId(databaseId) },
    properties: builtProps as Parameters<typeof notion.pages.create>[0]["properties"],
    children: children as Parameters<typeof notion.pages.create>[0]["children"],
  });

  return `Created Notion page: "${title}" (id: ${page.id})`;
}

export async function queryDatabase(
  apiKey: string,
  databaseId: string,
  filterProperty?: string,
  filterValue?: string,
  pageSize = 10
): Promise<string> {
  const notion = client(apiKey);
  const cleanId = sanitizeId(databaseId);

  const body: Record<string, unknown> = {
    page_size: Math.min(pageSize, 25),
  };

  if (filterProperty && filterValue) {
    body.filter = {
      property: filterProperty,
      rich_text: { contains: filterValue },
    };
  }

  const response = await notion.request<{
    results: Array<{ id: string; properties: Record<string, unknown> }>;
  }>({
    path: `databases/${cleanId}/query`,
    method: "post",
    body,
  });

  if (response.results.length === 0) {
    return "No records found in the database.";
  }

  const rows = response.results.map((page) => {
    const parts: string[] = [];
    for (const [key, prop] of Object.entries(page.properties)) {
      const p = prop as Record<string, unknown>;
      if (p.type === "title" && Array.isArray(p.title)) {
        const text = (p.title as Array<{ plain_text: string }>).map((t) => t.plain_text).join("");
        parts.push(`${key}: ${text}`);
      } else if (p.type === "rich_text" && Array.isArray(p.rich_text)) {
        const text = (p.rich_text as Array<{ plain_text: string }>).map((t) => t.plain_text).join("");
        if (text) parts.push(`${key}: ${text}`);
      } else if (p.type === "email" && p.email) {
        parts.push(`${key}: ${p.email}`);
      } else if (p.type === "select" && p.select && typeof p.select === "object") {
        parts.push(`${key}: ${(p.select as { name: string }).name}`);
      } else if (p.type === "date" && p.date && typeof p.date === "object") {
        parts.push(`${key}: ${(p.date as { start: string }).start}`);
      }
    }
    return parts.join(" | ");
  });

  return `Found ${response.results.length} records:\n${rows.join("\n")}`;
}
