import { WorkflowBlueprint } from "./n8n";

interface ZapierTrigger {
  app: string;
  event: string;
}

interface ZapierAction {
  step: number;
  app: string;
  action: string;
  note: string;
  suggested_fields: Record<string, string>;
}

interface ZapierExport {
  zap_name: string;
  description: string;
  trigger: ZapierTrigger;
  actions: ZapierAction[];
  setup_instructions: string[];
  generated_by: string;
}

const TRIGGER_MAP: Array<{ keywords: string[]; trigger: ZapierTrigger }> = [
  { keywords: ["typeform", "form submission", "form fill"], trigger: { app: "Typeform", event: "New Entry" } },
  { keywords: ["webhook", "http", "api call"],             trigger: { app: "Webhooks by Zapier", event: "Catch Hook" } },
  { keywords: ["stripe", "payment", "charge", "customer"], trigger: { app: "Stripe", event: "New Customer" } },
  { keywords: ["shopify", "order", "purchase"],            trigger: { app: "Shopify", event: "New Order" } },
  { keywords: ["schedule", "every", "daily", "weekly", "monday", "cron"], trigger: { app: "Schedule by Zapier", event: "Every Day" } },
  { keywords: ["email", "gmail", "inbox"],                 trigger: { app: "Gmail", event: "New Email" } },
  { keywords: ["slack", "message"],                        trigger: { app: "Slack", event: "New Message" } },
  { keywords: ["airtable"],                                trigger: { app: "Airtable", event: "New Record" } },
  { keywords: ["notion"],                                  trigger: { app: "Notion", event: "New Database Item" } },
  { keywords: ["hubspot", "crm", "lead", "contact"],      trigger: { app: "HubSpot", event: "New Contact" } },
];

const ACTION_MAP: Array<{ keywords: string[]; app: string; action: string; fields: Record<string, string> }> = [
  {
    keywords: ["notion", "database", "record", "page"],
    app: "Notion", action: "Create Database Item",
    fields: { Database: "(select your database)", Name: "{{trigger.name}}", Email: "{{trigger.email}}" },
  },
  {
    keywords: ["email", "send email", "resend", "gmail", "welcome email", "notification"],
    app: "Gmail", action: "Send Email",
    fields: { To: "{{trigger.email}}", Subject: "(set subject)", Body: "(set body)" },
  },
  {
    keywords: ["slack", "notify", "channel", "message", "alert"],
    app: "Slack", action: "Send Channel Message",
    fields: { Channel: "(select channel)", Message: "(set message text)" },
  },
  {
    keywords: ["stripe", "customer", "payment", "charge"],
    app: "Stripe", action: "Find Customer",
    fields: { Email: "{{trigger.email}}" },
  },
  {
    keywords: ["hubspot", "crm", "contact", "lead"],
    app: "HubSpot", action: "Create Contact",
    fields: { Email: "{{trigger.email}}", Firstname: "{{trigger.first_name}}", Lastname: "{{trigger.last_name}}" },
  },
  {
    keywords: ["airtable", "table", "spreadsheet", "base"],
    app: "Airtable", action: "Create Record",
    fields: { Base: "(select your base)", Table: "(select your table)", Fields: "{{trigger.*}}" },
  },
];

function matchTrigger(triggerText: string): ZapierTrigger {
  const lower = triggerText.toLowerCase();
  for (const { keywords, trigger } of TRIGGER_MAP) {
    if (keywords.some((k) => lower.includes(k))) return trigger;
  }
  return { app: "Webhooks by Zapier", event: "Catch Hook" };
}

function matchAction(step: WorkflowBlueprint["steps"][number]): { app: string; action: string; fields: Record<string, string> } {
  const lower = (step.action + " " + step.tool + " " + step.output).toLowerCase();
  for (const entry of ACTION_MAP) {
    if (entry.keywords.some((k) => lower.includes(k))) {
      return { app: entry.app, action: entry.action, fields: entry.fields };
    }
  }
  return {
    app: "Webhooks by Zapier",
    action: "POST",
    fields: { URL: "(set endpoint URL)", Payload: "{{trigger.*}}" },
  };
}

function buildSetupInstructions(trigger: ZapierTrigger, actions: ZapierAction[]): string[] {
  const steps: string[] = [
    "1. Go to zapier.com and click 'Create Zap'",
    `2. Trigger — Search for '${trigger.app}' and select event: '${trigger.event}'`,
    "3. Connect your account and configure the trigger settings, then test it",
  ];

  actions.forEach((a, i) => {
    steps.push(
      `${i + 4}. Action ${a.step} — Search for '${a.app}' and select action: '${a.action}'`
    );
    const fieldLines = Object.entries(a.suggested_fields)
      .map(([k, v]) => `   • ${k}: ${v}`)
      .join("\n");
    if (fieldLines) steps.push(fieldLines);
  });

  steps.push(`${actions.length + 4}. Name your Zap and turn it on`);
  return steps;
}

export function toZapierJson(workflow: WorkflowBlueprint): string {
  const trigger = matchTrigger(workflow.trigger);

  const actions: ZapierAction[] = workflow.steps.map((s) => {
    const match = matchAction(s);
    return {
      step: s.step,
      app: match.app,
      action: match.action,
      note: s.output,
      suggested_fields: match.fields,
    };
  });

  const output: ZapierExport = {
    zap_name: workflow.name,
    description: workflow.expected_outcome,
    trigger,
    actions,
    setup_instructions: buildSetupInstructions(trigger, actions),
    generated_by: "Operant AI",
  };

  return JSON.stringify(output, null, 2);
}

export function toZapierMarkdown(workflow: WorkflowBlueprint): string {
  const trigger = matchTrigger(workflow.trigger);
  const actions: ZapierAction[] = workflow.steps.map((s) => {
    const match = matchAction(s);
    return { step: s.step, app: match.app, action: match.action, note: s.output, suggested_fields: match.fields };
  });

  const lines: string[] = [
    `# Zapier Setup Guide: ${workflow.name}`,
    ``,
    `> **Generated by Operant AI** — Follow these steps to recreate this workflow in Zapier.`,
    ``,
    `## Overview`,
    `**Goal:** ${workflow.expected_outcome}`,
    `**Trigger:** ${workflow.trigger}`,
    `**Steps:** ${actions.length}`,
    ``,
    `---`,
    ``,
    `## Step-by-Step Setup`,
    ``,
    `### 1. Create a New Zap`,
    `1. Go to [zapier.com](https://zapier.com) and sign in`,
    `2. Click **Create Zap** (or **+ Create** → **Zaps**)`,
    ``,
    `### 2. Configure the Trigger`,
    `1. Click **Trigger** and search for **${trigger.app}**`,
    `2. Select the event: **${trigger.event}**`,
    `3. Click **Continue**, connect your ${trigger.app} account`,
    `4. Configure the trigger settings for: *${workflow.trigger}*`,
    `5. Click **Test trigger** to verify it pulls sample data`,
    `6. Click **Continue**`,
    ``,
  ];

  actions.forEach((action, i) => {
    lines.push(`### ${i + 3}. Action ${action.step}: ${action.app} — ${action.action}`);
    lines.push(`1. Click **Action** → search for **${action.app}**`);
    lines.push(`2. Select action: **${action.action}**`);
    lines.push(`3. Connect your ${action.app} account (if not already connected)`);
    lines.push(`4. Configure the action fields:`);
    lines.push(``);
    Object.entries(action.suggested_fields).forEach(([key, value]) => {
      lines.push(`   | Field | Suggested Value |`);
      lines.push(`   |-------|----------------|`);
      lines.push(`   | **${key}** | \`${value}\` |`);
    });
    lines.push(``);
    lines.push(`   > *Purpose: ${action.note}*`);
    lines.push(`5. Click **Test action** to verify it works correctly`);
    lines.push(`6. Click **Continue**`);
    lines.push(``);
  });

  lines.push(`### ${actions.length + 3}. Activate Your Zap`);
  lines.push(`1. Give your Zap a name: **${workflow.name}**`);
  lines.push(`2. Review all steps are correctly configured`);
  lines.push(`3. Toggle the Zap **ON**`);
  lines.push(`4. Your automation is now live!`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Tips`);
  lines.push(`- Use **Zapier Formatter** to transform data between steps (dates, text, numbers)`);
  lines.push(`- Use **Filter by Zapier** to add conditional logic`);
  lines.push(`- Use **Paths by Zapier** (Business plan) for branching workflows`);
  lines.push(`- Test each action with real data before going live`);
  lines.push(``);
  lines.push(`---`);
  lines.push(`*This guide was generated by [Operant AI](https://operant-ai.vercel.app)*`);

  return lines.join("\n");
}
