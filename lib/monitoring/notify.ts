import type { WorkflowAlert } from "@/lib/db/alerts";

interface NotifyPayload {
  workflowName: string;
  status: "success" | "failure";
  runId: string;
  summary: string;
  succeededSteps: number;
  failedSteps: number;
  durationMs: number;
}

export async function sendAlertNotification(
  alert: WorkflowAlert,
  payload: NotifyPayload
): Promise<void> {
  if (!alert.enabled) return;
  if (alert.event === "success" && payload.status !== "success") return;
  if (alert.event === "failure" && payload.status !== "failure") return;

  if (alert.channel === "slack") {
    await sendSlackAlert(alert.destination, payload);
  } else if (alert.channel === "email") {
    await sendEmailAlert(alert.destination, payload);
  }
}

async function sendSlackAlert(webhookUrl: string, payload: NotifyPayload): Promise<void> {
  const icon = payload.status === "success" ? "✅" : "❌";
  const color = payload.status === "success" ? "#22c55e" : "#ef4444";
  const duration =
    payload.durationMs < 1000
      ? `${payload.durationMs}ms`
      : `${(payload.durationMs / 1000).toFixed(1)}s`;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attachments: [
        {
          color,
          title: `${icon} Workflow ${payload.status === "success" ? "Succeeded" : "Failed"}: ${payload.workflowName}`,
          text: payload.summary,
          fields: [
            { title: "Succeeded Steps", value: String(payload.succeededSteps), short: true },
            { title: "Failed Steps", value: String(payload.failedSteps), short: true },
            { title: "Duration", value: duration, short: true },
            { title: "Run ID", value: payload.runId.slice(0, 12), short: true },
          ],
          footer: "Operant AI Monitoring",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }),
  });
}

async function sendEmailAlert(email: string, payload: NotifyPayload): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const icon = payload.status === "success" ? "✅" : "❌";
  const duration =
    payload.durationMs < 1000
      ? `${payload.durationMs}ms`
      : `${(payload.durationMs / 1000).toFixed(1)}s`;

  const subject = `${icon} [Operant AI] ${payload.workflowName} ${payload.status === "success" ? "completed" : "failed"}`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 8px;color:${payload.status === "success" ? "#22c55e" : "#ef4444"}">
        ${icon} Workflow ${payload.status === "success" ? "Completed" : "Failed"}
      </h2>
      <p style="font-size:18px;font-weight:600;margin:0 0 16px;color:#1e293b">${payload.workflowName}</p>
      <p style="color:#475569;margin:0 0 16px">${payload.summary}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:8px;background:#f8fafc;color:#64748b;font-size:13px">Succeeded Steps</td>
            <td style="padding:8px;font-weight:600;color:#22c55e">${payload.succeededSteps}</td></tr>
        <tr><td style="padding:8px;color:#64748b;font-size:13px">Failed Steps</td>
            <td style="padding:8px;font-weight:600;color:${payload.failedSteps > 0 ? "#ef4444" : "#22c55e"}">${payload.failedSteps}</td></tr>
        <tr><td style="padding:8px;background:#f8fafc;color:#64748b;font-size:13px">Duration</td>
            <td style="padding:8px;font-weight:600">${duration}</td></tr>
        <tr><td style="padding:8px;color:#64748b;font-size:13px">Run ID</td>
            <td style="padding:8px;font-family:monospace;font-size:12px;color:#94a3b8">${payload.runId}</td></tr>
      </table>
      <p style="font-size:12px;color:#94a3b8">Sent by <a href="https://operant-ai.vercel.app" style="color:#7c3aed">Operant AI</a></p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Operant AI <alerts@operant-ai.vercel.app>",
      to: [email],
      subject,
      html,
    }),
  });
}
