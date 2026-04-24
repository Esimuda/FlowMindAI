"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Member { user_id: string; role: string }
interface Workspace { id: string; name: string; owner_id: string; created_at: string; workspace_members: Member[] }

const ROLE_COLORS: Record<string, string> = {
  owner: "#7c3aed",
  editor: "#06b6d4",
  viewer: "#64748b",
};

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Invite state
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteResult, setInviteResult] = useState<{ url: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    const json = await res.json() as { workspaces?: Workspace[] };
    setWorkspaces(json.workspaces ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
    loadWorkspaces();
  }, [loadWorkspaces]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      setCreateError(json.error ?? "Failed to create workspace");
    } else {
      setNewName("");
      loadWorkspaces();
    }
    setCreating(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteWorkspaceId || !inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteResult(null);
    const res = await fetch("/api/workspaces/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: inviteWorkspaceId, email: inviteEmail.trim(), role: inviteRole }),
    });
    const json = await res.json() as { error?: string; inviteUrl?: string };
    if (!res.ok) {
      setInviteError(json.error ?? "Failed to create invite");
    } else {
      setInviteResult({ url: json.inviteUrl! });
      setInviteEmail("");
    }
    setInviteLoading(false);
  }

  async function handleLeave(workspaceId: string) {
    if (!confirm("Leave this workspace? You will lose access to its shared resources.")) return;
    await fetch("/api/workspaces/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    loadWorkspaces();
  }

  async function handleDelete(workspaceId: string) {
    if (!confirm("Delete this workspace? This cannot be undone and all members will lose access.")) return;
    await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
    loadWorkspaces();
  }

  function isOwner(ws: Workspace) {
    return ws.owner_id === currentUserId;
  }

  function isMember(ws: Workspace) {
    return ws.workspace_members.some((m) => m.user_id === currentUserId);
  }

  function memberLabel(userId: string): string {
    if (userId === currentUserId) return "You";
    return userId.slice(0, 8) + "…";
  }

  return (
    <div className="min-h-screen" style={{ background: "#050508", color: "#e2e8f0" }}>
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#1a1a2e" }}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)", boxShadow: "0 0 12px rgba(124,58,237,0.4)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h3M7 2v3M7 9v3M9 7h3M4.5 4.5l1.5 1.5M8 8l1.5 1.5M9.5 4.5L8 6M4.5 9.5L6 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <span className="font-semibold text-[15px]">Operant <span style={{ background: "linear-gradient(90deg,#7c3aed,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI</span></span>
        </Link>
        <Link href="/dashboard" className="text-sm px-4 py-2 rounded-lg" style={{ color: "#64748b", border: "1px solid #1a1a2e" }}>← Dashboard</Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Team Workspaces</h1>
        <p className="text-sm mb-2" style={{ color: "#64748b" }}>
          Share workflows and run history with your team. Requires the{" "}
          <Link href="/billing" style={{ color: "#7c3aed" }}>Business plan</Link>.
        </p>
        <p className="text-xs mb-10 px-4 py-3 rounded-xl" style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", color: "#a78bfa" }}>
          Workspace members share the same workflow library and run history. Permissions: <strong>Owner</strong> = full control, <strong>Editor</strong> = run + edit, <strong>Viewer</strong> = read-only.
        </p>

        {loading ? (
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#7c3aed", borderTopColor: "transparent" }} />
            <span className="text-sm" style={{ color: "#475569" }}>Loading workspaces...</span>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Create workspace */}
            <div className="rounded-2xl p-6" style={{ background: "#0d0d12", border: "1px solid #1a1a2e" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#334155" }}>Create workspace</p>
              <form onSubmit={handleCreate} className="flex gap-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Marketing team, Ops team"
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#e2e8f0" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#1a1a2e")}
                />
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "#fff" }}
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </form>
              {createError && <p className="text-xs mt-2" style={{ color: "#f87171" }}>{createError}</p>}
            </div>

            {/* Workspaces list */}
            {workspaces.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: "#0d0d12", border: "1px solid #1a1a2e" }}>
                <p className="text-sm" style={{ color: "#334155" }}>No workspaces yet. Create one above.</p>
              </div>
            ) : (
              workspaces.map((ws) => (
                <div key={ws.id} className="rounded-2xl p-6" style={{ background: "#0d0d12", border: "1px solid #1a1a2e" }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg" style={{ color: "#e2e8f0" }}>{ws.name}</h3>
                      <p className="text-xs mt-0.5" style={{ color: "#334155" }}>
                        {ws.workspace_members.length} member{ws.workspace_members.length !== 1 ? "s" : ""} ·{" "}
                        Created {new Date(ws.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner(ws) && (
                        <button
                          onClick={() => { setInviteWorkspaceId(ws.id); setInviteResult(null); setInviteError(null); }}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: "rgba(124,58,237,0.1)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.2)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,58,237,0.2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(124,58,237,0.1)")}
                        >
                          + Invite
                        </button>
                      )}
                      {isOwner(ws) ? (
                        <button
                          onClick={() => handleDelete(ws.id)}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{ color: "#475569", border: "1px solid #1a1a2e" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "#1a1a2e"; }}
                        >
                          Delete
                        </button>
                      ) : isMember(ws) ? (
                        <button
                          onClick={() => handleLeave(ws.id)}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{ color: "#475569", border: "1px solid #1a1a2e" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "#1a1a2e"; }}
                        >
                          Leave
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Members */}
                  <div className="space-y-2">
                    {ws.workspace_members.map((m) => (
                      <div key={m.user_id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: "#050508" }}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background: m.user_id === currentUserId ? "rgba(124,58,237,0.2)" : "rgba(100,116,139,0.1)", color: m.user_id === currentUserId ? "#a78bfa" : "#64748b" }}
                          >
                            {m.user_id === currentUserId ? "Y" : m.user_id.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="text-xs font-mono" style={{ color: m.user_id === currentUserId ? "#94a3b8" : "#64748b" }}>
                            {memberLabel(m.user_id)}
                          </span>
                        </div>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full capitalize font-medium"
                          style={{ background: `${ROLE_COLORS[m.role]}18`, color: ROLE_COLORS[m.role], border: `1px solid ${ROLE_COLORS[m.role]}30` }}
                        >
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Inline invite form */}
                  {inviteWorkspaceId === ws.id && (
                    <div className="mt-4 pt-4" style={{ borderTop: "1px solid #1a1a2e" }}>
                      <p className="text-xs font-semibold mb-3" style={{ color: "#334155" }}>Invite by email</p>
                      <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="colleague@company.com"
                          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#e2e8f0" }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "#1a1a2e")}
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                          className="px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#94a3b8" }}
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          type="submit"
                          disabled={inviteLoading || !inviteEmail.trim()}
                          className="px-4 py-2 rounded-lg text-sm font-semibold"
                          style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "#fff" }}
                        >
                          {inviteLoading ? "Sending..." : "Send invite"}
                        </button>
                      </form>

                      {inviteError && <p className="text-xs mt-2" style={{ color: "#f87171" }}>{inviteError}</p>}

                      {inviteResult && (
                        <div className="mt-3 p-3 rounded-lg" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
                          <p className="text-xs font-medium mb-1" style={{ color: "#22c55e" }}>Invite link created — share it with your teammate:</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs flex-1 truncate" style={{ color: "#86efac" }}>{inviteResult.url}</code>
                            <button
                              onClick={() => navigator.clipboard.writeText(inviteResult.url)}
                              className="text-[10px] px-2 py-1 rounded flex-shrink-0"
                              style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-[10px] mt-1.5" style={{ color: "#334155" }}>Expires in 7 days. One-time use.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
