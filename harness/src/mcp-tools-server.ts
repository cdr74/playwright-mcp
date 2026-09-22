/**
 * A tiny local MCP server exposing exactly two tools, both scoped to a
 * single run's output directory (path-traversal guarded): write_file and
 * run_playwright_test. Registered alongside (or instead of) playwright-mcp
 * for each `claude -p` invocation - see harness/src/lib/claude-runner.ts.
 *
 * Why a real MCP server rather than Claude Code's native Write/Bash: those
 * are unscoped (Bash is a general shell). This keeps the CLI condition's
 * "shell scoped to npx playwright test, nothing broader" design intent,
 * and the MCP condition's "file write" tool scoped the same way, intact
 * under Claude Code exactly as they were under the (now retired) direct
 * Anthropic API harness.
 *
 * Run directory comes from the RUN_DIR env var (set via the mcp-config's
 * "env", not a CLI arg, since MCP server config in Claude Code doesn't
 * take a persistent stdin/prompt - env is the reliable channel).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const OUTPUT_CHAR_LIMIT = 4000;

const runDir = process.env.RUN_DIR;
if (!runDir) {
  console.error('RUN_DIR env var is required');
  process.exit(1);
}
const resolvedBase = path.resolve(runDir);
const repoRoot = process.env.REPO_ROOT ?? process.cwd();

function resolveScoped(relPath: string): string {
  const resolved = path.resolve(resolvedBase, relPath);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    throw new Error(`path "${relPath}" escapes the run's output directory`);
  }
  return resolved;
}

const server = new McpServer({ name: 'bench-scoped-tools', version: '0.0.1' });

server.registerTool(
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

server.registerTool(
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
          ['playwright', 'test', resolved, '--reporter=line'],
          { cwd: repoRoot, timeout: 60_000 },
        );
        return { content: [{ type: 'text' as const, text: `PASS\n${(stdout + stderr).slice(-OUTPUT_CHAR_LIMIT)}` }] };
      } catch (runErr) {
        const e = runErr as { stdout?: string; stderr?: string; message?: string };
        const output = `${e.stdout ?? ''}${e.stderr ?? ''}` || (e.message ?? String(runErr));
        return { content: [{ type: 'text' as const, text: `FAIL\n${output.slice(-OUTPUT_CHAR_LIMIT)}` }] };
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
