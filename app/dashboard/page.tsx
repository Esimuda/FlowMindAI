"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import ChatPanel from "@/components/ChatPanel";
import AgentRunPanel from "@/components/AgentRunPanel";
import RunHistoryPanel from "@/components/RunHistoryPanel";
import WorkflowLibraryPanel from "@/components/WorkflowLibraryPanel";
import SettingsPanel from "@/components/SettingsPanel";
import DashboardPanel from "@/components/DashboardPanel";
import { AgentRun, AgentStage, AgentStreamEvent, BusinessProfile, ChatMessage, ExecutionObservation, PanelView, ReflectionResult, ToolCallRecord } from "@/lib/types";
import { loadProfile, saveProfile } from "@/lib/db/businessProfile";
import { persistRun, listRunHistory } from "@/lib/db/runHistory";
import { listWorkflows } from "@/lib/db/workflows";
import { useScheduler } from "@/lib/useScheduler";
import { createClient } from "@/lib/supabase/client";
import Anthropic from "@anthropic-ai/sdk";

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const ONBOARDING_Q1 =
  "Hi! I'll ask you a few quick questions to understand your business — this helps me work much more effectively for you.\n\nLet's start: **What's your company name and what does your business do?**";

export default function Home() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingToolName, setLoadingToolName] = useState<string | undefined>();
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);
  const [panelView, setPanelView] = useState<PanelView>("run");
  const [inputValue, setInputValue] = useState("");
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [oauthToast, setOauthToast] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<{ stage: AgentStage; description: string } | null>(null);
  const [currentReflection, setCurrentReflection] = useState<ReflectionResult | null>(null);
  const [currentObservation, setCurrentObservation] = useState<ExecutionObservation | null>(null);

  const historyRef = useRef<Anthropic.MessageParam[]>([]);
  const isOnboardingRef = useRef(false);

  useScheduler();

  // Show OAuth success toast
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      const labels: Record<string, string> = { google: "Google connected — Gmail, Sheets, and Calendar are ready.", slack: "Slack connected." };
      setOauthToast(labels[connected] ?? `${connected} connected.`);
      setTimeout(() => setOauthToast(null), 4000);
    }
  }, [searchParams]);

  // Load business profile on mount + listen for start-onboarding + run-workflow events
  useEffect(() => {
    loadProfile().then(setBusinessProfile);

    const handleStart = () => startOnboarding();
    window.addEventListener("flowmind-start-onboarding", handleStart);

    const handleRun = (e: Event) => {
      const { prompt } = (e as CustomEvent<{ prompt: string }>).detail;
      handleSend(prompt);
      setPanelView("run");
    };
    window.addEventListener("flowmind-run-workflow", handleRun);

    return () => {
      window.removeEventListener("flowmind-start-onboarding", handleStart);
      window.removeEventListener("flowmind-run-workflow", handleRun);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startOnboarding = useCallback(() => {
    isOnboardingRef.current = true;
    setIsOnboarding(true);
    setMessages([]);
    setCurrentRun(null);
    setInputValue("");
    const q1: ChatMessage = { id: generateId(), role: "assistant", content: ONBOARDING_Q1, timestamp: Date.now() };
    setMessages([q1]);
    historyRef.current = [{ role: "assistant", content: ONBOARDING_Q1 }];
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = { id: generateId(), role: "user", content: text.trim(), timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setIsLoading(true);
      setLoadingToolName(undefined);

      let finalMessage = "";

      // ── Onboarding mode ──────────────────────────────────────────────────────
      if (isOnboardingRef.current) {
        try {
          const res = await fetch("/api/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text.trim(), conversationHistory: historyRef.current }),
          });

          if (!res.body) throw new Error("No response body");
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let savedProfile: BusinessProfile | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const event = JSON.parse(line.slice(6)) as AgentStreamEvent;
                if (event.type === "text_delta") finalMessage = event.text;
                if (event.type === "profile_saved") {
                  savedProfile = await saveProfile(event.profile);
                  setBusinessProfile(savedProfile);
                  window.dispatchEvent(new CustomEvent("flowmind-profile-saved"));
                  isOnboardingRef.current = false;
                  setIsOnboarding(false);
                }
              } catch { /* malformed, skip */ }
            }
          }

          historyRef.current = [
            ...historyRef.current,
            { role: "user", content: text.trim() },
            { role: "assistant", content: finalMessage || "Done." },
          ];

          setMessages((prev) => [...prev, {
            id: generateId(), role: "assistant",
            content: finalMessage || "Done.", timestamp: Date.now(),
          }]);
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          setMessages((prev) => [...prev, {
            id: generateId(), role: "assistant",
            content: `Something went wrong: ${error}`, timestamp: Date.now(),
          }]);
        }

        setIsLoading(false);
        return;
      }

      // ── Normal agent mode ────────────────────────────────────────────────────
      setPanelView("run");

      const runId = generateId();
      const run: AgentRun = { id: runId, status: "running", userMessage: text.trim(), toolCalls: [], startedAt: Date.now() };
      setCurrentRun(run);
      setCurrentStage(null);
      setCurrentReflection(null);
      setCurrentObservation(null);

      const toolsSummary: string[] = [];

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            conversationHistory: historyRef.current,
            businessProfile: await loadProfile(),
            savedWorkflows: await listWorkflows(),
            runHistory: (await listRunHistory()).slice(0, 20),
          }),
        });

        if (!res.body) throw new Error("No response body");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as AgentStreamEvent;
              handleStreamEvent(event);
            } catch { /* malformed, skip */ }
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        setCurrentRun((prev) => prev ? { ...prev, status: "failed", completedAt: Date.now() } : prev);
        finalMessage = `Something went wrong: ${error}`;
      }

      setMessages((prev) => [...prev, {
        id: generateId(), role: "assistant", content: finalMessage || "Done.",
        runId, toolsSummary: toolsSummary.length > 0 ? toolsSummary : undefined, timestamp: Date.now(),
      }]);

      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: text.trim() },
        { role: "assistant", content: finalMessage || "Done." },
      ];

      // Persist the completed run to Supabase
      setCurrentRun((prev) => {
        if (prev) persistRun(prev).catch(console.error);
        return prev;
      });

      setIsLoading(false);
      setLoadingToolName(undefined);

      function handleStreamEvent(event: AgentStreamEvent) {
        switch (event.type) {
          case "tool_call_start": {
            setLoadingToolName(event.toolName);
            const tc: ToolCallRecord = { id: event.toolCallId, toolName: event.toolName, status: "calling", input: event.input, startedAt: Date.now() };
            setCurrentRun((prev) => prev ? { ...prev, toolCalls: [...prev.toolCalls, tc] } : prev);
            break;
          }
          case "tool_call_complete": {
            setLoadingToolName(undefined);
            setCurrentRun((prev) => {
              if (!prev) return prev;
              const updated = prev.toolCalls.map((tc) =>
                tc.id === event.toolCallId ? { ...tc, status: "success" as const, output: event.output, completedAt: Date.now() } : tc
              );
              return { ...prev, toolCalls: updated };
            });
            setCurrentRun((prev) => {
              if (prev) {
                const tc = prev.toolCalls.find((t) => t.id === event.toolCallId);
                if (tc && !toolsSummary.includes(tc.toolName)) toolsSummary.push(tc.toolName);
              }
              return prev;
            });
            break;
          }
          case "tool_call_error": {
            setLoadingToolName(undefined);
            setCurrentRun((prev) => {
              if (!prev) return prev;
              const updated = prev.toolCalls.map((tc) =>
                tc.id === event.toolCallId ? { ...tc, status: "error" as const, error: event.error, completedAt: Date.now() } : tc
              );
              return { ...prev, toolCalls: updated };
            });
            break;
          }
          case "text_delta":    finalMessage = event.text; break;
          case "run_complete":
            finalMessage = event.finalMessage;
            setCurrentRun((prev) => prev ? { ...prev, status: "completed", finalMessage: event.finalMessage, completedAt: Date.now() } : prev);
            setCurrentStage(null);
            break;
          case "run_error":
            setCurrentRun((prev) => prev ? { ...prev, status: "failed", completedAt: Date.now() } : prev);
            setCurrentStage(null);
            finalMessage = `Error: ${event.error}`;
            break;
          case "agent_stage":
            setCurrentStage({ stage: event.stage, description: event.description });
            break;
          case "reflection_complete":
            setCurrentReflection(event.reflection);
            break;
          case "observation":
            setCurrentObservation(event.observation);
            break;
        }
      }
    },
    [isLoading]
  );

  const hasActiveRun = currentRun?.status === "running";

  return (
    <div className="flex flex-col h-screen overflow-hidden grid-overlay aurora" style={{ background: "#050508" }}>
      <TopBar activeView={panelView} onViewChange={setPanelView} hasActiveRun={hasActiveRun} />

      {/* OAuth success toast */}
      {oauthToast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-xs font-medium shadow-lg"
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
        >
          {oauthToast}
        </div>
      )}

      <main className="flex flex-1 overflow-hidden">
        <div className="w-full md:w-[40%] flex-shrink-0 overflow-hidden" style={{ borderRight: "1px solid #1a1a2e" }}>
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            loadingToolName={loadingToolName}
            onSend={handleSend}
            inputValue={inputValue}
            onInputChange={setInputValue}
            isOnboarding={isOnboarding}
            hasProfile={!!businessProfile}
            onStartOnboarding={startOnboarding}
          />
        </div>

        <div className="hidden md:flex flex-1 overflow-hidden flex-col px-6 py-6">
          {panelView === "run"      && <AgentRunPanel run={currentRun} currentStage={currentStage} reflection={currentReflection} observation={currentObservation} />}
          {panelView === "history"   && <RunHistoryPanel />}
          {panelView === "library"   && <WorkflowLibraryPanel />}
          {panelView === "dashboard" && <DashboardPanel />}
          {panelView === "settings"  && <SettingsPanel businessProfile={businessProfile} />}
        </div>
      </main>
    </div>
  );
}
