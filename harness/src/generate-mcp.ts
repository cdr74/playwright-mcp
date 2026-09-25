/**
 * MCP condition, phase 2: turn the test plan from explore-mcp.ts into a
 * real Playwright test and run it, iterating on failures, via Claude Code
 * (with Playwright MCP + the scoped tools server registered). See
 * conditions/mcp/generate-prompt.md for the exact instructions given to
 * the agent.
 *
 * Usage: RUN_ID=<id from explore-mcp.ts> npm run generate:mcp
 */
import 'dotenv/config';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { runClaude } from './lib/claude-runner.js';
import { PLAYWRIGHT_MCP_TOOLS, withServerPrefix } from './lib/mcp-tool-names.js';
import { recordPhaseMetrics, summarizePhase } from './lib/metrics.js';
import { seed } from './seed.js';

const MODEL = process.env.CLAUDE_MODEL ?? 'sonnet';
const TARGET_APP_URL = process.env.TARGET_APP_URL ?? 'http://localhost:8081/';
const AUTH_STATE_PATH = path.resolve('harness/.auth/state.json');
const REPO_ROOT = process.cwd();
const FLOW_PATH = process.argv[2] ?? 'flows/01-add-employee-leave-request.md';

async function main(): Promise<void> {
  const runId = process.env.RUN_ID;
  if (!runId) {
    console.error('RUN_ID is not set. Run `npm run explore:mcp` first, then `RUN_ID=<id> npm run generate:mcp`.');
    process.exit(1);
  }

  console.log('==> Refreshing auth state (session may have expired since explore:mcp ran)');
  await seed();

  const runDir = path.resolve('results', runId);
  const rawDir = path.resolve('results/raw', runId);
  const testPlanPath = path.join(runDir, 'test-plan.md');

  let testPlan: string;
  try {
    testPlan = await readFile(testPlanPath, 'utf-8');
  } catch {
    console.error(`Could not read ${testPlanPath}. Run \`npm run explore:mcp\` first for this RUN_ID.`);
    process.exit(1);
  }

  const [appKnowledge, generatePrompt, flowSpec] = await Promise.all([
    readFile('docs/app-knowledge.md', 'utf-8'),
    readFile('conditions/mcp/generate-prompt.md', 'utf-8'),
    readFile(FLOW_PATH, 'utf-8'),
  ]);
  const systemPrompt = `${generatePrompt}\n\nTarget application base URL: ${TARGET_APP_URL}\n\n## App knowledge\n\n${appKnowledge}`;
  const userMessage = `## Flow\n\n${flowSpec}\n\n## Test plan (from exploration)\n\n${testPlan}`;

  console.log(`==> Run ${runId}: generating and running the test via Claude Code + Playwright MCP`);
  const startedAt = new Date().toISOString();
  await mkdir(rawDir, { recursive: true });

  const result = await runClaude({
    systemPrompt,
    userMessage,
    model: MODEL,
    tools: [
      ...withServerPrefix('playwright', PLAYWRIGHT_MCP_TOOLS),
      'mcp__tools__write_file',
      'mcp__tools__run_playwright_test',
    ],
    mcpServers: {
      playwright: {
        command: 'npx',
        args: ['playwright-mcp', '--browser', 'chromium', '--headless', '--isolated', '--storage-state', AUTH_STATE_PATH, '--output-dir', path.join(rawDir, 'playwright-mcp')],
      },
      tools: {
        command: 'npx',
        args: ['tsx', 'harness/src/mcp-tools-server.ts'],
        env: { RUN_DIR: runDir, REPO_ROOT },
      },
    },
    cwd: REPO_ROOT,
  });

  await copyFile(result.transcriptPath, path.join(rawDir, 'generate-transcript.jsonl')).catch((err) => {
    console.warn(`   (could not copy transcript: ${err.message})`);
  });

  const phase = summarizePhase('generate', MODEL, result, startedAt);
  await recordPhaseMetrics(runDir, runId, 'mcp', phase);

  console.log(`\n==> Done: ${runId}`);
  console.log(`    tokens: ${result.inputTokens} in / ${result.outputTokens} out (+${result.cacheCreationInputTokens} cache-write / ${result.cacheReadInputTokens} cache-read) - $${result.costUsd.toFixed(4)}, ${result.turns} turns`);
  console.log(`    tool calls: ${JSON.stringify(phase.toolCallCounts)}`);
  if (result.permissionDenials > 0) {
    console.warn(`    WARNING: ${result.permissionDenials} permission denial(s) - the agent was blocked from something`);
  }
  console.log(`    test: results/${runId}/tests/add-employee-leave.spec.ts`);
  console.log(`    metrics: results/${runId}/metrics.json`);
  console.log(`    agent's final message: ${result.resultText.slice(0, 300)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
