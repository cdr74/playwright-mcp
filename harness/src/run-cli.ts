/**
 * CLI condition: a single Claude Code phase with only the scoped
 * write_file/run_playwright_test tools - no playwright-mcp, and
 * critically no Bash (see CLAUDE.md decision 1 - "no raw shell").
 * Starts from a checked-in `playwright codegen` recording embedded
 * directly in the prompt (fixtures/), not live browser exploration.
 * See conditions/cli/README.md.
 *
 * Usage: npm run bench:cli
 * Prints a RUN_ID.
 */
import 'dotenv/config';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { runClaude } from './lib/claude-runner.js';
import { recordPhaseMetrics, summarizePhase } from './lib/metrics.js';
import { newRunId } from './lib/run-id.js';
import { seed } from './seed.js';

const MODEL = process.env.CLAUDE_MODEL ?? 'sonnet';
const TARGET_APP_URL = process.env.TARGET_APP_URL ?? 'http://localhost:8081/';
const REPO_ROOT = process.cwd();
const FLOW_PATH = process.argv[2] ?? 'flows/01-add-employee-leave-request.md';
const FIXTURE_PATH = process.env.CODEGEN_FIXTURE ?? 'fixtures/01-add-employee-leave-request.codegen.ts';

async function main(): Promise<void> {
  console.log('==> Refreshing auth state (session may have expired since last run)');
  await seed();

  const runId = process.env.RUN_ID ?? newRunId('cli');
  const runDir = path.resolve('results', runId);
  const rawDir = path.resolve('results/raw', runId);
  await mkdir(runDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });

  const [appKnowledge, systemPromptBase, flowSpec, codegenRecording] = await Promise.all([
    readFile('docs/app-knowledge.md', 'utf-8'),
    readFile('conditions/cli/system-prompt.md', 'utf-8'),
    readFile(FLOW_PATH, 'utf-8'),
    readFile(FIXTURE_PATH, 'utf-8').catch(() => {
      throw new Error(
        `Could not read codegen fixture at ${FIXTURE_PATH}. Record it first: see fixtures/README.md.`,
      );
    }),
  ]);
  const systemPrompt = `${systemPromptBase}\n\nTarget application base URL: ${TARGET_APP_URL}\n\n## App knowledge\n\n${appKnowledge}`;
  const userMessage = `## Flow\n\n${flowSpec}\n\n## Raw codegen recording (starting point - clean this up, don't just wrap it)\n\n\`\`\`typescript\n${codegenRecording}\n\`\`\``;

  console.log(`==> Run ${runId}: CLI condition via Claude Code (no browser tools, no shell)`);
  const startedAt = new Date().toISOString();

  const result = await runClaude({
    systemPrompt,
    userMessage,
    model: MODEL,
    tools: ['mcp__tools__write_file', 'mcp__tools__run_playwright_test'],
    mcpServers: {
      tools: {
        command: 'npx',
        args: ['tsx', 'harness/src/mcp-tools-server.ts'],
        env: { RUN_DIR: runDir, REPO_ROOT },
      },
    },
    cwd: REPO_ROOT,
  });

  await copyFile(result.transcriptPath, path.join(rawDir, 'cli-transcript.jsonl')).catch((err) => {
    console.warn(`   (could not copy transcript: ${err.message})`);
  });

  const phase = summarizePhase('generate', MODEL, result, startedAt);
  await recordPhaseMetrics(runDir, runId, 'cli', phase);

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
