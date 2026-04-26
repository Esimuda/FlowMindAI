import { interpretIntent } from "./interpreter";
import { createPlan } from "./planner";
import { selectTools } from "./toolSelector";
import { synthesizeWorkflow } from "./builder";
import { observe } from "./observer";
import { reflect } from "./reflector";
import { optimize } from "./optimizer";
import { MemoryManager } from "./memory";
import { getActiveTools } from "./tools";
import { runAgent, RunnerOptions } from "./runner";
import { createExecution, saveExecution } from "@/lib/db/executions";
import type {
  AgentStreamEvent,
  ExecutionStepRecord,
  WorkflowGraph,
} from "@/lib/types";

export interface OrchestratorOptions extends RunnerOptions {
  userId: string;
  // customTools is inherited from RunnerOptions
}

const MAX_RETRIES = 2;

export async function runOrchestrator(options: OrchestratorOptions): Promise<string> {
  const { message, runId, emit, config, businessProfile, userId } = options;

  // ── Layer 1: Intent Interpretation ──────────────────────────────────────────
  emit({ type: "agent_stage", runId, stage: "interpreting", description: "Analyzing request..." });

  const businessCtx = businessProfile
    ? `Company: ${businessProfile.companyName}. ${businessProfile.description}`
    : undefined;

  const goal = await interpretIntent(message, businessCtx);

  // ── Memory init ──────────────────────────────────────────────────────────────
  const memory = new MemoryManager(userId);
  await memory.init();
  memory.setShortTerm("goal", goal);

  const relevantMemories = memory.searchRelevant(goal.goal, 6);

  // Route simple / conversational requests to the fast single-agent path
  if (goal.isConversational && !goal.isWorkflowRequest) {
    return runAgent({ ...options, memoryContext: relevantMemories });
  }

  // ── Layer 2: Planning ────────────────────────────────────────────────────────
  emit({ type: "agent_stage", runId, stage: "planning", description: "Breaking goal into steps..." });

  const activeToolNames = getActiveTools(config).map((t) => t.name as string);
  const plan = await createPlan(goal, activeToolNames);
  memory.setShortTerm("plan", plan);

  // ── Layer 3: Tool Selection ──────────────────────────────────────────────────
  emit({ type: "agent_stage", runId, stage: "selecting_tools", description: "Mapping steps to tools..." });

  const activeToolDefs = getActiveTools(config).map((t) => ({
    name: t.name as string,
    description: typeof t.description === "string" ? t.description : "",
  }));
  const toolMappings = await selectTools(plan, activeToolDefs);
  memory.setShortTerm("toolMappings", toolMappings);

  // ── Layer 4: Workflow Synthesis ──────────────────────────────────────────────
  emit({ type: "agent_stage", runId, stage: "building", description: "Synthesizing workflow graph..." });

  let graph: WorkflowGraph = await synthesizeWorkflow(plan, toolMappings, goal.goal);
  memory.setShortTerm("graph", graph);

  // ── Execution loop with self-healing ────────────────────────────────────────
  let finalMessage = "";
  let retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    const isRetry = retryCount > 0;
    emit({
      type: "agent_stage",
      runId,
      stage: "executing",
      description: isRetry
        ? `Self-healing retry ${retryCount}/${MAX_RETRIES}...`
        : "Executing workflow...",
    });

    // Track execution steps by intercepting emit events
    const executionSteps: ExecutionStepRecord[] = [];
    const executionStartedAt = Date.now();
    const execution = createExecution(userId, goal.goal.slice(0, 60));

    const interceptEmit = (event: AgentStreamEvent) => {
      emit(event);
      if (event.type === "tool_call_start") {
        executionSteps.push({
          id: event.toolCallId,
          tool: event.toolName,
          state: "running",
          input: event.input,
          retryCount: 0,
          startedAt: Date.now(),
        });
      }
      if (event.type === "tool_call_complete") {
        const step = executionSteps.find((s) => s.id === event.toolCallId);
        if (step) {
          step.state = "success";
          step.output = event.output;
          step.completedAt = Date.now();
        }
      }
      if (event.type === "tool_call_error") {
        const step = executionSteps.find((s) => s.id === event.toolCallId);
        if (step) {
          step.state = "failed";
          step.error = event.error;
          step.completedAt = Date.now();
        }
      }
    };

    // Build an execution message that embeds the plan context
    const executionMessage = buildExecutionMessage(goal.goal, plan, toolMappings, isRetry);

    try {
      finalMessage = await runAgent({ ...options, message: executionMessage, emit: interceptEmit, memoryContext: relevantMemories });
    } catch (err) {
      finalMessage = `Execution error: ${err instanceof Error ? err.message : String(err)}`;
    }

    // ── Layer 6: Observation ─────────────────────────────────────────────────
    emit({ type: "agent_stage", runId, stage: "observing", description: "Analyzing results..." });

    const observation = observe(executionSteps, executionStartedAt);
    emit({ type: "observation", runId, observation });

    execution.steps = executionSteps;
    execution.observation = observation;
    execution.status = observation.failures.length === 0 ? "success" : "failed";
    execution.retryCount = retryCount;
    execution.completedAt = Date.now();

    // ── Layer 7: Reflection ──────────────────────────────────────────────────
    emit({ type: "agent_stage", runId, stage: "reflecting", description: "Diagnosing results..." });

    const reflectionMemories = memory.searchRelevant(goal.goal, 6);
    const reflection = await reflect(observation, reflectionMemories);
    execution.reflection = reflection;
    emit({ type: "reflection_complete", runId, reflection });

    // Persist execution record (non-blocking)
    saveExecution(execution).catch(() => {});

    // Persist failure patterns to long-term memory
    if (reflection.hasIssues) {
      for (const issue of reflection.issues) {
        await memory.savePattern(`failure:${issue.issue.slice(0, 40)}`, {
          failure: issue.issue,
          cause: issue.cause,
          solution: issue.fix,
          tool: executionSteps.find((s) => s.id === issue.stepId)?.tool,
          learnedAt: Date.now(),
        });
      }
      memory.deduplicatePatterns();
    }

    // Save successful run pattern to long-term memory
    if (!reflection.hasIssues) {
      await memory.saveLongTerm(`success:${goal.goal.slice(0, 50)}`, {
        goal: goal.goal,
        steps: plan.steps.map((s) => s.description),
        tools: toolMappings.map((m) => m.tool),
        completedAt: Date.now(),
      }, 0.9);
    }

    if (!reflection.shouldRetry || retryCount >= MAX_RETRIES) break;

    // ── Layer 8: Optimization ────────────────────────────────────────────────
    emit({ type: "agent_stage", runId, stage: "optimizing", description: "Optimizing workflow..." });
    graph = await optimize(graph, reflection);
    memory.setShortTerm("graph", graph);

    retryCount++;
  }

  emit({ type: "agent_stage", runId, stage: "complete", description: "Done." });
  return finalMessage;
}

function buildExecutionMessage(
  goalDescription: string,
  plan: { steps: Array<{ id: number; description: string; estimatedTool?: string }> },
  toolMappings: Array<{ stepId: number; tool: string }>,
  isRetry: boolean
): string {
  const stepLines = plan.steps
    .map((s) => {
      const mapping = toolMappings.find((m) => m.stepId === s.id);
      return `Step ${s.id}: ${s.description}${mapping?.tool ? ` → tool: ${mapping.tool}` : ""}`;
    })
    .join("\n");

  const prefix = isRetry
    ? "Previous execution had failures. Retry with corrected approach.\n\n"
    : "";

  return `${prefix}Execute this automation: ${goalDescription}

Planned steps:
${stepLines}

Execute all steps using the specified tools. When done, output a Run Report in the exact format from your instructions: what ran, what succeeded with key outputs, and what failed with the error and a fix suggestion.`;
}
