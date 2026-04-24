const ENDPOINT = "https://api.linear.app/graphql";

async function query(apiKey: string, gql: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: gql, variables }),
  });
  const json = await res.json() as { data?: unknown; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

export async function createIssue(
  apiKey: string,
  title: string,
  description?: string,
  teamId?: string,
  priority?: number
): Promise<string> {
  // If no teamId provided, fetch the first team
  let tid = teamId;
  if (!tid) {
    const teamsData = await query(apiKey, `{ teams { nodes { id name } } }`) as { teams: { nodes: Array<{ id: string; name: string }> } };
    if (!teamsData.teams.nodes.length) throw new Error("No teams found in your Linear workspace.");
    tid = teamsData.teams.nodes[0].id;
  }

  const data = await query(
    apiKey,
    `mutation CreateIssue($title: String!, $description: String, $teamId: String!, $priority: Int) {
      issueCreate(input: { title: $title, description: $description, teamId: $teamId, priority: $priority }) {
        success
        issue { id identifier title url }
      }
    }`,
    { title, description, teamId: tid, priority }
  ) as { issueCreate: { success: boolean; issue: { identifier: string; title: string; url: string } } };

  const issue = data.issueCreate.issue;
  return `Linear issue created: ${issue.identifier} "${issue.title}" — ${issue.url}`;
}

export async function listIssues(
  apiKey: string,
  limit = 10,
  teamId?: string
): Promise<string> {
  const filter = teamId ? `(filter: { team: { id: { eq: "${teamId}" } } })` : "";
  const data = await query(
    apiKey,
    `{ issues${filter} { nodes { identifier title state { name } assignee { name } url } } }`
  ) as { issues: { nodes: Array<{ identifier: string; title: string; state: { name: string }; assignee: { name: string } | null; url: string }> } };

  const issues = data.issues.nodes.slice(0, limit);
  if (!issues.length) return "No Linear issues found.";
  return issues
    .map((i) => `${i.identifier} [${i.state.name}] ${i.title}${i.assignee ? ` — ${i.assignee.name}` : ""}\n  ${i.url}`)
    .join("\n");
}
