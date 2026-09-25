import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ClaudeRunResult } from './claude-runner.js';
import type { PrimerVersion } from './primer.js';

export interface PhaseMetrics {
  phase: string;
  model: string;
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

export interface RunMeta {
  runId: string;
  condition: 'mcp' | 'codegen';
  promptVariant: 'baseline' | 'nudged';
  primerVersion: PrimerVersion;
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
