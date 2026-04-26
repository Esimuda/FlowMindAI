"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ── Slide definitions ── */
const SLIDES = [
  { id: "hook",         duration: 13, label: "Hook" },
  { id: "problem",      duration: 14, label: "Problem" },
  { id: "pipeline",     duration: 42, label: "Live Demo" },
  { id: "memory",       duration: 12, label: "Memory" },
  { id: "export",       duration: 11, label: "Export" },
  { id: "integrations", duration: 10, label: "Integrations" },
  { id: "close",        duration: 18, label: "Close" },
];
// Total: 120s = 2 min exactly

const INTEGRATIONS = [
  "Notion","Slack","Stripe","Gmail","HubSpot",
  "Google Sheets","Google Calendar","Airtable",
  "Twilio","GitHub","Linear","Discord","Resend","Mailchimp","Meta",
];

const PIPELINE_STAGES = [
  { stage: "Interpret",    desc: "Parsing goal into structured intent",         icon: "◎", delay: 400  },
  { stage: "Memory",       desc: "Loading relevant past patterns",              icon: "⟳", delay: 800  },
  { stage: "Plan",         desc: "Breaking goal into dependency steps",         icon: "⊞", delay: 1200 },
  { stage: "Select Tools", desc: "Mapping steps → Stripe, Notion, Resend",     icon: "⚙", delay: 1600 },
  { stage: "Build Graph",  desc: "Synthesising parallel execution DAG",         icon: "⬡", delay: 2000 },
  { stage: "Execute",      desc: "Running 3 tool calls (1 parallel)",           icon: "▶", delay: 2500 },
  { stage: "Observe",      desc: "100% success · 2.1s · 3 tool calls",         icon: "✓", delay: 3000 },
  { stage: "Reflect",      desc: "No failures. Workflow saved to memory.",      icon: "★", delay: 3500 },
];

const TOOL_CALLS = [
  { tool: "stripe_list_customers", time: "0.3s", output: "Found: sarah@acme.com", delay: 2600 },
  { tool: "notion_create_page",    time: "0.8s", output: "Lead added to CRM database", delay: 3000 },
  { tool: "resend_send_email",     time: "0.6s", output: "Welcome email delivered ✓", delay: 3400 },
];

/* ── Helpers ── */
function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function PipelineRow({ stage, desc, icon, delay, running }: { stage: string; desc: string; icon: string; delay: number; running: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!running) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [running, delay]);
  return (
    <div className="flex items-center gap-3 transition-all duration-500" style={{ opacity: show ? 1 : 0, transform: show ? "none" : "translateY(6px)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 font-mono transition-all duration-300"
        style={{ background: show ? "rgba(218,119,86,0.15)" : "var(--surface-2)", border: "1px solid", borderColor: show ? "rgba(218,119,86,0.4)" : "var(--border)", color: show ? "var(--accent)" : "var(--foreground-3)" }}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{stage}</div>
        <div className="text-xs" style={{ color: "var(--foreground-2)" }}>{desc}</div>
      </div>
      {show && <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: "var(--accent)" }} />}
    </div>
  );
}

function ToolRow({ tool, time, output, delay, running }: { tool: string; time: string; output: string; delay: number; running: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!running) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [running, delay]);
  return (
    <div className="rounded-xl px-4 py-3 transition-all duration-500" style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: show ? 1 : 0, transform: show ? "none" : "translateY(6px)" }}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-mono font-semibold" style={{ color: "var(--accent)" }}>{tool}</span>
        <span className="text-[10px]" style={{ color: "var(--foreground-3)" }}>{time}</span>
      </div>
      <div className="text-xs" style={{ color: "var(--foreground-2)" }}>{output}</div>
    </div>
  );
}

/* ── Slide content ── */
function SlideHook() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8" style={{ background: "var(--accent)" }}>
        <svg width="28" height="28" viewBox="0 0 14 14" fill="none">
          <path d="M2 7h3M7 2v3M7 9v3M9 7h3M4.5 4.5l1.5 1.5M8 8l1.5 1.5M9.5 4.5L8 6M4.5 9.5L6 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-sm font-medium mb-4 px-3 py-1.5 rounded-full" style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.3)" }}>
        Operant AI · Hackathon Demo
      </div>
      <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
        The AI agent that runs<br />your <span style={{ color: "var(--accent)" }}>operations layer</span>
      </h1>
      <p className="text-xl md:text-2xl max-w-2xl leading-relaxed" style={{ color: "var(--foreground-2)" }}>
        Describe any business process in plain English.<br />
        Operant AI builds it, executes it, and learns from it.
      </p>
      <div className="flex items-center gap-12 mt-12">
        {[["15", "Integrations"], ["8", "Pipeline stages"], ["3", "Memory tiers"]].map(([v, l]) => (
          <div key={l} className="text-center">
            <div className="text-4xl font-bold" style={{ color: "var(--accent)" }}>{v}</div>
            <div className="text-sm mt-1" style={{ color: "var(--foreground-3)" }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideProblem() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 max-w-5xl mx-auto w-full">
      <h2 className="text-4xl md:text-5xl font-bold mb-4 text-center">Automation is <span style={{ color: "var(--accent)" }}>broken</span> for most businesses</h2>
      <p className="text-lg mb-12 text-center" style={{ color: "var(--foreground-2)" }}>
        Specialists waste hours wiring tools by hand. Non-specialists can&apos;t automate at all.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {[
          { icon: "⏱", title: "Hours of manual setup", desc: "Drag-and-drop each step, configure filters, debug broken connections — every time." },
          { icon: "→", title: "One sentence with Operant AI", desc: "Type what you want. The agent interprets, plans, and executes across all your tools." },
          { icon: "♻", title: "It keeps getting smarter", desc: "Every run feeds the memory layer. Failures are learned from. Nothing repeated twice." },
        ].map((c) => (
          <div key={c.title} className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-3xl mb-4">{c.icon}</div>
            <div className="text-base font-semibold mb-2">{c.title}</div>
            <div className="text-sm leading-relaxed" style={{ color: "var(--foreground-2)" }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlidePipeline({ active }: { active: boolean }) {
  const [pipeRunning, setPipeRunning] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!active) { setPipeRunning(false); setComplete(false); return; }
    const t1 = setTimeout(() => setPipeRunning(true), 600);
    const t2 = setTimeout(() => setComplete(true), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 w-full max-w-5xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-bold mb-2 text-center">Watch the <span style={{ color: "var(--accent)" }}>8-stage orchestrator</span> run</h2>
      <p className="text-base mb-6 text-center" style={{ color: "var(--foreground-2)" }}>
        &ldquo;New Stripe customer → add to Notion CRM → send welcome email via Resend&rdquo;
      </p>
      <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-2" style={{ background: "var(--background)" }}>
          {/* Pipeline */}
          <div className="p-5 space-y-3" style={{ borderRight: "1px solid var(--border)" }}>
            <div className="text-[10px] uppercase tracking-widest mb-4" style={{ color: "var(--foreground-3)" }}>Pipeline stages</div>
            {PIPELINE_STAGES.map((s) => <PipelineRow key={s.stage} {...s} running={pipeRunning} />)}
          </div>
          {/* Tool calls */}
          <div className="p-5 space-y-3">
            <div className="text-[10px] uppercase tracking-widest mb-4" style={{ color: "var(--foreground-3)" }}>Tool calls</div>
            {TOOL_CALLS.map((t) => <ToolRow key={t.tool} {...t} running={pipeRunning} />)}
            {complete && (
              <div className="rounded-xl px-4 py-3 text-sm font-medium transition-all" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}>
                ✓ Complete · 3 tools · 100% success · 2.1s · Saved to memory
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideMemory() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 max-w-5xl mx-auto w-full">
      <h2 className="text-4xl md:text-5xl font-bold mb-4 text-center">Three-tier <span style={{ color: "var(--accent)" }}>memory</span></h2>
      <p className="text-lg mb-12 text-center" style={{ color: "var(--foreground-2)" }}>The agent gets smarter with every run — automatically.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {[
          { tier: "Short-term", color: "var(--accent)", badge: "volatile", desc: "Goal, plan, tool mappings held during a run. Cleared when the run ends." },
          { tier: "Long-term",  color: "#60a5fa",       badge: "persistent", desc: "User preferences and past results stored in Supabase with relevance scoring." },
          { tier: "Patterns",   color: "#34d399",       badge: "learning", desc: "Failure patterns from past executions — what failed, why, and what fixed it." },
        ].map((m) => (
          <div key={m.tier} className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-bold" style={{ color: m.color }}>{m.tier}</span>
              <span className="text-[9px] uppercase tracking-widest px-2 py-1 rounded-full" style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}30` }}>{m.badge}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-2)" }}>{m.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideExport() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 max-w-5xl mx-auto w-full">
      <h2 className="text-4xl md:text-5xl font-bold mb-4 text-center">No lock-in — <span style={{ color: "var(--accent)" }}>export anywhere</span></h2>
      <p className="text-lg mb-12 text-center" style={{ color: "var(--foreground-2)" }}>Every workflow exports to the tools your team already uses.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {[
          { name: "n8n", badge: "Live", desc: "Export as n8n-compatible JSON. Import directly into your self-hosted instance." },
          { name: "Make.com", badge: "Live", desc: "Export as a Make scenario blueprint — every module and route included." },
          { name: "Zapier", badge: "Beta", desc: "Step-by-step Zapier build guide generated from your workflow graph." },
        ].map((ex) => (
          <div key={ex.name} className="rounded-2xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-bold mb-2">{ex.name}</div>
            <div className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full inline-block mb-4" style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.25)" }}>{ex.badge}</div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-2)" }}>{ex.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideIntegrations() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 max-w-5xl mx-auto w-full">
      <h2 className="text-4xl md:text-5xl font-bold mb-4 text-center"><span style={{ color: "var(--accent)" }}>15 integrations</span>, live today</h2>
      <p className="text-lg mb-10 text-center" style={{ color: "var(--foreground-2)" }}>Connect via API key or OAuth. The agent selects tools automatically.</p>
      <div className="flex flex-wrap justify-center gap-3">
        {INTEGRATIONS.map((name) => (
          <div key={name} className="px-5 py-2.5 rounded-xl text-sm font-medium" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideClose() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8" style={{ background: "var(--accent)" }}>
        <svg width="28" height="28" viewBox="0 0 14 14" fill="none">
          <path d="M2 7h3M7 2v3M7 9v3M9 7h3M4.5 4.5l1.5 1.5M8 8l1.5 1.5M9.5 4.5L8 6M4.5 9.5L6 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
        This is <span style={{ color: "var(--accent)" }}>Operant AI</span>
      </h2>
      <p className="text-xl max-w-xl mb-4 leading-relaxed" style={{ color: "var(--foreground-2)" }}>
        Claude Code, but for automation specialists — and the 90% of businesses who don&apos;t have one.
      </p>
      <p className="text-base mb-10" style={{ color: "var(--foreground-3)" }}>
        15 integrations · 8-stage orchestrator · 3-tier memory · Export to n8n, Make, Zapier
      </p>
      <Link
        href="/dashboard"
        className="px-8 py-4 rounded-xl text-lg font-semibold transition-all"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        Try it live →
      </Link>
      <p className="text-xs mt-6" style={{ color: "var(--foreground-muted)" }}>
        Built for the Anthropic Hackathon · Powered by Claude Sonnet 4.6
      </p>
    </div>
  );
}

/* ── Script cues per slide ── */
const SCRIPT_CUES = [
  "What if you could automate any business process just by describing it? No setup. No specialist. That's Operant AI.",
  "Zapier and n8n take hours and require an expert. Operant AI replaces all of that with one sentence — and actually executes it.",
  "Live — new Stripe customer, add to Notion, send a welcome email. Eight stages, three tools, two seconds. Done — and saved to memory.",
  "Three memory tiers — short-term, long-term, and a pattern layer that learns from every failure automatically.",
  "No lock-in. Export any workflow as n8n, Make dot com, or Zapier — straight into tools your team already uses.",
  "Fifteen integrations live — Stripe, Notion, Gmail, Slack, HubSpot, GitHub, and more. The agent picks the right tools automatically.",
  "You describe the outcome. Operant AI plans it, runs it, learns from it, and exports it. No specialist required. This is Operant AI.",
];

/* ── Main component ── */
export default function DemoPage() {
  const [started, setStarted] = useState(false);
  const [slide, setSlide] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalDuration = SLIDES.reduce((a, s) => a + s.duration, 0);

  const slideStartTime = SLIDES.slice(0, slide).reduce((a, s) => a + s.duration, 0);
  const slideElapsed = elapsed - slideStartTime;
  const slideDuration = SLIDES[slide]?.duration ?? 1;
  const slideProgress = Math.min(slideElapsed / slideDuration, 1);

  const advance = useCallback(() => {
    setSlide((prev) => {
      if (prev + 1 >= SLIDES.length) { setFinished(true); return prev; }
      return prev + 1;
    });
  }, []);

  useEffect(() => {
    if (!started || finished) return;
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        // Work out which slide we should be on
        let acc = 0;
        for (let i = 0; i < SLIDES.length; i++) {
          acc += SLIDES[i].duration;
          if (next < acc) {
            setSlide(i);
            break;
          }
        }
        if (next >= totalDuration) { setFinished(true); }
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, finished, totalDuration]);

  function restart() {
    setStarted(false);
    setSlide(0);
    setElapsed(0);
    setFinished(false);
  }

  const remaining = slideDuration - Math.floor(slideElapsed);
  const totalRemaining = totalDuration - elapsed;

  /* ── Pre-start screen ── */
  if (!started) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: "var(--accent)" }}>
          <svg width="24" height="24" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h3M7 2v3M7 9v3M9 7h3M4.5 4.5l1.5 1.5M8 8l1.5 1.5M9.5 4.5L8 6M4.5 9.5L6 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-2">Operant AI — Demo Presentation</h1>
        <p className="mb-1" style={{ color: "var(--foreground-2)" }}>7 slides · 3 min 40 sec · fully automatic</p>
        <p className="text-sm mb-10" style={{ color: "var(--foreground-3)" }}>Start your screen recording first, then click the button below.</p>

        {/* Slide preview */}
        <div className="w-full max-w-lg mb-10 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {SLIDES.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: i < SLIDES.length - 1 ? "1px solid var(--border)" : "none", background: "var(--surface)" }}>
              <div className="flex items-center gap-3">
                <span className="text-xs w-5 h-5 rounded-full flex items-center justify-center font-semibold flex-shrink-0" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>{i + 1}</span>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              <span className="text-xs font-mono" style={{ color: "var(--foreground-3)" }}>{s.duration}s</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "var(--background)" }}>
            <span className="text-xs font-semibold" style={{ color: "var(--foreground-2)" }}>Total</span>
            <span className="text-xs font-mono font-semibold" style={{ color: "var(--accent)" }}>{fmt(totalDuration)}</span>
          </div>
        </div>

        <button
          onClick={() => setStarted(true)}
          className="px-10 py-4 rounded-xl text-lg font-bold transition-all"
          style={{ background: "var(--accent)", color: "#fff" }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          ▶ Start Presentation
        </button>
        <p className="text-xs mt-3" style={{ color: "var(--foreground-muted)" }}>Advances automatically. Press → or click anywhere to skip a slide.</p>
      </div>
    );
  }

  /* ── Finished screen ── */
  if (finished) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="text-5xl mb-6">✓</div>
        <h2 className="text-3xl font-bold mb-3">Presentation complete</h2>
        <p className="mb-8" style={{ color: "var(--foreground-2)" }}>Stop your screen recording now.</p>
        <div className="flex gap-4">
          <button onClick={restart} className="px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            ↺ Start over
          </button>
          <Link href="/dashboard" className="px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
            Open the app →
          </Link>
        </div>
      </div>
    );
  }

  /* ── Slide show ── */
  return (
    <div
      className="h-screen flex flex-col overflow-hidden select-none"
      style={{ background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}
      onClick={advance}
      onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === " ") advance(); }}
      tabIndex={0}
    >
      {/* Top progress bar */}
      <div className="flex-shrink-0 h-1 w-full" style={{ background: "var(--border)" }}>
        <div
          className="h-full transition-all duration-1000"
          style={{ width: `${(elapsed / totalDuration) * 100}%`, background: "var(--accent)" }}
        />
      </div>

      {/* Header bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h3M7 2v3M7 9v3M9 7h3M4.5 4.5l1.5 1.5M8 8l1.5 1.5M9.5 4.5L8 6M4.5 9.5L6 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-sm font-semibold">Operant <span style={{ color: "var(--accent)" }}>AI</span></span>
        </div>

        {/* Slide tabs */}
        <div className="hidden md:flex items-center gap-1">
          {SLIDES.map((s, i) => (
            <div
              key={s.id}
              className="text-[10px] px-3 py-1 rounded-full font-medium transition-all"
              style={{
                background: i === slide ? "var(--accent)" : i < slide ? "var(--accent-glow)" : "var(--surface)",
                color: i === slide ? "#fff" : i < slide ? "var(--accent)" : "var(--foreground-3)",
                border: "1px solid",
                borderColor: i === slide ? "transparent" : i < slide ? "rgba(218,119,86,0.25)" : "var(--border)",
              }}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* Timer */}
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--foreground-3)" }}>
          <span className="font-mono">{fmt(remaining)}s left on slide</span>
          <span>·</span>
          <span className="font-mono">{fmt(totalRemaining)} total</span>
        </div>
      </div>

      {/* Slide per-slide progress bar */}
      <div className="flex-shrink-0 h-0.5 w-full" style={{ background: "var(--surface-2)" }}>
        <div
          className="h-full transition-all duration-1000"
          style={{ width: `${slideProgress * 100}%`, background: "rgba(218,119,86,0.4)" }}
        />
      </div>

      {/* Slide body */}
      <div className="flex-1 overflow-hidden">
        {slide === 0 && <SlideHook />}
        {slide === 1 && <SlideProblem />}
        {slide === 2 && <SlidePipeline active={slide === 2} />}
        {slide === 3 && <SlideMemory />}
        {slide === 4 && <SlideExport />}
        {slide === 5 && <SlideIntegrations />}
        {slide === 6 && <SlideClose />}
      </div>

      {/* Script cue footer */}
      <div
        className="flex-shrink-0 px-6 py-3 flex items-start gap-3"
        style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <span className="text-[10px] uppercase tracking-widest flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }}>Say:</span>
        <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-2)" }}>{SCRIPT_CUES[slide]}</p>
        <span className="text-[10px] flex-shrink-0 mt-0.5 ml-auto" style={{ color: "var(--foreground-muted)" }}>click to skip →</span>
      </div>
    </div>
  );
}
