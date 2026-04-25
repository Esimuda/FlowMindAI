"use client";

import Link from "next/link";
import { PanelView } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TopBarProps {
  activeView: PanelView;
  onViewChange: (view: PanelView) => void;
  hasActiveRun?: boolean;
  workspaceName?: string;
}

const VIEWS: { id: PanelView; label: string }[] = [
  { id: "run",       label: "Run" },
  { id: "history",   label: "History" },
  { id: "library",   label: "Library" },
  { id: "monitor",   label: "Monitor" },
  { id: "tools",     label: "Tools" },
  { id: "memory",    label: "Memory" },
  { id: "dashboard", label: "Dashboard" },
  { id: "settings",  label: "Settings" },
];

export default function TopBar({ activeView, onViewChange, hasActiveRun, workspaceName }: TopBarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className="h-14 flex items-center justify-between px-4 md:px-6 flex-shrink-0 relative z-50"
      style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--accent)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 7h3M7 2v3M7 9v3M9 7h3M4.5 4.5l1.5 1.5M8 8l1.5 1.5M9.5 4.5L8 6M4.5 9.5L6 8"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="font-semibold tracking-tight text-[15px]" style={{ color: "var(--foreground)" }}>
          Operant{" "}
          <span style={{ color: "var(--accent)" }}>AI</span>
        </span>

        {/* Workspace badge — desktop only */}
        {workspaceName && (
          <span
            className="hidden md:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ml-1"
            style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(218,119,86,0.25)" }}
          >
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--accent)" }} />
            {workspaceName}
          </span>
        )}
      </div>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-3">
        <Link
          href="/workspaces"
          className="text-xs px-3 py-1.5 rounded-lg transition-all"
          style={{ color: "var(--foreground-3)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--foreground-2)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--foreground-3)"; }}
        >
          Team
        </Link>

        <button
          onClick={handleSignOut}
          className="text-xs px-3 py-1.5 rounded-lg transition-all"
          style={{ color: "var(--foreground-3)", border: "1px solid transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground-2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-3)"; e.currentTarget.style.borderColor = "transparent"; }}
        >
          Sign out
        </button>

        {/* View toggle */}
        <div
          className="flex items-center gap-0.5 rounded-lg p-1"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {VIEWS.map(({ id, label }) => {
            const isActive = activeView === id;
            return (
              <button
                key={id}
                onClick={() => onViewChange(id)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 relative"
                style={
                  isActive
                    ? { background: "var(--accent)", color: "#fff" }
                    : { color: "var(--foreground-3)" }
                }
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground-2)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground-3)"; }}
              >
                {label}
                {id === "run" && hasActiveRun && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                    style={{ background: "#22c55e" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile right: account menu button */}
      <div className="md:hidden relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: menuOpen ? "var(--surface)" : "transparent",
            border: menuOpen ? "1px solid var(--border)" : "1px solid transparent",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="4" r="1.2" fill="var(--foreground-3)" />
            <circle cx="8" cy="8" r="1.2" fill="var(--foreground-3)" />
            <circle cx="8" cy="12" r="1.2" fill="var(--foreground-3)" />
          </svg>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-0 top-11 w-44 rounded-xl py-1 z-50 shadow-lg"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Link
                href="/workspaces"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm w-full text-left transition-all"
                style={{ color: "var(--foreground-2)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--foreground)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--foreground-2)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="2.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="11.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M1 11c0-1.657 1.343-2.5 3-2.5h6c1.657 0 3 .843 3 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Team
              </Link>
              <div style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />
              <button
                onClick={() => { setMenuOpen(false); handleSignOut(); }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm w-full text-left transition-all"
                style={{ color: "var(--foreground-2)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground-2)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 12H3a1 1 0 01-1-1V3a1 1 0 011-1h2M9.5 9.5L12 7l-2.5-2.5M12 7H5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
