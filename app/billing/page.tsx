"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Plan = "free" | "pro" | "business";

interface SubscriptionData {
  plan: Plan;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: { runs: number; workflows: number; teamMembers: number };
  usage: { runs: number; workflows: number };
}

const PLAN_LABELS: Record<Plan, string> = { free: "Starter", pro: "Pro", business: "Business" };
const PLAN_COLORS: Record<Plan, string> = { free: "var(--foreground-3)", pro: "var(--accent)", business: "var(--accent)" };

const UPGRADE_OPTIONS = [
  {
    plan: "pro" as Plan,
    name: "Pro",
    price: "$49 / month",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "",
    features: ["500 runs / month", "Unlimited workflows", "Scheduling & triggers"],
  },
  {
    plan: "business" as Plan,
    name: "Business",
    price: "$149 / month",
    priceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID ?? "",
    features: ["Unlimited runs", "Team workspaces (10 members)", "Priority support"],
  },
];

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min((used / limit) * 100, 100);
  const color = pct > 85 ? "#ef4444" : pct > 60 ? "#eab308" : "var(--accent)";

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs" style={{ color: "var(--foreground-2)" }}>{label}</span>
        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
          {used.toLocaleString()} / {unlimited ? "∞" : limit.toLocaleString()}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}

function BillingInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<Plan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setToast({ message: "Subscription activated! Welcome to your new plan.", type: "success" });
    } else if (searchParams.get("canceled") === "1") {
      setToast({ message: "Checkout canceled. No charges were made.", type: "error" });
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(opt: (typeof UPGRADE_OPTIONS)[number]) {
    if (!opt.priceId) {
      setToast({ message: "Stripe price ID not configured. Add NEXT_PUBLIC_STRIPE_PRO_PRICE_ID to .env.local", type: "error" });
      return;
    }
    setCheckoutLoading(opt.plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: opt.priceId, plan: opt.plan }),
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setToast({ message: json.error ?? "Failed to start checkout", type: "error" });
    } catch {
      setToast({ message: "Network error. Please try again.", type: "error" });
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleManage() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setToast({ message: json.error ?? "Failed to open billing portal", type: "error" });
    } catch {
      setToast({ message: "Network error. Please try again.", type: "error" });
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h3M7 2v3M7 9v3M9 7h3M4.5 4.5l1.5 1.5M8 8l1.5 1.5M9.5 4.5L8 6M4.5 9.5L6 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-semibold text-[15px]">Operant <span style={{ color: "var(--accent)" }}>AI</span></span>
        </Link>
        <Link
          href="/dashboard"
          className="text-sm px-4 py-2 rounded-lg"
          style={{ color: "var(--foreground-3)", border: "1px solid var(--border)" }}
        >
          ← Dashboard
        </Link>
      </header>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg"
          style={{
            background: toast.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${toast.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: toast.type === "success" ? "#22c55e" : "#f87171",
          }}
        >
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-4 opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--foreground)" }}>Billing</h1>
        <p className="text-sm mb-10" style={{ color: "var(--foreground-3)" }}>Manage your plan and usage.</p>

        {loading ? (
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            <span className="text-sm" style={{ color: "var(--foreground-3)" }}>Loading...</span>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Current plan card */}
            <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Current plan</p>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold" style={{ color: PLAN_COLORS[data.plan] }}>
                      {PLAN_LABELS[data.plan]}
                    </h2>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium capitalize"
                      style={{
                        background: data.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                        color: data.status === "active" ? "#22c55e" : "#f87171",
                        border: `1px solid ${data.status === "active" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                      }}
                    >
                      {data.status}
                    </span>
                  </div>
                  {data.currentPeriodEnd && (
                    <p className="text-xs mt-1" style={{ color: "var(--foreground-3)" }}>
                      {data.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}{" "}
                      {new Date(data.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>

                {data.plan !== "free" && (
                  <button
                    onClick={handleManage}
                    disabled={portalLoading}
                    className="text-sm px-4 py-2 rounded-lg transition-all"
                    style={{ background: "var(--surface-2)", color: "var(--foreground-2)", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(218,119,86,0.3)"; e.currentTarget.style.color = "var(--foreground)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--foreground-2)"; }}
                  >
                    {portalLoading ? "Opening..." : "Manage subscription"}
                  </button>
                )}
              </div>

              {/* Usage */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>This month&apos;s usage</p>
                <UsageBar used={data.usage.runs} limit={data.limits.runs} label="Agent runs" />
                <UsageBar used={data.usage.workflows} limit={data.limits.workflows} label="Saved workflows" />
              </div>
            </div>

            {/* Upgrade options (only shown if not on Business) */}
            {data.plan !== "business" && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--foreground-muted)" }}>Upgrade your plan</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {UPGRADE_OPTIONS.filter((o) => o.plan !== data.plan).map((opt) => (
                    <div
                      key={opt.plan}
                      className="rounded-xl p-5"
                      style={{ background: "var(--surface)", border: "1px solid rgba(218,119,86,0.2)" }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold" style={{ color: "var(--foreground)" }}>{opt.name}</p>
                          <p className="text-sm" style={{ color: "var(--accent)" }}>{opt.price}</p>
                        </div>
                      </div>
                      <ul className="space-y-1 mb-4">
                        {opt.features.map((f) => (
                          <li key={f} className="text-xs flex items-center gap-2" style={{ color: "var(--foreground-3)" }}>
                            <span style={{ color: "var(--accent)" }}>✓</span> {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => handleUpgrade(opt)}
                        disabled={checkoutLoading === opt.plan}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                        style={{ background: "var(--accent)", color: "#fff" }}
                      >
                        {checkoutLoading === opt.plan ? "Redirecting..." : `Upgrade to ${opt.name}`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-center" style={{ color: "var(--foreground-muted)" }}>
              Payments are processed securely by Stripe.{" "}
              <Link href="/pricing" style={{ color: "var(--accent)" }}>View full plan comparison →</Link>
            </p>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--foreground-3)" }}>Failed to load subscription data.</p>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{ background: "var(--background)", height: "100vh" }} />}>
      <BillingInner />
    </Suspense>
  );
}
