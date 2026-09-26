# docs/

Longer-form write-ups that don't belong in the top-level `README.md`:

- `app-knowledge/` — the "tester knowledge" primer fed to both
  conditions' prompts (app navigation, exact fields/selectors for the
  flow's screens, known app-level quirks — gathered by exploring the
  running app, not guessed). **Versioned** (`v1.md`, `v2.md`, `v3.md`;
  default v3, the realistic "tester's notes" baseline, `CLAUDE.md`
  decision 16): the primer is an explicit experimental variable, since
  v1 → v2 moved results more than anything else measured. Its
  `README.md` has the version table and the rules (never edit a published
  version). See `README.md` "How the comparison works" (app-knowledge primer) for why a
  primer exists at all.
- `verify-setup.md` — step-by-step manual check that the app + Playwright
  + Playwright MCP setup actually works, before building anything on top
  of it.
- `run-mcp-condition.md` / `run-codegen-condition.md` — the reproducible
  runbooks for each condition: every command plus the exact composed
  system/user prompts sent to Claude Code, so different people running
  them get comparable results. Must be resynced whenever
  `conditions/{mcp,codegen}/*.md`, `docs/app-knowledge/`, the flow spec,
  or (for the Codegen one) the codegen fixture change — see each file's
  own header.
- `run-repeats.md` — how to actually produce the 3-repeats-per-condition
  dataset `CLAUDE.md` decision 12 calls for, via `harness/run-repeats.sh`
  (also `npm run repeat:baseline` / `repeat:nudged`) - resets the app
  before *every* individual run, not just once per batch, and logs every
  `RUN_ID` produced. Neither single-run runbook above covers this by
  itself.
- `results.md` — **the headline results**: the create flow on the
  realistic primer v3 (cost, efficiency, failure causes, quality with
  measured flakiness).
- `test-bed-evolution.md` — development history: the N=1 pair and the
  two primer-v1/v2 batches, what each taught us (contamination, timeouts,
  toolset, the primer's weight), full analysis kept as it was. Lessons,
  not real-world measurements.
- `quality-rubric.md` — 7-criterion manual scoring rubric for a generated
  test file (5 from `CLAUDE.md` decision 2, plus 2 added and flagged after
  real scoring passes showed a need for them - task/spec compliance and
  config/data separation). Applied to every scored run so far (`docs/test-bed-evolution.md`).
  Automated/LLM-judge scoring is a later option, see `TODO.md` Phase 3.
- `testing-best-practices.md` — agent-facing primer mirroring the rubric
  above, one practice per criterion. Wired in (opt-in, symmetric) via
  `NUDGE_QUALITY=1` / the `*:nudged` npm scripts - it's the input half of
  the baseline-vs-nudged comparison (does explicit guidance change
  generated quality, and does it change the MCP/Codegen gap?). No nudged
  runs exist yet - see `TODO.md`.
