# Running a full repeat batch (both conditions, N=3)

`docs/run-mcp-condition.md` and `docs/run-codegen-condition.md` each
document a single run of one condition. Neither says how to actually
produce the **3-repeats-per-condition** dataset `docs/results.md` needs
to go from anecdote to comparison (`CLAUDE.md` decision 12) — that's what
this doc and `harness/run-repeats.sh` are for.

## Prerequisites

Same as both single-run docs: `claude` CLI installed and authenticated,
`.env` populated, and — critically — **run this from a plain terminal,
not from inside a Claude Code session** (see `harness/README.md`).

## Run it

```bash
harness/run-repeats.sh                                # both conditions, 3 repeats, baseline
harness/run-repeats.sh --condition mcp                 # MCP only
harness/run-repeats.sh --condition codegen --repeats 5  # Codegen only, 5 repeats
harness/run-repeats.sh --nudged                         # the nudged variant instead (docs/testing-best-practices.md)
```

For each repeat, for each requested condition, in order: reset the app
(`npm run cleanup:app && npm run setup:app`), then run that condition.
**Resets before every individual run, not once per repeat and not once
total** — this is deliberate, not excessive caution: the Codegen
condition's first-run flakiness bug
(`docs/results.md` "Quality" — an employee-autocomplete search that got
less selective as prior runs' employees accumulated in the database) was
directly caused by exactly the kind of state carryover a lighter reset
strategy would still permit. A full reset before every run is what
makes repeats independent, comparable measurements instead of a
slow-motion repeat of that same bug.

Each run's `RUN_ID` gets logged to `results/repeat-run-log-<timestamp>.txt`
as it completes, so you can find every run afterward without hunting
through terminal scrollback:

```
run_id repeat condition variant
mcp-2026-... 1 mcp baseline
codegen-2026-... 1 codegen baseline
mcp-2026-... 2 mcp baseline
...
```

A run that fails (network blip, an unlucky timeout) is logged as a
warning and skipped — the script keeps going with the remaining repeats
rather than aborting the whole batch. Check the terminal output for `!!`
lines if the final repeat count in the log looks short.

## After it finishes

Each run lands in `results/<run-id>/` (committed-eligible: test file +
`metrics.json`) and `results/raw/<run-id>/` (gitignored transcripts) same
as any single run — see `results/README.md`. Aggregating the N=3 (or N=5,
whatever you ran) set into an updated `docs/results.md` is still a manual
step for now; the log file above is what you'd script that aggregation
against if it becomes a recurring need (see `TODO.md` "Quality scorer" /
Phase 4 for related automation that hasn't been built yet either).

## Cost and time, roughly

It depends heavily on the app-knowledge primer (`docs/results.md` §A).
With the current primer (v2): MCP $0.78–$1.15 and 2.9–6.5 min per
repeat, Codegen $0.09–$0.20 and 1–3 min per repeat, plus ~80s of app
reset before each run — a full `--condition both --repeats 3` baseline
batch is roughly **~$3 and ~30 minutes of wall clock**. With primer v1,
Codegen was ~4x more expensive and 6.8–10+ min per repeat, and the batch
took ~45–55 minutes. Variance is large either way (MCP has had one
outlier run per batch) and is part of what's being measured, not a
bug.

Each `claude -p` phase is capped at **30 minutes** by default
(`CLAUDE_RUN_TIMEOUT_MS` to change it). The first batch ran with a
10-minute cap, which killed the slowest Codegen run mid-debugging, before
it had finished — keep the cap well above the slowest runs you expect, or you
silently lose exactly the right tail of the distribution. If a run is
killed anyway, the error names its session transcript; usage can be
recovered from it (see `TODO.md` Gotchas).
