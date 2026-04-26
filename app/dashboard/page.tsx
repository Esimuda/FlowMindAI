"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import ChatPanel from "@/components/ChatPanel";
import AgentRunPanel from "@/components/AgentRunPanel";
import RunHistoryPanel from "@/components/RunHistoryPanel";
import WorkflowLibraryPanel from "@/components/WorkflowLibraryPanel";
import SettingsPanel from "@/components/SettingsPanel";
import DashboardPanel from "@/components/DashboardPanel";
import MonitoringPanel from "@/components/MonitoringPanel";
import CustomToolsPanel from "@/components/CustomToolsPanel";
import MemoryPanel from "@/components/MemoryPanel";
import MobileBottomNav from "@/components/MobileBottomNav";
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

function DashboardInner() {
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
  const [mobileShowPanel, setMobileShowPanel] = useState(false);
  const [currentStage, setCurrentStage] = useState<{ stage: AgentStage; description: string } | null>(null);
  const [currentReflection, setCurrentReflection] = useState<ReflectionResult | null>(null);
  const [currentObservation, setCurrentObservation] = useState<ExecutionObservation | null>(null);

  const historyRef = useRef<Anthropic.MessageParam[]>([]);
  const isOnboardingRef = useRef(false);
  const cachedWorkflowsRef = useRef<Awaited<ReturnType<typeof listWorkflows>>>([]);
  const cachedRunHistoryRef = useRef<AgentRun[]>([]);

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

  // Preload all agent context on mount so first send is instant
  useEffect(() => {
    Promise.all([
      loadProfile().then(setBusinessProfile),
      listWorkflows().then((w) => { cachedWorkflowsRef.current = w; }),
      listRunHistory().then((r) => { cachedRunHistoryRef.current = r.slice(0, 20); }),
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load business profile on mount + listen for start-onboarding + run-workflow events
  useEffect(() => {

    const handleStart = () => startOnboarding();
    window.addEventListener("operant-start-onboarding", handleStart);

    const handleRun = (e: Event) => {
      const { prompt } = (e as CustomEvent<{ prompt: string }>).detail;
      handleSend(prompt);
      setPanelView("run");
    };
    window.addEventListener("operant-run-workflow", handleRun);

    return () => {
      window.removeEventListener("operant-start-onboarding", handleStart);
      window.removeEventListener("operant-run-workflow", handleRun);
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
                  window.dispatchEvent(new CustomEvent("operant-profile-saved"));
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
      setMobileShowPanel(true);

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
            businessProfile: businessProfile,
            savedWorkflows: cachedWorkflowsRef.current,
            runHistory: cachedRunHistoryRef.current,
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

      const toolContext = toolsSummary.length > 0
        ? `\n[Tools used: ${toolsSummary.join(", ")}]`
        : "";
      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: text.trim() },
        { role: "assistant", content: (finalMessage || "Done.") + toolContext },
      ];

      // Persist the completed run to Supabase and refresh cache
      setCurrentRun((prev) => {
        if (prev) {
          persistRun(prev).then(() => {
            listRunHistory().then((r) => { cachedRunHistoryRef.current = r.slice(0, 20); });
          }).catch(console.error);
        }
        return prev;
      });
      listWorkflows().then((w) => { cachedWorkflowsRef.current = w; }).catch(console.error);

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

  const mobileTab = mobileShowPanel ? panelView : "chat";

  function handleMobileTabChange(tab: "chat" | typeof panelView) {
    if (tab === "chat") {
      setMobileShowPanel(false);
    } else {
      setPanelView(tab);
      setMobileShowPanel(true);
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      <TopBar activeView={panelView} onViewChange={setPanelView} hasActiveRun={hasActiveRun} />

      {/* OAuth success toast */}
      {oauthToast && (
        <div
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 px-4 py-3 rounded-xl text-xs font-medium shadow-lg"
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
        >
          {oauthToast}
        </div>
      )}

      <main className="flex flex-1 overflow-hidden">
        {/* Chat panel: full screen on mobile when mobileShowPanel=false, 40% on desktop */}
        <div
          className={`flex-shrink-0 overflow-hidden ${mobileShowPanel ? "hidden md:flex md:flex-col" : "flex flex-col"} w-full md:w-[40%]`}
          style={{ borderRight: "1px solid var(--border)" }}
        >
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

        {/* Right panel: full screen on mobile when mobileShowPanel=true, 60% on desktop */}
        <div
          className={`flex-1 overflow-hidden flex-col px-4 py-4 md:px-6 md:py-6 ${mobileShowPanel ? "flex" : "hidden md:flex"}`}
        >
          {panelView === "run"       && <AgentRunPanel run={currentRun} currentStage={currentStage} reflection={currentReflection} observation={currentObservation} />}
          {panelView === "history"   && <RunHistoryPanel />}
          {panelView === "library"   && <WorkflowLibraryPanel />}
          {panelView === "dashboard" && <DashboardPanel />}
          {panelView === "settings"  && <SettingsPanel businessProfile={businessProfile} />}
          {panelView === "monitor"   && <MonitoringPanel />}
          {panelView === "tools"     && <CustomToolsPanel />}
          {panelView === "memory"    && <MemoryPanel />}
        </div>
      </main>

      <MobileBottomNav
        activeTab={mobileTab}
        onTabChange={handleMobileTabChange}
        hasActiveRun={hasActiveRun}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div style={{ background: "#050508", height: "100vh" }} />}>
      <DashboardInner />
    </Suspense>
  );
}
