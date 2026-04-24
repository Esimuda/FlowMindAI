function serverFromKey(apiKey: string): string {
  const parts = apiKey.split("-");
  return parts[parts.length - 1] ?? "us1";
}

function base(apiKey: string) {
  return `https://${serverFromKey(apiKey)}.api.mailchimp.com/3.0`;
}

function headers(apiKey: string) {
  return {
    Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

export async function addContact(
  apiKey: string,
  listId: string,
  email: string,
  firstName?: string,
  lastName?: string,
  tags?: string[]
): Promise<string> {
  const body: Record<string, unknown> = {
    email_address: email,
    status: "subscribed",
  };
  if (firstName || lastName) {
    body.merge_fields = { FNAME: firstName ?? "", LNAME: lastName ?? "" };
  }
  if (tags?.length) body.tags = tags;

  const res = await fetch(`${base(apiKey)}/lists/${listId}/members`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });
  const data = await res.json() as { id?: string; email_address?: string; status?: string; title?: string; detail?: string };
  if (!res.ok) {
    if (data.title === "Member Exists") return `Contact ${email} already exists in the list.`;
    throw new Error(data.detail ?? `Mailchimp error ${res.status}`);
  }
  return `Contact ${data.email_address} added to list. Status: ${data.status}`;
}

export async function listContacts(
  apiKey: string,
  listId: string,
  limit = 10
): Promise<string> {
  const res = await fetch(
    `${base(apiKey)}/lists/${listId}/members?count=${Math.min(limit, 25)}&sort_field=last_changed&sort_dir=DESC`,
    { headers: headers(apiKey) }
  );
  const data = await res.json() as { members?: Array<{ email_address: string; status: string; full_name: string }>; title?: string; detail?: string };
  if (!res.ok) throw new Error(data.detail ?? `Mailchimp error ${res.status}`);
  const members = data.members ?? [];
  if (!members.length) return "No contacts found in this list.";
  return members.map((m) => `${m.full_name || "(no name)"} <${m.email_address}> [${m.status}]`).join("\n");
}

export async function listAudiences(apiKey: string): Promise<string> {
  const res = await fetch(`${base(apiKey)}/lists?count=25`, { headers: headers(apiKey) });
  const data = await res.json() as { lists?: Array<{ id: string; name: string; stats: { member_count: number } }>; detail?: string };
  if (!res.ok) throw new Error(data.detail ?? `Mailchimp error ${res.status}`);
  const lists = data.lists ?? [];
  if (!lists.length) return "No Mailchimp audiences found.";
  return lists.map((l) => `${l.name} (ID: ${l.id}) — ${l.stats.member_count} members`).join("\n");
}
