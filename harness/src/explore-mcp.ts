/**
 * MCP condition, phase 1: explore the live app via Claude Code (with
 * Playwright MCP registered) and write a test plan. See
 * conditions/mcp/explore-prompt.md for the exact instructions given to
 * the agent, and CLAUDE.md decision 3 for why this drives Claude Code
 * (`claude -p`) rather than the Anthropic API directly.
 *
 * Usage: npm run explore:mcp (or npm run explore:mcp:nudged)
 * Prints a RUN_ID to continue with `npm run generate:mcp` (matching
 * variant - see NUDGE_QUALITY below).
 */
import 'dotenv/config';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { runClaude } from './lib/claude-runner.js';
import { recordPhaseMetrics, summarizePhase } from './lib/metrics.js';
import { newRunId } from './lib/run-id.js';
import { seed } from './seed.js';
import { isolatedCwd, bin } from './lib/isolated-session.js';

const MODEL = process.env.CLAUDE_MODEL ?? 'sonnet';
const TARGET_APP_URL = process.env.TARGET_APP_URL ?? 'http://localhost:8081/';
const AUTH_STATE_PATH = path.resolve('harness/.auth/state.json');
const REPO_ROOT = process.cwd();
const FLOW_PATH = process.argv[2] ?? 'flows/01-add-employee-leave-request.md';
// This phase never injects testing-best-practices.md itself (it writes a
// prose test plan, not code - see docs/testing-best-practices.md's own
// header for why only code-writing phases get it), but it still needs to
// know about nudge mode to mint a RUN_ID with the matching prefix, since
// generate-mcp.ts reuses whatever RUN_ID this phase produces.
const NUDGE_QUALITY = process.env.NUDGE_QUALITY === '1';

async function main(): Promise<void> {
  console.log('==> Refreshing auth state (session may have expired since last run)');
  await seed();

  const runId = process.env.RUN_ID ?? newRunId(NUDGE_QUALITY ? 'mcp-nudged' : 'mcp');
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
    // --tools only governs Claude Code's built-in tools (naming none of them
    // here excludes Bash/Write/etc.); every tool of every registered MCP
    // server is offered regardless - by decision, see CLAUDE.md decision 13.
    tools: ['mcp__tools__write_file'],
    mcpServers: {
      playwright: {
        command: bin(REPO_ROOT, 'playwright-mcp'),
        args: ['--browser', 'chromium', '--headless', '--isolated', '--storage-state', AUTH_STATE_PATH, '--output-dir', path.join(rawDir, 'playwright-mcp')],
      },
      tools: {
        command: bin(REPO_ROOT, 'tsx'),
        args: [path.join(REPO_ROOT, 'harness/src/mcp-tools-server.ts')],
        env: { RUN_DIR: runDir, REPO_ROOT },
      },
    },
    cwd: await isolatedCwd(runId),
  });

  await copyFile(result.transcriptPath, path.join(rawDir, 'explore-transcript.jsonl')).catch((err) => {
    console.warn(`   (could not copy transcript: ${err.message})`);
  });

  const phase = summarizePhase('explore', MODEL, result, startedAt);
  await recordPhaseMetrics(runDir, runId, 'mcp', phase, NUDGE_QUALITY ? 'nudged' : 'baseline');

  console.log(`\n==> Done: ${runId}`);
  console.log(`    tokens: ${result.inputTokens} in / ${result.outputTokens} out (+${result.cacheCreationInputTokens} cache-write / ${result.cacheReadInputTokens} cache-read) - $${result.costUsd.toFixed(4)}, ${result.turns} turns`);
  console.log(`    tool calls: ${JSON.stringify(phase.toolCallCounts)}`);
  if (result.permissionDenials > 0) {
    console.warn(`    WARNING: ${result.permissionDenials} permission denial(s) - the agent was blocked from something`);
  }
  console.log(`    test plan: results/${runId}/test-plan.md`);
  console.log(`    agent's final message: ${result.resultText.slice(0, 300)}`);
  console.log(`\nNext: RUN_ID=${runId} npm run ${NUDGE_QUALITY ? 'generate:mcp:nudged' : 'generate:mcp'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
