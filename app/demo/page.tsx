"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const INTEGRATIONS = [
  { name: "Notion", icon: "N" },
  { name: "Slack", icon: "S" },
  { name: "Stripe", icon: "$" },
  { name: "Gmail", icon: "G" },
  { name: "HubSpot", icon: "H" },
  { name: "Sheets", icon: "S" },
  { name: "GitHub", icon: "</>" },
  { name: "Airtable", icon: "A" },
  { name: "Twilio", icon: "T" },
  { name: "Linear", icon: "L" },
  { name: "Discord", icon: "D" },
  { name: "Resend", icon: "R" },
];

const DEMO_WORKFLOW = [
  { stage: "Interpret", desc: "Parsing goal into structured intent", icon: "◎", delay: 0 },
  { stage: "Memory", desc: "Loading relevant past patterns", icon: "⟳", delay: 600 },
  { stage: "Plan", desc: "Breaking goal into dependency steps", icon: "⊞", delay: 1200 },
  { stage: "Select Tools", desc: "Mapping steps → Stripe, Notion, Resend", icon: "⚙", delay: 1800 },
  { stage: "Build Graph", desc: "Synthesising parallel execution DAG", icon: "⬡", delay: 2400 },
  { stage: "Execute", desc: "Running 3 tool calls (1 parallel)", icon: "▶", delay: 3000 },
  { stage: "Observe", desc: "100% success · 2.1s · 3 calls", icon: "✓", delay: 3800 },
  { stage: "Reflect", desc: "No failures. Workflow saved to memory.", icon: "★", delay: 4400 },
];

const TOOL_CALLS = [
  { tool: "stripe_list_customers", status: "success", time: "0.3s", output: "Found customer: sarah@acme.com" },
  { tool: "notion_create_page", status: "success", time: "0.8s", output: "Page created in CRM database" },
  { tool: "resend_send_email", status: "success", time: "0.6s", output: "Welcome email delivered" },
];

const DEMO_PROMPT = "New Stripe customer → add to Notion CRM → send welcome email via Resend";

function useTypewriter(text: string, speed = 38, startDelay = 300) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);
    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);

  return { displayed, done };
}

function PipelineStage({ stage, desc, icon, delay, active }: { stage: string; desc: string; icon: string; delay: number; active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [active, delay]);

  return (
    <div
      className="flex items-start gap-3 transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(6px)" }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 font-mono"
        style={{ background: visible ? "var(--accent-glow)" : "var(--surface-2)", border: "1px solid", borderColor: visible ? "rgba(218,119,86,0.35)" : "var(--border)", color: visible ? "var(--accent)" : "var(--foreground-3)", transition: "all 0.4s" }}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{stage}</div>
        <div className="text-[11px]" style={{ color: "var(--foreground-2)" }}>{desc}</div>
      </div>
    </div>
  );
}

function ToolCallRow({ tool, status, time, output, delay, active }: { tool: string; status: string; time: string; output: string; delay: number; active: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [active, delay]);

  return (
    <div
      className="rounded-xl px-4 py-3 transition-all duration-500"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(6px)" }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono font-medium" style={{ color: "var(--accent)" }}>{tool}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--foreground-3)" }}>{time}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
            {status}
          </span>
        </div>
      </div>
      <div className="text-[11px]" style={{ color: "var(--foreground-2)" }}>{output}</div>
    </div>
  );
}

export default function DemoPage() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [section, setSection] = useState(0);
  const { displayed, done: typeDone } = useTypewriter(DEMO_PROMPT, 36, 400);

  function runDemo() {
    setRunning(true);
    setDone(false);
    setTimeout(() => setDone(true), 5500);
  }

  const sections = ["intro", "pipeline", "tools", "export", "integrations"];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6 md:px-10"
        style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h3M7 2v3M7 9v3M9 7h3M4.5 4.5l1.5 1.5M8 8l1.5 1.5M9.5 4.5L8 6M4.5 9.5L6 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-semibold text-[15px]">Operant <span style={{ color: "var(--accent)" }}>AI</span></span>
          <span className="text-[10px] px-2 py-0.5 rounded-full ml-1" style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.25)" }}>DEMO</span>
        </div>
        <Link
          href="/dashboard"
          className="text-xs px-4 py-2 rounded-lg font-medium transition-all"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Try it live →
        </Link>
      </nav>

      <main className="pt-14">
        {/* ── Hero ── */}
        <section className="flex flex-col items-center justify-center min-h-[90vh] text-center px-6 py-20">
          <div
            className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full mb-8 font-medium"
            style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.3)" }}
          >
            Hackathon Demo · 2026
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 max-w-3xl leading-tight">
            The AI agent that runs your{" "}
            <span style={{ color: "var(--accent)" }}>operations layer</span>
          </h1>

          <p className="text-lg md:text-xl max-w-xl mb-10 leading-relaxed" style={{ color: "var(--foreground-2)" }}>
            Describe any business process in plain English. Operant AI builds it,
            executes it, and learns from it — connecting 15 tools automatically.
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => { setSection(1); document.getElementById("pipeline-demo")?.scrollIntoView({ behavior: "smooth" }); }}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              See how it works
            </button>
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Open the app
            </Link>
          </div>

          {/* Stat row */}
          <div className="flex items-center gap-8 mt-16">
            {[["15", "Integrations"], ["8", "Pipeline stages"], ["3", "Memory tiers"], ["∞", "Workflows"]].map(([val, label]) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{val}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--foreground-3)" }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Problem ── */}
        <section className="py-20 px-6" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Automation is broken for most businesses
            </h2>
            <p className="text-base leading-relaxed mb-10" style={{ color: "var(--foreground-2)" }}>
              Specialists spend hours hand-wiring Zapier and n8n. Non-specialists can&apos;t automate at all.
              Operant AI is the missing layer — an agent that understands your goal and handles everything else.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              {[
                { icon: "⏱", title: "Before: hours of setup", desc: "Drag and drop, configure each step manually, debug connections." },
                { icon: "→", title: "With Operant AI: one sentence", desc: "Type what you want. The agent interprets, plans, and executes." },
                { icon: "♻", title: "It keeps learning", desc: "Every run feeds the memory layer. It gets faster and smarter automatically." },
              ].map((card) => (
                <div key={card.title} className="rounded-xl p-5" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                  <div className="text-xl mb-3">{card.icon}</div>
                  <div className="text-sm font-semibold mb-1">{card.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "var(--foreground-2)" }}>{card.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Live Pipeline Demo ── */}
        <section id="pipeline-demo" className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">The 8-stage orchestrator</h2>
              <p style={{ color: "var(--foreground-2)" }}>Watch it interpret, plan, execute, and reflect in real time.</p>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {/* Chat input mock */}
              <div className="px-6 py-4" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "var(--foreground-3)" }}>User prompt</div>
                <div
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                >
                  <span className="flex-1 text-sm" style={{ color: "var(--foreground)" }}>
                    {displayed}
                    <span className="animate-pulse" style={{ color: "var(--accent)" }}>|</span>
                  </span>
                  <button
                    onClick={runDemo}
                    disabled={running && !done}
                    className="flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: running && !done ? "var(--surface-2)" : "var(--accent)",
                      color: running && !done ? "var(--foreground-3)" : "#fff",
                      cursor: running && !done ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={(e) => { if (!running || done) e.currentTarget.style.opacity = "0.85"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                  >
                    {running && !done ? "Running…" : done ? "Run again" : "Run →"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-0" style={{ background: "var(--background)" }}>
                {/* Pipeline stages */}
                <div className="p-6 space-y-4" style={{ borderRight: "1px solid var(--border)" }}>
                  <div className="text-[10px] uppercase tracking-widest mb-4" style={{ color: "var(--foreground-3)" }}>Pipeline</div>
                  {DEMO_WORKFLOW.map((s) => (
                    <PipelineStage key={s.stage} {...s} active={running} />
                  ))}
                </div>

                {/* Tool calls */}
                <div className="p-6 space-y-3">
                  <div className="text-[10px] uppercase tracking-widest mb-4" style={{ color: "var(--foreground-3)" }}>Tool calls</div>
                  {TOOL_CALLS.map((t, i) => (
                    <ToolCallRow key={t.tool} {...t} delay={3200 + i * 400} active={running} />
                  ))}
                  {done && (
                    <div
                      className="rounded-xl px-4 py-3 text-xs font-medium transition-all duration-500"
                      style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e" }}
                    >
                      ✓ Workflow complete · 3 tools · 100% success · 1.7s · Saved to memory
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Memory ── */}
        <section className="py-20 px-6" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Three-tier memory</h2>
              <p style={{ color: "var(--foreground-2)" }}>The agent gets smarter with every run.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { tier: "Short-term", color: "var(--accent)", desc: "Goal, plan, tool mappings, and DAG held during a single run. Gone when the run ends.", badge: "volatile" },
                { tier: "Long-term", color: "#60a5fa", desc: "User preferences, past results, and business context. Persisted to Supabase with relevance scoring.", badge: "persistent" },
                { tier: "Patterns", color: "#34d399", desc: "Failure patterns from past executions — which tool failed, why, and what fixed it.", badge: "learning" },
              ].map((m) => (
                <div key={m.tier} className="rounded-xl p-5" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold" style={{ color: m.color }}>{m.tier}</span>
                    <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}30` }}>{m.badge}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-2)" }}>{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Export ── */}
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">No lock-in — export anywhere</h2>
            <p className="mb-10" style={{ color: "var(--foreground-2)" }}>
              Every workflow Operant AI builds can be exported to the tools your team already uses.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              {[
                { name: "n8n", desc: "Export as n8n-compatible JSON and import directly into your self-hosted instance.", badge: "Live" },
                { name: "Make.com", desc: "Export as a Make scenario blueprint — every module, route, and filter included.", badge: "Live" },
                { name: "Zapier", desc: "Step-by-step Zapier build guide generated from your workflow graph.", badge: "Beta" },
              ].map((ex) => (
                <div key={ex.name} className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{ex.name}</span>
                    <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.25)" }}>{ex.badge}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-2)" }}>{ex.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Integrations ── */}
        <section className="py-20 px-6" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">15 integrations, live today</h2>
            <p className="mb-10" style={{ color: "var(--foreground-2)" }}>Connect via API key or OAuth. The agent selects the right tools automatically.</p>
            <div className="flex flex-wrap justify-center gap-3">
              {INTEGRATIONS.map((int) => (
                <div
                  key={int.name}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{ background: "var(--accent-glow)", color: "var(--accent)" }}
                  >
                    {int.icon}
                  </span>
                  {int.name}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-24 px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Try it now
          </h2>
          <p className="text-base mb-10 max-w-md mx-auto leading-relaxed" style={{ color: "var(--foreground-2)" }}>
            Sign in, connect one integration, and type your first workflow. The agent handles the rest.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold transition-all"
            style={{ background: "var(--accent)", color: "#fff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            Open Operant AI →
          </Link>
          <p className="text-xs mt-4" style={{ color: "var(--foreground-3)" }}>
            Built for the Anthropic hackathon · Powered by Claude Sonnet 4.6
          </p>
        </section>
      </main>
    </div>
  );
}
