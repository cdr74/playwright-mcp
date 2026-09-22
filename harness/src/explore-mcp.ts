/**
 * MCP condition, phase 1: explore the live app via Claude Code (with
 * Playwright MCP registered) and write a test plan. See
 * conditions/mcp/explore-prompt.md for the exact instructions given to
 * the agent, and CLAUDE.md decision 3 for why this drives Claude Code
 * (`claude -p`) rather than the Anthropic API directly.
 *
 * Usage: npm run explore:mcp
 * Prints a RUN_ID to continue with `npm run generate:mcp`.
 */
import 'dotenv/config';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { runClaude } from './lib/claude-runner.js';
import { PLAYWRIGHT_MCP_TOOLS, withServerPrefix } from './lib/mcp-tool-names.js';
import { recordPhaseMetrics, summarizePhase } from './lib/metrics.js';
import { newRunId } from './lib/run-id.js';

const MODEL = process.env.CLAUDE_MODEL ?? 'sonnet';
const TARGET_APP_URL = process.env.TARGET_APP_URL ?? 'http://localhost:8081/';
const AUTH_STATE_PATH = path.resolve('harness/.auth/state.json');
const REPO_ROOT = process.cwd();
const FLOW_PATH = process.argv[2] ?? 'flows/01-add-employee-leave-request.md';

async function main(): Promise<void> {
  const runId = process.env.RUN_ID ?? newRunId('mcp');
  const runDir = path.resolve('results', runId);
  const rawDir = path.resolve('results/raw', runId);
  await mkdir(runDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });

  const [appKnowledge, explorePrompt, flowSpec] = await Promise.all([
    readFile('docs/app-knowledge.md', 'utf-8'),
    readFile('conditions/mcp/explore-prompt.md', 'utf-8'),
    readFile(FLOW_PATH, 'utf-8'),
  ]);
  const systemPrompt = `${explorePrompt}\n\nTarget application base URL: ${TARGET_APP_URL}\n\n## App knowledge\n\n${appKnowledge}`;

  console.log(`==> Run ${runId}: exploring via Claude Code + Playwright MCP`);
  const startedAt = new Date().toISOString();

  const result = await runClaude({
    systemPrompt,
    userMessage: flowSpec,
    model: MODEL,
    tools: [...withServerPrefix('playwright', PLAYWRIGHT_MCP_TOOLS), 'mcp__tools__write_file'],
    mcpServers: {
      playwright: {
        command: 'npx',
        args: ['playwright-mcp', '--browser', 'chromium', '--headless', '--isolated', '--storage-state', AUTH_STATE_PATH],
      },
      tools: {
        command: 'npx',
        args: ['tsx', 'harness/src/mcp-tools-server.ts'],
        env: { RUN_DIR: runDir, REPO_ROOT },
      },
    },
    cwd: REPO_ROOT,
  });

  await copyFile(result.transcriptPath, path.join(rawDir, 'explore-transcript.jsonl')).catch((err) => {
    console.warn(`   (could not copy transcript: ${err.message})`);
  });

  const phase = summarizePhase('explore', MODEL, result, startedAt);
  await recordPhaseMetrics(runDir, runId, 'mcp', phase);

  console.log(`\n==> Done: ${runId}`);
  console.log(`    tokens: ${result.inputTokens} in / ${result.outputTokens} out (+${result.cacheCreationInputTokens} cache-write / ${result.cacheReadInputTokens} cache-read) - $${result.costUsd.toFixed(4)}, ${result.turns} turns`);
  console.log(`    tool calls: ${JSON.stringify(phase.toolCallCounts)}`);
  if (result.permissionDenials > 0) {
    console.warn(`    WARNING: ${result.permissionDenials} permission denial(s) - the agent was blocked from something`);
  }
  console.log(`    test plan: results/${runId}/test-plan.md`);
  console.log(`    agent's final message: ${result.resultText.slice(0, 300)}`);
  console.log(`\nNext: RUN_ID=${runId} npm run generate:mcp`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
