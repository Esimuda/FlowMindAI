import { IntegrationConfig } from "@/lib/types";

export interface IntegrationMeta {
  name: string;
  tools: string[];
  isConnected: (config: IntegrationConfig) => boolean;
}

export const INTEGRATION_META: IntegrationMeta[] = [
  {
    name: "Notion",
    tools: ["notion_create_database", "notion_create_page", "notion_query_database"],
    isConnected: (c) => !!c.notionApiKey,
  },
  {
    name: "Email",
    tools: ["send_email"],
    isConnected: (c) => !!c.resendApiKey,
  },
  {
    name: "Slack",
    tools: ["slack_send_message"],
    isConnected: (c) => !!c.slackWebhookUrl,
  },
  {
    name: "Stripe",
    tools: ["stripe_list_customers", "stripe_list_charges"],
    isConnected: (c) => !!c.stripeSecretKey,
  },
  {
    name: "HubSpot",
    tools: ["hubspot_create_contact", "hubspot_search_contacts"],
    isConnected: (c) => !!c.hubspotApiKey,
  },
  {
    name: "Airtable",
    tools: ["airtable_create_record", "airtable_list_records"],
    isConnected: (c) => !!c.airtableApiKey && !!c.airtableBaseId,
  },
  {
    name: "Google Sheets",
    tools: ["sheets_read_rows", "sheets_append_row", "sheets_find_rows"],
    isConnected: (c) => !!c.googleSheetsClientEmail && !!c.googleSheetsPrivateKey,
  },
  {
    name: "Gmail",
    tools: ["gmail_send_email", "gmail_search_emails", "gmail_read_email"],
    isConnected: (c) => !!c.gmailClientId && !!c.gmailClientSecret && !!c.gmailRefreshToken,
  },
  {
    name: "Google Calendar",
    tools: ["calendar_list_events", "calendar_create_event"],
    isConnected: (c) => !!c.gmailClientId && !!c.gmailClientSecret && !!c.gmailRefreshToken,
  },
  {
    name: "Twilio",
    tools: ["twilio_send_sms", "twilio_send_whatsapp"],
    isConnected: (c) => !!c.twilioAccountSid && !!c.twilioAuthToken,
  },
  {
    name: "GitHub",
    tools: ["github_create_issue", "github_list_issues", "github_list_repos"],
    isConnected: (c) => !!c.githubToken,
  },
  {
    name: "Linear",
    tools: ["linear_create_issue", "linear_list_issues"],
    isConnected: (c) => !!c.linearApiKey,
  },
  {
    name: "Discord",
    tools: ["discord_send_message"],
    isConnected: (c) => !!c.discordWebhookUrl,
  },
  {
    name: "Mailchimp",
    tools: ["mailchimp_add_contact", "mailchimp_list_contacts", "mailchimp_list_audiences"],
    isConnected: (c) => !!c.mailchimpApiKey,
  },
];

export function getConnectedIntegrations(config: IntegrationConfig): IntegrationMeta[] {
  return INTEGRATION_META.filter((m) => m.isConnected(config));
}
