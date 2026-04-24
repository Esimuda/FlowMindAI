// ─── AOS (Autonomous Operations System) types ────────────────────────────────

export interface GoalRepresentation {
  goal: string;
  trigger?: string;
  constraints: string[];
  successMetrics: string[];
  isWorkflowRequest: boolean;
  isConversational: boolean;
}

export interface PlanStep {
  id: number;
  description: string;
  dependencies: number[];
  estimatedTool?: string;
}

export interface OperationalPlan {
  steps: PlanStep[];
  parallelGroups: number[][];
  estimatedComplexity: "simple" | "medium" | "complex";
}

export interface StepToolMapping {
  stepId: number;
  tool: string;
  parameters: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "parallel";
  tool?: string;
  config?: Record<string, unknown>;
  label?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: [string, string][];
}

export type ExecutionState = "init" | "running" | "success" | "failed" | "retrying" | "complete";

export interface ExecutionStepRecord {
  id: string;
  tool: string;
  state: ExecutionState;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
  retryCount: number;
  startedAt: number;
  completedAt?: number;
}

export interface ExecutionObservation {
  executionTimeMs: number;
  successRate: number;
  failures: Array<{ stepId: string; tool: string; error: string }>;
  toolCallCount: number;
  totalRetries: number;
  completedSteps: string[];
}

export interface ReflectionResult {
  hasIssues: boolean;
  issues: Array<{ stepId: string; issue: string; cause: string; fix: string }>;
  shouldRetry: boolean;
  suggestedWorkflowChanges?: string;
  summary: string;
}

export type MemoryType = "short_term" | "long_term" | "pattern";

export interface MemoryEntry {
  id?: string;
  type: MemoryType;
  key: string;
  value: unknown;
  relevance: number;
  createdAt?: number;
  updatedAt?: number;
}

export type AgentStage =
  | "interpreting"
  | "planning"
  | "selecting_tools"
  | "building"
  | "executing"
  | "observing"
  | "reflecting"
  | "optimizing"
  | "complete";

// ─── Agent types ─────────────────────────────────────────────────────────────

export type ToolStatus = "calling" | "success" | "error";

export interface ToolCallRecord {
  id: string;
  toolName: string;
  status: ToolStatus;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

export type AgentRunStatus = "running" | "completed" | "failed";

export interface AgentRun {
  id: string;
  status: AgentRunStatus;
  userMessage: string;
  finalMessage?: string;
  toolCalls: ToolCallRecord[];
  startedAt: number;
  completedAt?: number;
}

// ─── Chat / conversation types ───────────────────────────────────────────────

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  runId?: string;
  toolsSummary?: string[];
  timestamp: number;
}

// ─── SSE stream events ───────────────────────────────────────────────────────

export type AgentStreamEvent =
  | { type: "run_started"; runId: string }
  | { type: "text_delta"; runId: string; text: string }
  | { type: "tool_call_start"; runId: string; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool_call_complete"; runId: string; toolCallId: string; output: string; durationMs: number }
  | { type: "tool_call_error"; runId: string; toolCallId: string; error: string; durationMs: number }
  | { type: "run_complete"; runId: string; finalMessage: string }
  | { type: "run_error"; runId: string; error: string }
  | { type: "profile_saved"; profile: BusinessProfile }
  | { type: "agent_stage"; runId: string; stage: AgentStage; description: string }
  | { type: "reflection_complete"; runId: string; reflection: ReflectionResult }
  | { type: "observation"; runId: string; observation: ExecutionObservation };

// ─── Business profile ─────────────────────────────────────────────────────────

export interface BusinessProfile {
  companyName: string;
  description: string;
  tools: Record<string, string>;
  commonWorkflows: string[];
  defaultReferences?: Record<string, string>;
  notes?: string;
  savedAt: number;
}

// ─── Panel view ───────────────────────────────────────────────────────────────

export type PanelView = "run" | "history" | "library" | "dashboard" | "settings";

// ─── Integration config ───────────────────────────────────────────────────────

export interface IntegrationConfig {
  notionApiKey?: string;
  notionDatabaseId?: string;
  resendApiKey?: string;
  slackWebhookUrl?: string;
  stripeSecretKey?: string;
  hubspotApiKey?: string;
  airtableApiKey?: string;
  airtableBaseId?: string;
  googleSheetsClientEmail?: string;
  googleSheetsPrivateKey?: string;
  gmailClientId?: string;
  gmailClientSecret?: string;
  gmailRefreshToken?: string;
  // Twilio
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  // GitHub
  githubToken?: string;
  // Linear
  linearApiKey?: string;
  // Discord
  discordWebhookUrl?: string;
  // Mailchimp
  mailchimpApiKey?: string;
  mailchimpListId?: string;
}
