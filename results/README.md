# results/

Output of benchmark runs, split into what's kept and what isn't. Now
implemented by `harness/src/explore-mcp.ts` / `generate-mcp.ts` (the CLI
condition will follow the same shape).

## `results/<run-id>/` — committed-eligible

- `test-plan.md` — MCP condition only, from the explore phase.
- `tests/add-employee-leave.spec.ts` (or similar) — the actual
  generated/healed test file. This is the deliverable of the run, not
  exhaust.
- `metrics.json` — `{ runId, condition, phases: [...] }`, one entry per
  phase (`explore` / `generate` for MCP; a single phase for CLI), each
  with `model`, `sessionId` (the Claude Code session id - use it to find
  the full transcript), `inputTokens`, `outputTokens`,
  `cacheCreationInputTokens`, `cacheReadInputTokens`, `costUsd` (list-price
  USD equivalent from `claude -p`'s own result, even though it's not
  billed per-call under a subscription - useful for comparison), `turns`,
  `toolCallCounts` (`{ toolName: count }`), `permissionDenials` (>0 means
  the agent got blocked from something - a real signal), `startedAt`,
  `finishedAt`, `durationMs`. Quality rubric scores will be added once
  `docs/quality-rubric.md` and the scorer exist (`TODO.md`).

## `results/raw/<run-id>/` — gitignored, local only

`<phase>-transcript.jsonl` — a copy of that phase's full Claude Code
session transcript (from `~/.claude/projects/<slug>/<session-id>.jsonl`,
copied here so it doesn't depend on Claude Code's own session retention).
Includes raw MCP accessibility-tree snapshots — exactly the bulk this
project is trying to measure, not something to duplicate into git. Plus
any Playwright run artifacts (screenshots, videos, trace files, HTML
reports, under the repo root's own gitignored `test-results/` /
`playwright-report/`). Useful for debugging a specific run locally. Never
committed — see `.gitignore`.
