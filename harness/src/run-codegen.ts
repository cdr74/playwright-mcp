/**
 * Codegen condition: a single Claude Code phase with only the scoped
 * write_file/run_playwright_test tools - no playwright-mcp, and
 * critically no Bash (see CLAUDE.md decision 1 - "no raw shell"). The
 * agent itself never gets real command-line access - see README.md "How
 * the comparison works" for why this is called the Codegen condition,
 * not "CLI". Starts from a checked-in `playwright codegen` recording
 * embedded directly in the prompt (fixtures/), not live browser
 * exploration. See conditions/codegen/README.md.
 *
 * Usage: npm run bench:codegen (or bench:codegen:nudged, which appends
 * docs/testing-best-practices.md to the system prompt - see that file's
 * own header for the baseline-vs-nudged comparison this enables)
 * Prints a RUN_ID.
 */
import 'dotenv/config';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_MODEL, runClaude } from './lib/claude-runner.js';
import { recordPhaseMetrics, summarizePhase } from './lib/metrics.js';
import { newRunId } from './lib/run-id.js';
import { seed } from './seed.js';
import { loadPrimer } from './lib/primer.js';
import { isolatedCwd, bin } from './lib/isolated-session.js';

const MODEL = process.env.CLAUDE_MODEL ?? DEFAULT_MODEL;
const TARGET_APP_URL = process.env.TARGET_APP_URL ?? 'http://localhost:8081/';
const REPO_ROOT = process.cwd();
const FLOW_PATH = process.argv[2] ?? 'flows/01-add-employee-leave-request.md';
const FIXTURE_PATH = process.env.CODEGEN_FIXTURE ?? 'fixtures/01-add-employee-leave-request.codegen.ts';
const NUDGE_QUALITY = process.env.NUDGE_QUALITY === '1';

async function main(): Promise<void> {
  console.log('==> Refreshing auth state (session may have expired since last run)');
  await seed();

  const runId = process.env.RUN_ID ?? newRunId(NUDGE_QUALITY ? 'codegen-nudged' : 'codegen');
  const runDir = path.resolve('results', runId);
  const rawDir = path.resolve('results/raw', runId);
  await mkdir(runDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });

  const [primer, systemPromptBase, flowSpec, codegenRecording, testingBestPractices] = await Promise.all([
    loadPrimer(),
    readFile('conditions/codegen/system-prompt.md', 'utf-8'),
    readFile(FLOW_PATH, 'utf-8'),
    readFile(FIXTURE_PATH, 'utf-8').catch(() => {
      throw new Error(
        `Could not read codegen fixture at ${FIXTURE_PATH}. Record it first: see fixtures/README.md.`,
      );
    }),
    NUDGE_QUALITY ? readFile('docs/testing-best-practices.md', 'utf-8') : Promise.resolve(null),
  ]);
  const nudgeBlock = testingBestPractices ? `\n\n## Testing best practices\n\n${testingBestPractices}` : '';
  const systemPrompt = `${systemPromptBase}\n\nTarget application base URL: ${TARGET_APP_URL}\n\n## App knowledge\n\n${primer.text}${nudgeBlock}`;
  const userMessage = `## Flow\n\n${flowSpec}\n\n## Raw codegen recording (starting point - clean this up, don't just wrap it)\n\n\`\`\`typescript\n${codegenRecording}\n\`\`\``;

  console.log(`==> Run ${runId}: Codegen condition via Claude Code (no browser tools, no shell) (primer ${primer.version})`);
  const startedAt = new Date().toISOString();

  const result = await runClaude({
    systemPrompt,
    userMessage,
    model: MODEL,
    tools: ['mcp__tools__write_file', 'mcp__tools__run_playwright_test'],
    mcpServers: {
      tools: {
        command: bin(REPO_ROOT, 'tsx'),
        args: [path.join(REPO_ROOT, 'harness/src/mcp-tools-server.ts')],
        env: { RUN_DIR: runDir, REPO_ROOT },
      },
    },
    cwd: await isolatedCwd(runId),
  });

  await copyFile(result.transcriptPath, path.join(rawDir, 'codegen-transcript.jsonl')).catch((err) => {
    console.warn(`   (could not copy transcript: ${err.message})`);
  });

  const phase = summarizePhase('generate', MODEL, result, startedAt);
  await recordPhaseMetrics(
    runDir,
    { runId, condition: 'codegen', promptVariant: NUDGE_QUALITY ? 'nudged' : 'baseline', primerVersion: primer.version },
    phase,
  );

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
