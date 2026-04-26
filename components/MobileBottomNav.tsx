"use client";

import { PanelView } from "@/lib/types";

type MobileTab = "chat" | PanelView;

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  hasActiveRun?: boolean;
}

const TABS: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "chat",
    label: "Chat",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M17 10c0 3.866-3.134 7-7 7a6.97 6.97 0 01-3.5-.937L3 17l.937-3.5A6.97 6.97 0 013 10c0-3.866 3.134-7 7-7s7 3.134 7 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "run",
    label: "Run",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3v3M10 14v3M3 10h3M14 10h3M5.05 5.05l2.122 2.122M12.828 12.828l2.122 2.122M5.05 14.95l2.122-2.122M12.828 7.172l2.122-2.122" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "History",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 7v3.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "dashboard",
    label: "Stats",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="12" width="3" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="8.5" y="8" width="3" height="9" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="14" y="4" width="3" height="13" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 3.5v1.2M10 15.3v1.2M3.5 10h1.2M15.3 10h1.2M5.46 5.46l.85.85M13.69 13.69l.85.85M5.46 14.54l.85-.85M13.69 6.31l.85-.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function MobileBottomNav({ activeTab, onTabChange, hasActiveRun }: MobileBottomNavProps) {
  return (
    <nav
      className="md:hidden flex-shrink-0 flex items-center justify-around px-2 py-1 safe-area-pb"
      style={{
        background: "var(--background)",
        borderTop: "1px solid var(--border)",
        height: "60px",
      }}
    >
      {TABS.map(({ id, label, icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200"
            style={{ color: isActive ? "var(--accent)" : "var(--foreground-muted)" }}
          >
            {icon}
            <span className="text-[9px] font-medium tracking-wide">{label}</span>

            {id === "run" && hasActiveRun && (
              <span
                className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full animate-pulse"
                style={{ background: "#22c55e" }}
              />
            )}

            {isActive && (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
