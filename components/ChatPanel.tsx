"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/types";
import { INTEGRATION_META } from "@/lib/integrations/meta";
import { loadUserConfig } from "@/components/SettingsPanel";
import { loadProfile } from "@/lib/db/businessProfile";
import { renderMarkdown } from "@/lib/markdown";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  loadingToolName?: string;
  onSend: (message: string) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  isOnboarding?: boolean;
  hasProfile?: boolean;
  onStartOnboarding?: () => void;
}

const PLACEHOLDER_PROMPTS = [
  "Add a new lead to my Notion database for Sarah Chen at Acme Corp",
  "Send a welcome email to john@example.com from Operant AI",
  "Show me the last 5 Stripe charges",
  "Build a workflow: when a new Stripe customer signs up, add to Notion and send a welcome email",
];

function TypingIndicator({ toolName }: { toolName?: string }) {
  return (
    <div className="flex gap-3">
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        O
      </div>
      <div
        className="px-4 py-3"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "4px 18px 18px 18px",
        }}
      >
        {toolName ? (
          <span className="text-xs flex items-center gap-2" style={{ color: "var(--accent)" }}>
            <span
              className="w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            Calling {toolName}...
          </span>
        ) : (
          <div className="flex items-center gap-1.5 py-0.5">
            {[0, 150, 300].map((delay, i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms`, background: "var(--accent)", opacity: i === 0 ? 1 : i === 1 ? 0.7 : 0.4 }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
        style={
          isUser
            ? { background: "var(--accent)", color: "#fff" }
            : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--accent)" }
        }
      >
        {isUser ? "U" : "O"}
      </div>

      <div
        className="max-w-[80%] px-4 py-3 text-sm leading-relaxed"
        style={
          isUser
            ? {
                background: "var(--accent)",
                color: "#fff",
                borderRadius: "18px 4px 18px 18px",
              }
            : {
                background: "var(--surface)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: "4px 18px 18px 18px",
              }
        }
      >
        <div
          className={`md-content${isUser ? " md-content-user" : ""}`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />

        {message.toolsSummary && message.toolsSummary.length > 0 && (
          <div className="mt-2 pt-2 flex flex-wrap gap-1" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            {message.toolsSummary.map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({
  messages,
  isLoading,
  loadingToolName,
  onSend,
  inputValue,
  onInputChange,
  isOnboarding = false,
  hasProfile = false,
  onStartOnboarding,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [connectedNames, setConnectedNames] = useState<string[]>([]);
  const [quickActions, setQuickActions] = useState<string[]>([]);

  const refreshConnected = useCallback(() => {
    const cfg = loadUserConfig();
    setConnectedNames(INTEGRATION_META.filter((m) => m.isConnected(cfg)).map((m) => m.name));
  }, []);

  const refreshQuickActions = useCallback(async () => {
    const profile = await loadProfile();
    setQuickActions(profile?.commonWorkflows?.slice(0, 3) ?? []);
  }, []);

  useEffect(() => {
    refreshConnected();
    refreshQuickActions();
    window.addEventListener("operant-config-saved", refreshConnected);
    window.addEventListener("operant-profile-saved", refreshQuickActions);
    return () => {
      window.removeEventListener("operant-config-saved", refreshConnected);
      window.removeEventListener("operant-profile-saved", refreshQuickActions);
    };
  }, [refreshConnected, refreshQuickActions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--background)" }}>
      {/* Onboarding mode banner */}
      {isOnboarding && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2"
          style={{ background: "var(--accent-glow)", borderBottom: "1px solid rgba(218,119,86,0.25)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--accent)" }} />
          <span className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>
            Business Setup — answer the questions to personalise your agent
          </span>
        </div>
      )}

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {isEmpty && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
            {/* Logo mark */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "var(--accent)" }}
            >
              <svg width="22" height="22" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 7h3M7 2v3M7 9v3M9 7h3M4.5 4.5l1.5 1.5M8 8l1.5 1.5M9.5 4.5L8 6M4.5 9.5L6 8"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="font-semibold text-lg mb-2" style={{ color: "var(--foreground)" }}>
              How can I help you today?
            </h2>
            <p className="text-sm mb-6 max-w-xs leading-relaxed" style={{ color: "var(--foreground-2)" }}>
              Your AI operations agent. Ask me to execute tasks, build workflows, or query your tools.
            </p>

            {/* Setup CTA for new users */}
            {!hasProfile && onStartOnboarding && (
              <button
                onClick={onStartOnboarding}
                className="w-full mb-5 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "var(--accent-glow)",
                  border: "1px solid rgba(218,119,86,0.35)",
                  color: "var(--accent)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(218,119,86,0.6)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(218,119,86,0.35)")}
              >
                Set up your business profile
                <span className="block text-[10px] font-normal mt-0.5" style={{ color: "var(--foreground-2)" }}>
                  Takes 2 minutes · Makes the agent 10× more useful
                </span>
              </button>
            )}

            {/* Suggested actions from business profile */}
            {quickActions.length > 0 && (
              <div className="w-full mb-5">
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--foreground-3)" }}>
                  Your workflows
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => { onInputChange(`Execute the "${action}" workflow`); textareaRef.current?.focus(); }}
                      className="text-[11px] px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5"
                      style={{ background: "rgba(34,197,94,0.07)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.18)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.14)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.07)")}
                    >
                      <span style={{ fontSize: 9 }}>▶</span> {action}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="w-full space-y-2">
              <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "var(--foreground-3)" }}>
                Try an example
              </p>
              {PLACEHOLDER_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { onInputChange(prompt); textareaRef.current?.focus(); }}
                  className="w-full text-left text-xs rounded-xl px-4 py-3 transition-all duration-150 leading-relaxed"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground-2)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(218,119,86,0.4)";
                    e.currentTarget.style.color = "var(--foreground)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.color = "var(--foreground-2)";
                  }}
                >
                  &ldquo;{prompt}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && <TypingIndicator toolName={loadingToolName} />}

        <div ref={bottomRef} />
      </div>

      {/* Connected integrations strip */}
      <div
        className="flex-shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <span className="text-[9px] uppercase tracking-widest flex-shrink-0" style={{ color: "var(--foreground-muted)" }}>
          Active
        </span>
        {connectedNames.length === 0 ? (
          <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>
            No integrations connected — add API keys in Settings
          </span>
        ) : (
          connectedNames.map((name) => (
            <span
              key={name}
              className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "rgba(34,197,94,0.07)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.15)" }}
            >
              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#22c55e" }} />
              {name}
            </span>
          ))
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="flex items-end gap-2 rounded-2xl px-4 py-3 transition-all duration-200"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              onInputChange(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            onFocus={(e) => {
              const parent = e.currentTarget.closest("div") as HTMLElement;
              if (parent) parent.style.borderColor = "rgba(218,119,86,0.5)";
            }}
            onBlur={(e) => {
              const parent = e.currentTarget.closest("div") as HTMLElement;
              if (parent) parent.style.borderColor = "var(--border)";
            }}
            placeholder="Message Operant AI..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed placeholder:text-[var(--foreground-3)]"
            style={{ color: "var(--foreground)", maxHeight: "120px", caretColor: "var(--accent)" }}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 mb-0.5"
            style={
              inputValue.trim() && !isLoading
                ? { background: "var(--accent)" }
                : { background: "var(--surface-2)", cursor: "not-allowed" }
            }
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5"
                stroke={inputValue.trim() && !isLoading ? "#fff" : "var(--foreground-muted)"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-center mt-2" style={{ color: "var(--foreground-muted)" }}>
          Press{" "}
          <kbd
            className="px-1 py-0.5 rounded text-[9px]"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--foreground-3)" }}
          >
            Enter
          </kbd>{" "}
          to send ·{" "}
          <kbd
            className="px-1 py-0.5 rounded text-[9px]"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--foreground-3)" }}
          >
            Shift+Enter
          </kbd>{" "}
          for new line
        </p>
      </div>
    </div>
  );
}
