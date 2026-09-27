# docs/testing-best-practices/

Practice-level guidance for **nudged** runs: what an agent gets told about
writing good Playwright tests, as opposed to `docs/quality-rubric.md`, which
is what it gets scored against afterward. The two are kept deliberately
close (each practice maps to one rubric criterion), so scoring never
penalizes an agent for something it was never told mattered.

This README is for humans; only the `v*.md` files are fed to agents,
verbatim, after a `## Testing best practices` heading.

## How it's wired

Opt-in and symmetric: `NUDGE_QUALITY=1` (or the `*:nudged` npm scripts,
or `run-repeats.sh --nudged`) appends the chosen version to the system
prompt of whichever phase writes Playwright code: `generate-mcp.ts` and
`run-codegen.ts`, not `explore-mcp.ts`, which only writes a prose test
plan. `explore-mcp.ts` still needs the flag, to mint an `mcp-nudged-`
`RUN_ID` and record the version; `generate-mcp.ts` warns if the two
phases disagree.

```bash
NUDGE=v1 npm run bench:codegen:nudged           # any nudged script; default is v2
harness/run-repeats.sh --nudged --nudge v1      # a whole batch
```

Every nudged run records `nudgeVersion` in `metrics.json`. Like the
app-knowledge primer, a published version is never edited; add a new
file and register it in `harness/src/lib/nudge.ts`.

## Versions

| Version | Default? | Content | Runs that used it |
|---|---|---|---|
| `v1.md` | | The seven practices, preceded by an intro describing the benchmark itself (the wiring, the baseline-vs-nudged comparison, and that the rubric is "what an agent gets scored against afterward"). Its relative-URL example uses this app's path shape, `page.goto('/web/index.php/...')`. | The first nudged batch (2026-09-26, `results/repeat-run-log-20260926T095822Z.txt`); verified from the transcripts. |
| `v2.md` | ✓ | v1's seven practices only, word for word, with the URL example made generic (`page.goto('/some/page')`). No benchmark intro, no app knowledge. | From 2026-09-27. |
