/**
 * Claude Code auto-attaches this repo's CLAUDE.md (15.9K chars) and its
 * auto-memory files to every `claude -p` session's context, regardless of
 * `--system-prompt` (a full replace of the *rendered* system prompt, not
 * of this separate auto-attachment mechanism) - confirmed empirically by
 * inspecting real transcripts, not assumed. Every benchmark run before
 * this fix carried that extra, unaccounted-for context. See `TODO.md`
 * Gotchas for the full investigation, including why `--bare` (forces
 * API-key billing, defeating CLAUDE.md decision 3's entire reason for
 * existing) and `--safe-mode` (also silently drops explicitly-configured
 * `--mcp-config` servers - confirmed by direct testing, not the docs)
 * were both ruled out.
 *
 * The fix: run `claude -p` from a cwd outside this repo entirely.
 * CLAUDE.md auto-discovery walks up from cwd looking for the file, and
 * auto-memory is scoped by a project slug derived from cwd
 * (`cwd.replace(/\//g, '-')`, same formula the transcript path uses) - an
 * external cwd gets a fresh, empty memory space with nothing to attach.
 * Confirmed via a real `--mcp-config` + `--strict-mcp-config` tool call
 * still working correctly from a relocated cwd (a genuine
 * `permission_denials` entry, not a hallucinated one) before trusting
 * this in the real harness.
 *
 * Relocating cwd means `npx <bin>` can no longer resolve this repo's
 * locally-installed binaries via its own cwd-relative node_modules walk,
 * so callers must use `bin()` below (an absolute path into this repo's
 * `node_modules/.bin/`) as the MCP server `command` instead of `npx`.
 */
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function isolatedCwd(runId: string): Promise<string> {
  const dir = path.join(os.tmpdir(), 'playwright-mcp-bench', runId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function bin(repoRoot: string, name: string): string {
  return path.join(repoRoot, 'node_modules', '.bin', name);
}
