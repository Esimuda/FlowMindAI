"use client";

import { PanelView } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface TopBarProps {
  activeView: PanelView;
  onViewChange: (view: PanelView) => void;
  hasActiveRun?: boolean;
}

const VIEWS: { id: PanelView; label: string }[] = [
  { id: "run",       label: "Run" },
  { id: "history",   label: "History" },
  { id: "library",   label: "Library" },
  { id: "dashboard", label: "Dashboard" },
  { id: "settings",  label: "Settings" },
];

export default function TopBar({ activeView, onViewChange, hasActiveRun }: TopBarProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className="h-14 flex items-center justify-between px-6 flex-shrink-0"
      style={{ background: "#050508", borderBottom: "1px solid #1a1a2e" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
            boxShadow: "0 0 12px rgba(124, 58, 237, 0.4)",
          }}
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
        <span className="font-semibold tracking-tight text-[15px]" style={{ color: "#e2e8f0" }}>
          FlowMind{" "}
          <span
            style={{
              background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AI
          </span>
        </span>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="hidden md:block text-xs px-3 py-1.5 rounded-lg transition-all absolute right-[260px]"
        style={{ color: "#475569", border: "1px solid transparent" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#94a3b8";
          e.currentTarget.style.borderColor = "#1a1a2e";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#475569";
          e.currentTarget.style.borderColor = "transparent";
        }}
      >
        Sign out
      </button>

      {/* Toggle buttons */}
      <div
        className="flex items-center gap-1 rounded-lg p-1"
        style={{ background: "#0d0d12", border: "1px solid #1a1a2e" }}
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
                  ? {
                      background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
                      color: "#fff",
                      boxShadow: "0 0 10px rgba(124, 58, 237, 0.3)",
                    }
                  : { color: "#64748b" }
              }
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
              }}
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
    </header>
  );
}
