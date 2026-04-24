import Link from "next/link";

const FEATURES = [
  {
    icon: "⚡",
    title: "Goal-driven automation",
    body: "Describe what you want in plain language. FlowMind interprets intent, plans steps, selects tools, and executes — no configuration required.",
  },
  {
    icon: "🔁",
    title: "Self-healing workflows",
    body: "When a step fails, the Reflection engine diagnoses the cause, patches the workflow, and retries automatically — up to twice per run.",
  },
  {
    icon: "🧠",
    title: "Learns over time",
    body: "Every failure pattern is stored in long-term memory. The agent applies past fixes to future runs without being told.",
  },
  {
    icon: "🔌",
    title: "9 integrations out of the box",
    body: "Notion, Gmail, Slack, Stripe, HubSpot, Airtable, Google Sheets, Google Calendar, Resend — connect once, use everywhere.",
  },
  {
    icon: "📤",
    title: "Export to any platform",
    body: "Every workflow can be exported as n8n JSON, Make.com scenario, or Zapier Zap — so you own your automations.",
  },
  {
    icon: "🔒",
    title: "Fully isolated per account",
    body: "Your workflows, API keys, and memory are scoped to your account with row-level security. No shared data.",
  },
];

const STEPS = [
  { n: "01", title: "Connect your tools", body: "Add your API keys once in the Settings panel. They're stored encrypted to your account — never in the browser." },
  { n: "02", title: "Describe your goal", body: "Type what you want to automate. The agent interprets intent, plans the steps, selects the right tools, and builds the workflow." },
  { n: "03", title: "Watch it execute", body: "The agent runs each step, observes results, reflects on failures, and self-heals — all in real time." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "#050508", color: "#e2e8f0" }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}
          >
            <span style={{ fontSize: 14 }}>⚡</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>FlowMind AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="text-sm px-4 py-1.5 rounded-lg transition-all"
            style={{ color: "#94a3b8" }}
          >
            Sign in
          </Link>
          <Link
            href="/auth?mode=signup"
            className="text-sm px-4 py-2 rounded-lg font-medium transition-all"
            style={{ background: "rgba(124,58,237,0.85)", color: "#fff", border: "1px solid rgba(124,58,237,0.4)" }}
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-20 pb-24 max-w-4xl mx-auto">
        <div
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-8"
          style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", color: "#a78bfa" }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#7c3aed" }} />
          Autonomous Operations Agent
        </div>

        <h1 className="text-5xl font-bold leading-tight mb-6" style={{ color: "#f1f5f9" }}>
          The AI that runs your{" "}
          <span style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            entire operations layer
          </span>
        </h1>

        <p className="text-lg mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: "#64748b" }}>
          Describe what you want to automate. FlowMind builds the workflow, executes it, and self-heals when things go wrong — no specialists required.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/auth?mode=signup"
            className="px-8 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)", color: "#fff", boxShadow: "0 0 32px rgba(124,58,237,0.35)" }}
          >
            Start automating free
          </Link>
          <Link
            href="/auth"
            className="px-8 py-3 rounded-xl text-sm font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "#94a3b8", border: "1px solid #1a1a2e" }}
          >
            Sign in to your account
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest mb-10 text-center" style={{ color: "#334155" }}>
          How it works
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl p-6"
              style={{ background: "#0d0d12", border: "1px solid #1a1a2e" }}
            >
              <span className="text-xs font-bold mb-3 block" style={{ color: "#7c3aed" }}>{s.n}</span>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "#e2e8f0" }}>{s.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest mb-10 text-center" style={{ color: "#334155" }}>
          What it does
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-5"
              style={{ background: "#0d0d12", border: "1px solid #1a1a2e" }}
            >
              <span className="text-xl mb-3 block">{f.icon}</span>
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#e2e8f0" }}>{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center max-w-2xl mx-auto">
        <div
          className="rounded-2xl p-10"
          style={{ background: "#0d0d12", border: "1px solid rgba(124,58,237,0.2)" }}
        >
          <h2 className="text-2xl font-bold mb-3" style={{ color: "#f1f5f9" }}>
            Ready to automate everything?
          </h2>
          <p className="text-sm mb-8" style={{ color: "#475569" }}>
            Create your account and connect your first integration in under 2 minutes.
          </p>
          <Link
            href="/auth?mode=signup"
            className="inline-block px-8 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)", color: "#fff", boxShadow: "0 0 32px rgba(124,58,237,0.3)" }}
          >
            Create free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center" style={{ borderTop: "1px solid #1a1a2e" }}>
        <p className="text-xs" style={{ color: "#1e293b" }}>
          FlowMind AI — Autonomous Operations Agent
        </p>
      </footer>
    </div>
  );
}
