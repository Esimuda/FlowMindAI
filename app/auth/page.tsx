"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthPage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "signup") setMode("signup");
  }, [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccessMsg("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
    }

    setLoading(false);
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "#050508" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: "#0d0d12", border: "1px solid #1a1a2e" }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}
          >
            <span style={{ fontSize: 18 }}>⚡</span>
          </div>
          <p className="text-base font-semibold" style={{ color: "#e2e8f0" }}>
            FlowMind AI
          </p>
          <p className="text-xs mt-1" style={{ color: "#475569" }}>
            Autonomous operations agent
          </p>
        </div>

        {/* Mode toggle */}
        <div
          className="flex rounded-lg p-1 mb-6"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a1a2e" }}
        >
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); setSuccessMsg(""); }}
              className="flex-1 text-xs py-1.5 rounded-md transition-all font-medium"
              style={{
                background: mode === m ? "rgba(124,58,237,0.2)" : "transparent",
                color: mode === m ? "#a78bfa" : "#475569",
                border: mode === m ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent",
              }}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid #1a1a2e",
                color: "#e2e8f0",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1a1a2e")}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid #1a1a2e",
                color: "#e2e8f0",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1a1a2e")}
            />
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </p>
          )}

          {successMsg && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}>
              {successMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-sm font-semibold py-2.5 rounded-lg transition-all mt-2"
            style={{
              background: loading ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.85)",
              color: loading ? "#7c3aed" : "#fff",
              border: "1px solid rgba(124,58,237,0.4)",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
