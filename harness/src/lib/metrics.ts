import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ClaudeRunResult } from './claude-runner.js';
import type { PrimerVersion } from './primer.js';
import type { NudgeVersion } from './nudge.js';

export interface PhaseMetrics {
  phase: string;
  model: string;
  resolvedModels: string[];
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  costUsd: number;
  turns: number;
  toolCallCounts: Record<string, number>;
  permissionDenials: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface HealMeta {
  /** app/break.sh break applied before the agent started. */
  break: string;
  /** Repo-relative path of the checked-in spec the run started from. */
  startingSpec: string;
  /** Sanity check: the starting spec was run once after the break, before the agent. */
  failedBeforeHeal: boolean;
  /** Tools the agent got, as registered (differs by condition). */
  tools: string[];
  /** Files the agent left in its run directory besides the healed spec (e.g. debug probes). */
  leftoverFiles: string[];
}

export interface RunMeta {
  runId: string;
  /** Generation: 'mcp' | 'codegen'. Healing: 'mcp' (Playwright's healer) | 'artifacts' (test output + error-context only). */
  condition: 'mcp' | 'codegen' | 'artifacts';
  /** Absent on runs from before healing existed; those are all 'generate'. */
  flow?: 'generate' | 'heal';
  promptVariant: 'baseline' | 'nudged';
  /** Which docs/testing-best-practices/<version>.md a nudged run got. Absent on baseline runs. */
  nudgeVersion?: NudgeVersion;
  primerVersion: PrimerVersion;
  heal?: HealMeta;
}

interface RunMetrics extends RunMeta {
  phases: PhaseMetrics[];
}

export function summarizePhase(
  phase: string,
  model: string,
  result: ClaudeRunResult,
  startedAt: string,
): PhaseMetrics {
  const toolCallCounts: Record<string, number> = {};
  for (const call of result.toolCalls) {
    toolCallCounts[call.name] = (toolCallCounts[call.name] ?? 0) + 1;
  }
  return {
    phase,
    model,
    resolvedModels: result.resolvedModels,
    sessionId: result.sessionId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cacheCreationInputTokens: result.cacheCreationInputTokens,
    cacheReadInputTokens: result.cacheReadInputTokens,
    costUsd: result.costUsd,
    turns: result.turns,
    toolCallCounts,
    permissionDenials: result.permissionDenials,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: result.durationMs,
  };
}

export async function readRunMetrics(runDir: string): Promise<RunMetrics | null> {
  try {
    return JSON.parse(await readFile(path.join(runDir, 'metrics.json'), 'utf-8')) as RunMetrics;
  } catch {
    return null;
  }
}

export async function recordPhaseMetrics(runDir: string, meta: RunMeta, phase: PhaseMetrics): Promise<void> {
  await mkdir(runDir, { recursive: true });
  // A later phase of the same run (generate-mcp.ts) appends to what the
  // first phase wrote; run-level fields stay as the first phase recorded
  // them - callers check for mismatches before getting here.
  const existing: RunMetrics = (await readRunMetrics(runDir)) ?? { ...meta, phases: [] };
  existing.phases.push(phase);
  await writeFile(path.join(runDir, 'metrics.json'), JSON.stringify(existing, null, 2), 'utf-8');
}
