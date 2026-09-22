import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ClaudeRunResult } from './claude-runner.js';

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

interface RunMetrics {
  runId: string;
  condition: 'mcp' | 'cli';
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

export async function recordPhaseMetrics(
  runDir: string,
  runId: string,
  condition: 'mcp' | 'cli',
  phase: PhaseMetrics,
): Promise<void> {
  const metricsPath = path.join(runDir, 'metrics.json');
  await mkdir(runDir, { recursive: true });

  let existing: RunMetrics = { runId, condition, phases: [] };
  try {
    existing = JSON.parse(await readFile(metricsPath, 'utf-8')) as RunMetrics;
  } catch {
    // no existing metrics.json for this run yet - start fresh
  }
  existing.phases.push(phase);
  await writeFile(metricsPath, JSON.stringify(existing, null, 2), 'utf-8');
}
