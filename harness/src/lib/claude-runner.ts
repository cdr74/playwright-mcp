/**
 * Drives Claude Code non-interactively (`claude -p`) as the agent, instead
 * of calling the Anthropic API directly - billed against an existing
 * Claude Code subscription rather than metered API usage. See
 * CLAUDE.md decision 3 for why, and TODO.md for what was verified before
 * building this (claude -p --output-format json returns exact token
 * usage/cost/turns; --mcp-config successfully registers playwright-mcp;
 * --dangerously-skip-permissions is required for unattended runs - only
 * confirmed working from an unrestricted terminal, not from inside a
 * sandboxed Claude Code session, since a nested session's own auto-mode
 * classifier blocks spawning a permission-bypassed child).
 *
 * Exact token/cost/turn numbers come straight off claude -p's own JSON
 * result - no transcript parsing needed for those. Tool-call attribution
 * (which tools, how many times) does need the session transcript, since
 * the top-level result doesn't break that out; MCP-provided tools are
 * logged there as "mcp__<server-name>__<tool-name>".
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const execFileAsync = promisify(execFile);

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface ClaudeRunOptions {
  systemPrompt: string;
  userMessage: string;
  tools: string[];
  mcpServers?: Record<string, McpServerConfig>;
  model?: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface ToolCallRecord {
  name: string;
  input: unknown;
}

export interface ClaudeRunResult {
  sessionId: string;
  resultText: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  costUsd: number;
  turns: number;
  durationMs: number;
  permissionDenials: number;
  toolCalls: ToolCallRecord[];
  transcriptPath: string;
}

interface ClaudePrintJsonResult {
  session_id: string;
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  permission_denials?: unknown[];
  is_error?: boolean;
}

function projectSlug(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

export async function runClaude(options: ClaudeRunOptions): Promise<ClaudeRunResult> {
  const cwd = options.cwd ?? process.cwd();
  const sessionId = crypto.randomUUID();

  const args = [
    '-p', options.userMessage,
    '--output-format', 'json',
    '--model', options.model ?? 'sonnet',
    '--system-prompt', options.systemPrompt,
    '--tools', options.tools.join(','),
    '--strict-mcp-config',
    '--dangerously-skip-permissions',
    '--session-id', sessionId,
  ];
  if (options.mcpServers && Object.keys(options.mcpServers).length > 0) {
    args.push('--mcp-config', JSON.stringify({ mcpServers: options.mcpServers }));
  }

  const transcriptPath = path.join(os.homedir(), '.claude', 'projects', projectSlug(cwd), `${sessionId}.jsonl`);
  // The old 10-minute default silently killed the slowest run of the first
  // repeat batch mid-debugging (see TODO.md Gotchas) - a cap this close to
  // real run times censors exactly the right tail of the variance the
  // benchmark is trying to measure.
  const timeoutMs = options.timeoutMs ?? Number(process.env.CLAUDE_RUN_TIMEOUT_MS ?? 30 * 60 * 1000);

  let stdout: string;
  try {
    const result = await execFileAsync('claude', args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
    const reason = e.killed ? `killed after ${timeoutMs / 60000} min timeout (CLAUDE_RUN_TIMEOUT_MS)` : (e.message ?? String(err));
    throw new Error(
      `claude -p failed: ${reason}\nSession transcript (usage is recoverable from it): ${transcriptPath}\n${e.stderr ?? ''}\n${e.stdout ?? ''}`,
    );
  }

  const parsed = JSON.parse(stdout) as ClaudePrintJsonResult;
  const toolCalls = await extractToolCalls(transcriptPath);

  return {
    sessionId: parsed.session_id ?? sessionId,
    resultText: parsed.result ?? '',
    inputTokens: parsed.usage?.input_tokens ?? 0,
    outputTokens: parsed.usage?.output_tokens ?? 0,
    cacheCreationInputTokens: parsed.usage?.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: parsed.usage?.cache_read_input_tokens ?? 0,
    costUsd: parsed.total_cost_usd ?? 0,
    turns: parsed.num_turns ?? 0,
    durationMs: parsed.duration_ms ?? 0,
    permissionDenials: Array.isArray(parsed.permission_denials) ? parsed.permission_denials.length : 0,
    toolCalls,
    transcriptPath,
  };
}

async function extractToolCalls(transcriptPath: string): Promise<ToolCallRecord[]> {
  let raw: string;
  try {
    raw = await readFile(transcriptPath, 'utf-8');
  } catch {
    return [];
  }
  const calls: ToolCallRecord[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let entry: { message?: { content?: unknown } };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block && typeof block === 'object' && block.type === 'tool_use') {
        calls.push({ name: block.name, input: block.input });
      }
    }
  }
  return calls;
}
