const BASE = "https://api.github.com";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export async function createIssue(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[]
): Promise<string> {
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ title, body, labels }),
  });
  const data = await res.json() as { number?: number; html_url?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? `GitHub error ${res.status}`);
  return `Issue #${data.number} created: ${data.html_url}`;
}

export async function listIssues(
  token: string,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
  limit = 10
): Promise<string> {
  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/issues?state=${state}&per_page=${Math.min(limit, 25)}`,
    { headers: headers(token) }
  );
  const data = await res.json() as Array<{ number: number; title: string; state: string; html_url: string }> | { message?: string };
  if (!res.ok) throw new Error((data as { message?: string }).message ?? `GitHub error ${res.status}`);
  const issues = data as Array<{ number: number; title: string; state: string; html_url: string }>;
  if (issues.length === 0) return `No ${state} issues found in ${owner}/${repo}.`;
  return issues.map((i) => `#${i.number} [${i.state}] ${i.title} — ${i.html_url}`).join("\n");
}

export async function listRepos(token: string, limit = 10): Promise<string> {
  const res = await fetch(
    `${BASE}/user/repos?per_page=${Math.min(limit, 25)}&sort=updated`,
    { headers: headers(token) }
  );
  const data = await res.json() as Array<{ full_name: string; description: string | null; private: boolean; html_url: string }> | { message?: string };
  if (!res.ok) throw new Error((data as { message?: string }).message ?? `GitHub error ${res.status}`);
  const repos = data as Array<{ full_name: string; description: string | null; private: boolean; html_url: string }>;
  if (repos.length === 0) return "No repositories found.";
  return repos
    .map((r) => `${r.full_name} (${r.private ? "private" : "public"}) — ${r.description ?? "no description"}`)
    .join("\n");
}
