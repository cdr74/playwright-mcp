# results/

Output of benchmark runs, split into what's kept and what isn't.

## `results/<run-id>/` — committed-eligible

The defined, lightweight set of facts we keep per run. Not implemented by
the harness yet (`TODO.md` Phase 3), but the shape is settled:

- `spec.ts` (or similar) — the actual generated/healed test file. This is
  the deliverable of the run, not exhaust.
- `metrics.json` — structured facts only:
  - `condition` (`mcp` | `cli`), `model`, `flow`, `runId`, `timestamp`
  - `tokens`: input/output token counts from the Anthropic API's `usage`
    field, broken down by phase where possible (e.g. exploration vs
    authoring for the MCP condition)
  - `efficiency`: tool-call/turn count, test-run iterations to green,
    wall-clock time
  - `quality`: rubric scores (once `docs/quality-rubric.md` and the scorer
    exist)

## `results/raw/` — gitignored, local only

Everything else a run produces: full agent transcripts (including raw MCP
accessibility-tree snapshots — these are exactly the bulk this project is
trying to measure, not something to duplicate into git), and any Playwright
run artifacts (screenshots, videos, trace files, HTML reports). Useful for
debugging a specific run locally. Never committed — see `.gitignore`.
