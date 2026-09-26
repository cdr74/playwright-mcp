/**
 * A tiny local MCP server exposing exactly two tools, both scoped to a
 * single run's output directory (path-traversal guarded): write_file and
 * run_playwright_test. Registered alongside (or instead of) playwright-mcp
 * for each `claude -p` invocation - see harness/src/lib/claude-runner.ts.
 *
 * Why a real MCP server rather than Claude Code's native Write/Bash: those
 * are unscoped (Bash is a general shell). This keeps the Codegen condition's
 * "shell scoped to npx playwright test, nothing broader" design intent,
 * and the MCP condition's "file write" tool scoped the same way, intact
 * under Claude Code exactly as they were under the (now retired) direct
 * Anthropic API harness.
 *
 * Run directory comes from the RUN_DIR env var (set via the mcp-config's
 * "env", not a CLI arg, since MCP server config in Claude Code doesn't
 * take a persistent stdin/prompt - env is the reliable channel).
 *
 * Healing runs (CLAUDE.md decision 15) configure it further, also via env;
 * none of these are set for the generation study, so its tool surface is
 * unchanged:
 * - TOOLS: comma-separated tools to expose (default
 *   "write_file,run_playwright_test"). Healing adds read_file (and
 *   edit_file, a find-and-replace patch like Claude Code's own Edit, if
 *   enabled); the MCP heal condition drops run_playwright_test, since
 *   Playwright's healer brings its own test runner.
 * - PW_CONFIG: Playwright config for run_playwright_test (default: the
 *   repo's playwright.config.ts).
 * - ERROR_CONTEXT=1: on failure, append the error-context.md page snapshot
 *   Playwright writes for each failed test - what a tester working from
 *   the CLI would open next.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const OUTPUT_CHAR_LIMIT = 4000;
const ERROR_CONTEXT_CHAR_LIMIT = 12000;

const runDir = process.env.RUN_DIR;
if (!runDir) {
  console.error('RUN_DIR env var is required');
  process.exit(1);
}
const resolvedBase = path.resolve(runDir);
const repoRoot = process.env.REPO_ROOT ?? process.cwd();
const enabledTools = new Set((process.env.TOOLS ?? 'write_file,run_playwright_test').split(',').map((t) => t.trim()));
const pwConfig = process.env.PW_CONFIG;
const includeErrorContext = process.env.ERROR_CONTEXT === '1';

function resolveScoped(relPath: string): string {
  const resolved = path.resolve(resolvedBase, relPath);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    throw new Error(`path "${relPath}" escapes the run's output directory`);
  }
  return resolved;
}

const server = new McpServer({ name: 'bench-scoped-tools', version: '0.0.1' });

if (enabledTools.has('write_file')) server.registerTool(
  'write_file',
  {
    description:
      'Write a UTF-8 text file, overwriting it if it already exists. "path" is relative to this run\'s output directory - you cannot write outside of it.',
    inputSchema: {
      path: z.string().describe('Relative file path to write, e.g. "test-plan.md" or "tests/add-employee-leave.spec.ts"'),
      content: z.string().describe('Full UTF-8 file content'),
    },
  },
  async ({ path: relPath, content }) => {
    try {
      const resolved = resolveScoped(relPath);
      await mkdir(path.dirname(resolved), { recursive: true });
      await writeFile(resolved, content, 'utf-8');
      return { content: [{ type: 'text' as const, text: `Wrote ${content.length} bytes to ${relPath}` }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);

if (enabledTools.has('read_file')) server.registerTool(
  'read_file',
  {
    description:
      'Read a UTF-8 text file. "path" is relative to this run\'s output directory - you cannot read outside of it.',
    inputSchema: {
      path: z.string().describe('Relative file path to read, e.g. "tests/add-employee-leave.spec.ts"'),
    },
  },
  async ({ path: relPath }) => {
    try {
      const text = await readFile(resolveScoped(relPath), 'utf-8');
      return { content: [{ type: 'text' as const, text }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);

if (enabledTools.has('edit_file')) server.registerTool(
  'edit_file',
  {
    description:
      'Replace one exact occurrence of "old_string" with "new_string" in a file. Fails if "old_string" is missing or not unique. "path" is relative to this run\'s output directory.',
    inputSchema: {
      path: z.string().describe('Relative file path to edit'),
      old_string: z.string().describe('Exact text to replace; must occur exactly once'),
      new_string: z.string().describe('Replacement text'),
    },
  },
  async ({ path: relPath, old_string, new_string }) => {
    try {
      const resolved = resolveScoped(relPath);
      const text = await readFile(resolved, 'utf-8');
      const count = text.split(old_string).length - 1;
      if (count !== 1) throw new Error(`old_string occurs ${count} times in ${relPath}, expected exactly 1`);
      await writeFile(resolved, text.replace(old_string, () => new_string), 'utf-8');
      return { content: [{ type: 'text' as const, text: `Edited ${relPath}` }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);

// Playwright prints "Error Context: <path>/error-context.md" for each failed
// test; read those files (relative paths are relative to the runner's cwd).
async function errorContexts(output: string): Promise<string> {
  const paths = [...output.matchAll(/Error Context: (\S+error-context\.md)/g)].map((m) => m[1]);
  const parts: string[] = [];
  for (const p of [...new Set(paths)]) {
    try {
      const text = await readFile(path.resolve(repoRoot, p), 'utf-8');
      parts.push(`--- ${path.basename(path.dirname(p))}/error-context.md ---\n${text}`);
    } catch {
      parts.push(`--- ${p}: could not be read ---`);
    }
  }
  const joined = parts.join('\n\n');
  return joined.length > ERROR_CONTEXT_CHAR_LIMIT ? `${joined.slice(0, ERROR_CONTEXT_CHAR_LIMIT)}\n[truncated]` : joined;
}

if (enabledTools.has('run_playwright_test')) server.registerTool(
  'run_playwright_test',
  {
    description:
      'Run a Playwright test file with "npx playwright test <path>" and return condensed pass/fail output. "path" is relative to this run\'s output directory.',
    inputSchema: {
      path: z.string().describe('Relative path to the test file to run'),
    },
  },
  async ({ path: relPath }) => {
    try {
      const resolved = resolveScoped(relPath);
      try {
        const { stdout, stderr } = await execFileAsync(
          'npx',
          ['playwright', 'test', resolved, '--reporter=line', ...(pwConfig ? ['--config', pwConfig] : [])],
          { cwd: repoRoot, timeout: 60_000 },
        );
        return { content: [{ type: 'text' as const, text: `PASS\n${(stdout + stderr).slice(-OUTPUT_CHAR_LIMIT)}` }] };
      } catch (runErr) {
        const e = runErr as { stdout?: string; stderr?: string; message?: string };
        const output = `${e.stdout ?? ''}${e.stderr ?? ''}` || (e.message ?? String(runErr));
        const context = includeErrorContext ? await errorContexts(output) : '';
        const text = `FAIL\n${output.slice(-OUTPUT_CHAR_LIMIT)}${context ? `\n\n${context}` : ''}`;
        return { content: [{ type: 'text' as const, text }] };
      }
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
