/**
 * Test-healing study (CLAUDE.md decision 15): a spec that passed on the
 * previous app version fails after an app update (app/break.sh), and an
 * agent has to fix it. One Claude Code phase per run, two conditions:
 *
 * - mcp: Playwright's own bundled healer agent - its instructions verbatim
 *   from node_modules as the system prompt, its `playwright-test` MCP server
 *   (test_run / test_debug / browser tools while paused), plus our scoped
 *   read/write/edit file tools in place of Claude Code's Read/Write/Edit,
 *   which the healer gets when installed as a subagent.
 * - artifacts: the same healer instructions with the browser/debugger steps
 *   swapped for "read the failure output and its page snapshot"
 *   (conditions/heal/artifacts-prompt.md), scoped file tools, and our
 *   run_playwright_test returning Playwright's error-context.md on failure.
 *   No browser, no shell.
 *
 * Both get the same app-knowledge primer (as project context), target URL
 * and task message. The primer is not updated for the break: docs lagging
 * behind the app is the realistic case.
 *
 * Usage: HEAL_BREAK=<app/break.sh name> npm run heal:mcp | heal:artifacts
 *   HEAL_SPEC      starting spec (default fixtures/heal/add-employee-leave.spec.ts)
 * Prints a RUN_ID.
 */
import 'dotenv/config';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { DEFAULT_MODEL, runClaude, type McpServerConfig } from './lib/claude-runner.js';
import { recordPhaseMetrics, summarizePhase } from './lib/metrics.js';
import { newRunId } from './lib/run-id.js';
import { seed } from './seed.js';
import { loadPrimer } from './lib/primer.js';
import { isolatedCwd, bin } from './lib/isolated-session.js';

const execFileAsync = promisify(execFile);

const conditionArg = process.argv[2];
if (conditionArg !== 'mcp' && conditionArg !== 'artifacts') {
  console.error('Usage: heal.ts mcp|artifacts (with HEAL_BREAK set)');
  process.exit(1);
}
const CONDITION: 'mcp' | 'artifacts' = conditionArg;
const MODEL = process.env.CLAUDE_MODEL ?? DEFAULT_MODEL;
const TARGET_APP_URL = process.env.TARGET_APP_URL ?? 'http://localhost:8081/';
const AUTH_STATE_PATH = path.resolve('harness/.auth/state.json');
const REPO_ROOT = process.cwd();
const HEAL_BREAK = process.env.HEAL_BREAK;
const HEAL_SPEC = process.env.HEAL_SPEC ?? 'fixtures/heal/add-employee-leave.spec.ts';
const HEALER_AGENT = 'node_modules/playwright/lib/agents/playwright-test-healer.agent.md';
const SPEC_REL = 'tests/add-employee-leave.spec.ts';
const TASK_MESSAGE =
  `This test passed on the previous release of the app and fails after today's app update. Fix it.\n\n` +
  `The test is \`${SPEC_REL}\` in your output directory.`;

/** Instructions part of an agent file (everything after the YAML front matter). */
function agentInstructions(text: string): string {
  const match = text.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${HEALER_AGENT} has no front matter - has its format changed?`);
  return match[1].trim();
}

async function main(): Promise<void> {
  if (!HEAL_BREAK) {
    console.error('HEAL_BREAK is not set. See `app/break.sh --list`.');
    process.exit(1);
  }

  console.log('==> Refreshing auth state and applying the app update');
  await seed();
  await execFileAsync(path.join(REPO_ROOT, 'app/break.sh'), [HEAL_BREAK], { cwd: REPO_ROOT });

  const runId = newRunId(`heal-${CONDITION}`);
  const runDir = path.resolve('results', runId);
  const rawDir = path.resolve('results/raw', runId);
  await mkdir(path.join(runDir, 'tests'), { recursive: true });
  await mkdir(rawDir, { recursive: true });
  await copyFile(HEAL_SPEC, path.join(runDir, SPEC_REL));

  // One Playwright config per run, used by both conditions' test runners,
  // with absolute paths since the agent's MCP servers run from an isolated
  // cwd outside the repo. Mirrors playwright.config.ts otherwise.
  const configPath = path.join(rawDir, 'playwright.config.ts');
  await writeFile(
    configPath,
    `import { defineConfig } from '@playwright/test';\n` +
      `export default defineConfig(${JSON.stringify(
        {
          testDir: path.join(runDir, 'tests'),
          outputDir: path.join(rawDir, 'test-results'),
          timeout: 30_000,
          use: { baseURL: TARGET_APP_URL, storageState: AUTH_STATE_PATH, headless: true },
        },
        null,
        2,
      )});\n`,
    'utf-8',
  );

  // Sanity check, zero tokens: the starting spec must actually fail after
  // the break, or there's nothing to heal.
  const failedBeforeHeal = await execFileAsync(
    'npx',
    ['playwright', 'test', path.join(runDir, SPEC_REL), '--config', configPath, '--reporter=line'],
    { cwd: REPO_ROOT, timeout: 120_000 },
  ).then(
    () => false,
    () => true,
  );
  if (!failedBeforeHeal) {
    console.error(`!! ${HEAL_SPEC} still passes after break "${HEAL_BREAK}" - nothing to heal. Aborting before any tokens are spent.`);
    process.exit(1);
  }

  const primer = await loadPrimer();
  const conditionPrompt =
    CONDITION === 'mcp'
      ? agentInstructions(await readFile(HEALER_AGENT, 'utf-8'))
      : (await readFile('conditions/heal/artifacts-prompt.md', 'utf-8')).trim();
  const systemPrompt = `${conditionPrompt}\n\nTarget application base URL: ${TARGET_APP_URL}\n\n## App knowledge\n\n${primer.text}`;

  // Both conditions patch with edit_file, like the healer's Edit in real
  // use, rather than rewriting the whole file (user decision 2026-09-26).
  const fileTools = ['read_file', 'write_file', 'edit_file'];
  const ourTools = CONDITION === 'mcp' ? fileTools : [...fileTools, 'run_playwright_test'];
  const mcpServers: Record<string, McpServerConfig> = {
    tools: {
      command: bin(REPO_ROOT, 'tsx'),
      args: [path.join(REPO_ROOT, 'harness/src/mcp-tools-server.ts')],
      env: {
        RUN_DIR: runDir,
        REPO_ROOT,
        TOOLS: ourTools.join(','),
        PW_CONFIG: configPath,
        ERROR_CONTEXT: CONDITION === 'artifacts' ? '1' : '0',
        TEST_CWD: runDir,
      },
    },
  };
  if (CONDITION === 'mcp') {
    // Started from the run directory, like our test runner (TEST_CWD), so
    // relative writes from test code stay inside the run in both conditions.
    const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
    mcpServers['playwright-test'] = {
      command: 'sh',
      args: ['-c', `cd ${q(runDir)} && exec ${q(bin(REPO_ROOT, 'playwright'))} run-test-mcp-server --headless -c ${q(configPath)}`],
    };
  }

  console.log(`==> Run ${runId}: healing after "${HEAL_BREAK}" (${CONDITION}, primer ${primer.version}, tools: ${ourTools.join(', ')})`);
  const startedAt = new Date().toISOString();
  const result = await runClaude({
    systemPrompt,
    userMessage: TASK_MESSAGE,
    model: MODEL,
    // Names no built-in tools, so Bash/Write/Edit etc. stay excluded; every
    // tool of the registered MCP servers is offered (CLAUDE.md decision 3).
    tools: ourTools.map((t) => `mcp__tools__${t}`),
    mcpServers,
    cwd: await isolatedCwd(runId),
  });

  await copyFile(result.transcriptPath, path.join(rawDir, 'heal-transcript.jsonl')).catch((err) => {
    console.warn(`   (could not copy transcript: ${err.message})`);
  });

  // The diff is what the integrity rubric is scored on.
  // Repo-relative paths only: results are committed to a public repo.
  const diff = await execFileAsync('git', ['diff', '--no-index', '--', HEAL_SPEC, path.relative(REPO_ROOT, path.join(runDir, SPEC_REL))], {
    cwd: REPO_ROOT,
  }).then(
    (r) => r.stdout,
    (e: { stdout?: string }) => e.stdout ?? '',
  );
  await writeFile(path.join(runDir, 'heal.diff'), diff, 'utf-8');
  const expected = new Set([SPEC_REL, 'heal.diff', 'metrics.json']);
  const leftoverFiles = (await readdir(runDir, { recursive: true, withFileTypes: true }))
    .filter((e) => e.isFile())
    .map((e) => path.relative(runDir, path.join(e.parentPath, e.name)))
    .filter((f) => !expected.has(f))
    .sort();

  const phase = summarizePhase('heal', MODEL, result, startedAt);
  await recordPhaseMetrics(
    runDir,
    {
      runId,
      condition: CONDITION,
      flow: 'heal',
      promptVariant: 'baseline',
      primerVersion: primer.version,
      heal: { break: HEAL_BREAK, startingSpec: HEAL_SPEC, failedBeforeHeal, tools: Object.keys(mcpServers).flatMap((s) => (s === 'tools' ? ourTools : [`${s} (all tools)`])), leftoverFiles },
    },
    phase,
  );

  console.log(`\n==> Done: ${runId}`);
  console.log(`    tokens: ${result.inputTokens} in / ${result.outputTokens} out (+${result.cacheCreationInputTokens} cache-write / ${result.cacheReadInputTokens} cache-read) - $${result.costUsd.toFixed(4)}, ${result.turns} turns`);
  console.log(`    tool calls: ${JSON.stringify(phase.toolCallCounts)}`);
  if (result.permissionDenials > 0) {
    console.warn(`    WARNING: ${result.permissionDenials} permission denial(s) - the agent was blocked from something`);
  }
  console.log(`    healed test: results/${runId}/${SPEC_REL}`);
  console.log(`    diff: results/${runId}/heal.diff (${diff.split('\n').filter((l) => /^[+-][^+-]/.test(l)).length} changed lines)`);
  if (leftoverFiles.length) console.warn(`    left behind in tests/: ${leftoverFiles.join(', ')}`);
  console.log(`    agent's final message: ${result.resultText.slice(0, 300)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
