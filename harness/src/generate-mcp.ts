/**
 * MCP condition, phase 2: turn the test plan from explore-mcp.ts into a
 * real Playwright test and run it, iterating on failures, via Claude Code
 * (with Playwright MCP + the scoped tools server registered). See
 * conditions/mcp/generate-prompt.md for the exact instructions given to
 * the agent.
 *
 * Usage: RUN_ID=<id from explore-mcp.ts> npm run generate:mcp
 * (or generate:mcp:nudged, matching whichever explore:mcp variant minted
 * the RUN_ID - NUDGE_QUALITY appends docs/testing-best-practices.md to
 * this phase's system prompt, since this is the phase that writes code;
 * see that file's own header for why explore-mcp.ts doesn't also get it)
 */
import 'dotenv/config';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { runClaude } from './lib/claude-runner.js';
import { PLAYWRIGHT_MCP_TOOLS, withServerPrefix } from './lib/mcp-tool-names.js';
import { recordPhaseMetrics, summarizePhase } from './lib/metrics.js';
import { seed } from './seed.js';
import { isolatedCwd, bin } from './lib/isolated-session.js';

const MODEL = process.env.CLAUDE_MODEL ?? 'sonnet';
const TARGET_APP_URL = process.env.TARGET_APP_URL ?? 'http://localhost:8081/';
const AUTH_STATE_PATH = path.resolve('harness/.auth/state.json');
const REPO_ROOT = process.cwd();
const FLOW_PATH = process.argv[2] ?? 'flows/01-add-employee-leave-request.md';
const NUDGE_QUALITY = process.env.NUDGE_QUALITY === '1';

async function main(): Promise<void> {
  const runId = process.env.RUN_ID;
  if (!runId) {
    console.error('RUN_ID is not set. Run `npm run explore:mcp` first, then `RUN_ID=<id> npm run generate:mcp`.');
    process.exit(1);
  }

  const runIdLooksNudged = runId.startsWith('mcp-nudged-');
  if (runIdLooksNudged !== NUDGE_QUALITY) {
    console.warn(
      `    WARNING: RUN_ID "${runId}" looks ${runIdLooksNudged ? 'nudged' : 'baseline'} but ` +
      `NUDGE_QUALITY is ${NUDGE_QUALITY ? 'set' : 'unset'} - these should match (use ` +
      `${runIdLooksNudged ? 'generate:mcp:nudged' : 'generate:mcp'} for this RUN_ID). Continuing ` +
      `with NUDGE_QUALITY's value for the system prompt and metrics.`,
    );
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

  const [appKnowledge, generatePrompt, flowSpec, testingBestPractices] = await Promise.all([
    readFile('docs/app-knowledge.md', 'utf-8'),
    readFile('conditions/mcp/generate-prompt.md', 'utf-8'),
    readFile(FLOW_PATH, 'utf-8'),
    NUDGE_QUALITY ? readFile('docs/testing-best-practices.md', 'utf-8') : Promise.resolve(null),
  ]);
  const nudgeBlock = testingBestPractices ? `\n\n## Testing best practices\n\n${testingBestPractices}` : '';
  const systemPrompt = `${generatePrompt}\n\nTarget application base URL: ${TARGET_APP_URL}\n\n## App knowledge\n\n${appKnowledge}${nudgeBlock}`;
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

  await copyFile(result.transcriptPath, path.join(rawDir, 'generate-transcript.jsonl')).catch((err) => {
    console.warn(`   (could not copy transcript: ${err.message})`);
  });

  const phase = summarizePhase('generate', MODEL, result, startedAt);
  await recordPhaseMetrics(runDir, runId, 'mcp', phase, NUDGE_QUALITY ? 'nudged' : 'baseline');

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
