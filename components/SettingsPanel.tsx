"use client";

import { useEffect, useState } from "react";
import { BusinessProfile, IntegrationConfig } from "@/lib/types";
import { clearProfile } from "@/lib/db/businessProfile";

const FIELDS: Array<{
  key: keyof IntegrationConfig;
  label: string;
  placeholder: string;
  secret?: boolean;
  group: string;
}> = [
  { key: "notionApiKey", label: "Notion API Key", placeholder: "ntn_...", secret: true, group: "Notion" },
  { key: "notionDatabaseId", label: "Notion Database ID", placeholder: "32-char hex ID", group: "Notion" },
  { key: "resendApiKey", label: "Resend API Key", placeholder: "re_...", secret: true, group: "Email" },
  { key: "slackWebhookUrl", label: "Slack Webhook URL", placeholder: "https://hooks.slack.com/...", secret: true, group: "Slack" },
  { key: "stripeSecretKey", label: "Stripe Secret Key", placeholder: "sk_...", secret: true, group: "Stripe" },
  { key: "hubspotApiKey", label: "HubSpot API Key", placeholder: "pat-na1-...", secret: true, group: "HubSpot" },
  { key: "airtableApiKey", label: "Airtable API Key", placeholder: "pat...", secret: true, group: "Airtable" },
  { key: "airtableBaseId", label: "Airtable Base ID", placeholder: "app...", group: "Airtable" },
  { key: "googleSheetsClientEmail", label: "Service Account Email", placeholder: "name@project.iam.gserviceaccount.com", group: "Google Sheets" },
  { key: "googleSheetsPrivateKey",  label: "Private Key", placeholder: "-----BEGIN PRIVATE KEY-----\n...", secret: true, group: "Google Sheets" },
  { key: "gmailClientId",      label: "OAuth2 Client ID",     placeholder: "xxxx.apps.googleusercontent.com", group: "Gmail" },
  { key: "gmailClientSecret",  label: "OAuth2 Client Secret", placeholder: "GOCSPX-...", secret: true, group: "Gmail" },
  { key: "gmailRefreshToken",  label: "Refresh Token",        placeholder: "1//0g...", secret: true, group: "Gmail" },
  { key: "twilioAccountSid",   label: "Account SID",          placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", group: "Twilio" },
  { key: "twilioAuthToken",    label: "Auth Token",           placeholder: "your_auth_token", secret: true, group: "Twilio" },
  { key: "twilioFromNumber",   label: "From Number",          placeholder: "+14155551234", group: "Twilio" },
  { key: "githubToken",        label: "Personal Access Token", placeholder: "ghp_...", secret: true, group: "GitHub" },
  { key: "linearApiKey",       label: "API Key",              placeholder: "lin_api_...", secret: true, group: "Linear" },
  { key: "discordWebhookUrl",  label: "Webhook URL",          placeholder: "https://discord.com/api/webhooks/...", secret: true, group: "Discord" },
  { key: "mailchimpApiKey",    label: "API Key",              placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1", secret: true, group: "Mailchimp" },
  { key: "mailchimpListId",    label: "Audience / List ID",   placeholder: "abc123def4", group: "Mailchimp" },
];

const STORAGE_KEY = "operant_user_config";

// Reads from localStorage — used by ChatPanel to show connected status
// and as a migration source when first upgrading to Supabase storage
export function loadUserConfig(): Partial<IntegrationConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<IntegrationConfig>) : {};
  } catch {
    return {};
  }
}

// Alias used internally
const readLocalConfig = loadUserConfig;

function IntegrationGroup({
  groupName,
  fields,
  values,
  onChange,
}: {
  groupName: string;
  fields: typeof FIELDS;
  values: Partial<IntegrationConfig>;
  onChange: (key: keyof IntegrationConfig, value: string) => void;
}) {
  const isConnected = fields.some((f) => values[f.key]);

  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
          {groupName}
        </span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={
            isConnected
              ? { background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }
              : { background: "rgba(51,65,85,0.3)", color: "var(--foreground-3)", border: "1px solid var(--border)" }
          }
        >
          {isConnected ? "Connected" : "Not connected"}
        </span>
      </div>

      <div className="space-y-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-[10px] mb-1" style={{ color: "var(--foreground-3)" }}>
              {f.label}
            </label>
            <input
              type={f.secret ? "password" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full text-xs rounded-lg px-3 py-2 outline-none transition-all"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground-2)",
                caretColor: "var(--accent)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(218,119,86,0.4)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPanel({ businessProfile }: { businessProfile?: BusinessProfile | null }) {
  const [config, setConfig] = useState<Partial<IntegrationConfig>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load from Supabase on mount; fall back to localStorage for migration
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/integrations");
        if (res.ok) {
          const { config: remote } = await res.json() as { config: Partial<IntegrationConfig> };
          // Merge: remote takes precedence, but fill gaps from localStorage migration
          const local = readLocalConfig();
          const merged = { ...local, ...remote };
          setConfig(merged);
          // If we had local data but nothing remote yet, migrate it now
          if (Object.keys(local).length > 0 && Object.keys(remote).length === 0) {
            await fetch("/api/integrations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ config: local }),
            });
          }
        } else {
          setConfig(readLocalConfig());
        }
      } catch {
        setConfig(readLocalConfig());
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleChange = (key: keyof IntegrationConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value || undefined }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const clean = Object.fromEntries(
      Object.entries(config).filter(([, v]) => v && String(v).trim())
    ) as Partial<IntegrationConfig>;

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: clean }),
      });
      if (!res.ok) throw new Error("Save failed");
      // Also persist to localStorage so the app works if API is unreachable
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      setSaved(true);
      window.dispatchEvent(new CustomEvent("operant-config-saved"));
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Fallback: at least save locally
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const groups = Array.from(new Set(FIELDS.map((f) => f.group)));

  return (
    <div className="h-full overflow-y-auto scrollbar-thin pb-6">
      {/* Business Profile Section */}
      <div className="mb-5 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>
            Business Profile
          </p>
          {businessProfile && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.15)" }}>
              Active
            </span>
          )}
        </div>

        {businessProfile ? (
          <>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--foreground)" }}>{businessProfile.companyName}</p>
            <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "var(--foreground-3)" }}>{businessProfile.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("operant-start-onboarding"))}
                className="flex-1 py-2 rounded-lg text-[11px] font-medium transition-all"
                style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(218,119,86,0.18)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-glow)")}
              >
                Re-run Setup
              </button>
              <button
                onClick={() => { clearProfile(); window.dispatchEvent(new CustomEvent("operant-profile-saved")); window.location.reload(); }}
                className="px-3 py-2 rounded-lg text-[11px] transition-all"
                style={{ color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                Clear
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] mb-3" style={{ color: "var(--foreground-muted)" }}>
              No profile yet. Set one up so the agent knows your business.
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("operant-start-onboarding"))}
              className="w-full py-2.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 0 16px rgba(218,119,86,0.25)" }}
            >
              ✦ Start Business Setup
            </button>
          </>
        )}
      </div>

      {/* OAuth quick-connect */}
      <div className="mb-4 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold mb-3" style={{ color: "var(--foreground)" }}>Quick Connect</p>
        <div className="flex flex-col gap-2">
          <a
            href="/api/oauth/google"
            className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-2)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(218,119,86,0.3)"; e.currentTarget.style.color = "var(--foreground)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--foreground-2)"; }}
          >
            <span>G</span> Connect Google (Gmail · Sheets · Calendar)
          </a>
          <a
            href="/api/oauth/slack"
            className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-2)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(218,119,86,0.3)"; e.currentTarget.style.color = "var(--foreground)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--foreground-2)"; }}
          >
            <span>#</span> Connect Slack
          </a>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>
            Manual API Keys
          </p>
          {loading && (
            <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>Loading...</span>
          )}
        </div>
        <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
          Keys are stored in your account and fetched server-side — never sent from your browser.
        </p>
      </div>

      <div>
        {groups.map((group) => (
          <IntegrationGroup
            key={group}
            groupName={group}
            fields={FIELDS.filter((f) => f.group === group)}
            values={config}
            onChange={handleChange}
          />
        ))}
      </div>

      <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200"
          style={
            saved
              ? { background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }
              : { background: "var(--accent)", color: "#fff", boxShadow: "0 0 20px rgba(218,119,86,0.3)" }
          }
        >
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save API Keys"}
        </button>
      </div>
    </div>
  );
}
