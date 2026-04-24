"use client";

import { useEffect, useState, useCallback } from "react";
import type { CustomTool, CustomToolParam, HttpMethod } from "@/lib/db/customTools";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const PARAM_TYPES = ["string", "number", "boolean"] as const;

const METHOD_COLORS: Record<HttpMethod, { bg: string; text: string }> = {
  GET:    { bg: "rgba(34,197,94,0.1)",    text: "#4ade80" },
  POST:   { bg: "rgba(6,182,212,0.1)",    text: "#22d3ee" },
  PUT:    { bg: "rgba(251,146,60,0.1)",   text: "#fb923c" },
  PATCH:  { bg: "rgba(234,179,8,0.1)",    text: "#facc15" },
  DELETE: { bg: "rgba(239,68,68,0.1)",    text: "#f87171" },
};

async function fetchTools(): Promise<CustomTool[]> {
  const res = await fetch("/api/custom-tools");
  if (!res.ok) return [];
  const json = await res.json() as { tools: CustomTool[] };
  return json.tools ?? [];
}

async function saveTool(tool: Partial<CustomTool> & { id?: string }): Promise<void> {
  if (tool.id) {
    await fetch("/api/custom-tools", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tool),
    });
  } else {
    await fetch("/api/custom-tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tool),
    });
  }
}

async function removeTool(id: string): Promise<void> {
  await fetch("/api/custom-tools", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

async function toggleTool(id: string, enabled: boolean): Promise<void> {
  await fetch("/api/custom-tools", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, enabled }),
  });
}

interface FormState {
  name: string;
  description: string;
  httpUrl: string;
  httpMethod: HttpMethod;
  headers: string; // JSON string
  params: CustomToolParam[];
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  httpUrl: "",
  httpMethod: "POST",
  headers: "{}",
  params: [],
};

function ParamRow({
  param,
  onChange,
  onDelete,
}: {
  param: CustomToolParam;
  onChange: (p: CustomToolParam) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-start gap-2 p-2 rounded-lg"
      style={{ background: "#050508", border: "1px solid #0f0f18" }}
    >
      <div className="flex-1 space-y-1.5">
        <div className="flex gap-1.5">
          <input
            value={param.name}
            onChange={(e) => onChange({ ...param, name: e.target.value })}
            placeholder="param_name"
            className="flex-1 text-[10px] px-2 py-1 rounded font-mono outline-none"
            style={{ background: "#0d0d12", border: "1px solid #1a1a2e", color: "#e2e8f0" }}
          />
          <select
            value={param.type}
            onChange={(e) => onChange({ ...param, type: e.target.value as CustomToolParam["type"] })}
            className="text-[10px] px-1.5 py-1 rounded"
            style={{ background: "#0d0d12", border: "1px solid #1a1a2e", color: "#94a3b8" }}
          >
            {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "#475569" }}>
            <input
              type="checkbox"
              checked={param.required}
              onChange={(e) => onChange({ ...param, required: e.target.checked })}
              className="w-3 h-3"
            />
            req
          </label>
        </div>
        <input
          value={param.description}
          onChange={(e) => onChange({ ...param, description: e.target.value })}
          placeholder="Description"
          className="w-full text-[10px] px-2 py-1 rounded outline-none"
          style={{ background: "#0d0d12", border: "1px solid #1a1a2e", color: "#94a3b8" }}
        />
      </div>
      <button
        onClick={onDelete}
        className="text-[11px] px-1.5 py-1 rounded mt-0.5 flex-shrink-0"
        style={{ color: "#334155" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
      >
        ×
      </button>
    </div>
  );
}

export default function CustomToolsPanel() {
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const t = await fetchTools();
    setTools(t);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setHeaderError(null);
  }

  function openEdit(tool: CustomTool) {
    setForm({
      name: tool.name,
      description: tool.description,
      httpUrl: tool.httpUrl,
      httpMethod: tool.httpMethod,
      headers: JSON.stringify(tool.headers, null, 2),
      params: tool.params,
    });
    setEditingId(tool.id);
    setShowForm(true);
    setHeaderError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let parsedHeaders: Record<string, string> = {};
    try {
      parsedHeaders = JSON.parse(form.headers || "{}") as Record<string, string>;
    } catch {
      setHeaderError("Headers must be valid JSON");
      return;
    }
    setHeaderError(null);
    setSaving(true);
    await saveTool({
      id: editingId ?? undefined,
      name: form.name,
      description: form.description,
      httpUrl: form.httpUrl,
      httpMethod: form.httpMethod,
      headers: parsedHeaders,
      params: form.params,
      enabled: true,
    });
    setShowForm(false);
    setSaving(false);
    reload();
  }

  async function handleDelete(id: string) {
    await removeTool(id);
    reload();
  }

  async function handleToggle(id: string, current: boolean) {
    await toggleTool(id, !current);
    reload();
  }

  function addParam() {
    setForm((f) => ({
      ...f,
      params: [...f.params, { name: "", type: "string", description: "", required: false }],
    }));
  }

  function updateParam(i: number, p: CustomToolParam) {
    setForm((f) => ({ ...f, params: f.params.map((x, j) => (j === i ? p : x)) }));
  }

  function deleteParam(i: number) {
    setForm((f) => ({ ...f, params: f.params.filter((_, j) => j !== i) }));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8">
        <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#7c3aed", borderTopColor: "transparent" }} />
        <span className="text-sm" style={{ color: "#475569" }}>Loading tools...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin pr-1">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>Custom Tools</h2>
          <p className="text-xs mt-0.5" style={{ color: "#475569" }}>
            Define HTTP endpoints as agent tools — the AI can call them like any built-in integration.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openNew}
            className="text-[11px] px-3 py-1.5 rounded-lg font-semibold flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "#fff" }}
          >
            + New tool
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-4 mb-4 space-y-3"
          style={{ background: "#0d0d12", border: "1px solid rgba(124,58,237,0.3)" }}
        >
          <p className="text-[11px] font-semibold" style={{ color: "#a78bfa" }}>
            {editingId ? "Edit tool" : "New custom tool"}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: "#334155" }}>Tool name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="my_crm_lookup"
                className="w-full text-[11px] px-2.5 py-1.5 rounded-lg font-mono outline-none"
                style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#e2e8f0" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#1a1a2e")}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: "#334155" }}>Method</label>
              <select
                value={form.httpMethod}
                onChange={(e) => setForm((f) => ({ ...f, httpMethod: e.target.value as HttpMethod }))}
                className="w-full text-[11px] px-2.5 py-1.5 rounded-lg outline-none"
                style={{ background: "#050508", border: "1px solid #1a1a2e", color: METHOD_COLORS[form.httpMethod].text }}
              >
                {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: "#334155" }}>Description (shown to the AI)</label>
            <textarea
              required
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Looks up a customer in our internal CRM by email address"
              className="w-full text-[11px] px-2.5 py-1.5 rounded-lg resize-none outline-none"
              style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#e2e8f0" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1a1a2e")}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: "#334155" }}>Endpoint URL</label>
            <input
              required
              type="url"
              value={form.httpUrl}
              onChange={(e) => setForm((f) => ({ ...f, httpUrl: e.target.value }))}
              placeholder="https://api.yourapp.com/customers/lookup"
              className="w-full text-[11px] px-2.5 py-1.5 rounded-lg font-mono outline-none"
              style={{ background: "#050508", border: "1px solid #1a1a2e", color: "#e2e8f0" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1a1a2e")}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: "#334155" }}>
              Headers <span style={{ color: "#1e293b" }}>(JSON)</span>
            </label>
            <textarea
              rows={2}
              value={form.headers}
              onChange={(e) => setForm((f) => ({ ...f, headers: e.target.value }))}
              placeholder='{"Authorization": "Bearer YOUR_TOKEN"}'
              className="w-full text-[11px] px-2.5 py-1.5 rounded-lg resize-none outline-none font-mono"
              style={{ background: "#050508", border: `1px solid ${headerError ? "rgba(239,68,68,0.4)" : "#1a1a2e"}`, color: "#e2e8f0" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = headerError ? "rgba(239,68,68,0.4)" : "#1a1a2e")}
            />
            {headerError && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{headerError}</p>}
          </div>

          {/* Parameters */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: "#334155" }}>Parameters</label>
              <button
                type="button"
                onClick={addParam}
                className="text-[10px] px-2 py-0.5 rounded"
                style={{ color: "#7c3aed", border: "1px solid rgba(124,58,237,0.25)" }}
              >
                + Add
              </button>
            </div>
            <div className="space-y-1.5">
              {form.params.map((p, i) => (
                <ParamRow
                  key={i}
                  param={p}
                  onChange={(updated) => updateParam(i, updated)}
                  onDelete={() => deleteParam(i)}
                />
              ))}
              {form.params.length === 0 && (
                <p className="text-[10px] text-center py-2" style={{ color: "#1e293b" }}>
                  No parameters yet — add input fields the AI can fill in.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="text-[11px] px-4 py-1.5 rounded-lg font-semibold"
              style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "#fff" }}
            >
              {saving ? "Saving..." : editingId ? "Save changes" : "Create tool"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-[11px] px-3 py-1.5 rounded-lg"
              style={{ color: "#475569", border: "1px solid #1a1a2e" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tools list */}
      {tools.length === 0 && !showForm ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "#0d0d12", border: "1px dashed #1a1a2e" }}
        >
          <p className="text-sm mb-1" style={{ color: "#334155" }}>No custom tools yet</p>
          <p className="text-xs" style={{ color: "#1e293b" }}>
            Connect any HTTP endpoint as an agent tool. The AI will use it like a native integration.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tools.map((tool) => {
            const mc = METHOD_COLORS[tool.httpMethod];
            return (
              <div
                key={tool.id}
                className="rounded-xl p-3"
                style={{ background: "#0d0d12", border: "1px solid #1a1a2e" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                        style={{ background: mc.bg, color: mc.text }}
                      >
                        {tool.httpMethod}
                      </span>
                      <code className="text-[11px] font-semibold truncate" style={{ color: "#e2e8f0" }}>
                        {tool.name}
                      </code>
                    </div>
                    <p className="text-[10px] truncate" style={{ color: "#475569" }}>
                      {tool.description}
                    </p>
                    <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: "#1e293b" }}>
                      {tool.httpUrl}
                    </p>
                    {tool.params.length > 0 && (
                      <p className="text-[10px] mt-0.5" style={{ color: "#334155" }}>
                        Params: {tool.params.map((p) => `${p.name}${p.required ? "*" : ""}`).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(tool.id, tool.enabled)}
                      className="text-[10px] px-2 py-1 rounded-lg"
                      style={{
                        background: tool.enabled ? "rgba(34,197,94,0.08)" : "rgba(100,116,139,0.08)",
                        color: tool.enabled ? "#22c55e" : "#64748b",
                        border: `1px solid ${tool.enabled ? "rgba(34,197,94,0.2)" : "rgba(100,116,139,0.2)"}`,
                      }}
                    >
                      {tool.enabled ? "On" : "Off"}
                    </button>
                    <button
                      onClick={() => openEdit(tool)}
                      className="text-[10px] px-2 py-1 rounded-lg"
                      style={{ color: "#475569", border: "1px solid #1a1a2e" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tool.id)}
                      className="text-[10px] px-1.5 py-1 rounded-lg"
                      style={{ color: "#334155" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
