# results/

Output of benchmark runs, split into what's kept and what isn't.
Implemented by `harness/src/explore-mcp.ts` / `generate-mcp.ts` (MCP
condition, two phases) and `harness/src/run-cli.ts` (CLI condition, one
phase named `"generate"` for comparability). See `docs/results.md` for the
first aggregated write-up across both.

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
  `finishedAt`, `durationMs`. Doesn't hold quality scores yet -
  `docs/quality-rubric.md` exists and has been applied manually
  (`docs/results.md`), but wiring scores into `metrics.json` itself is
  waiting on the automated scorer (`TODO.md` Phase 3) so the field shape
  is set once, not guessed at now and reshaped later.

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
