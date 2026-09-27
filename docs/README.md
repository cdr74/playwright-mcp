# docs/

Longer-form write-ups that don't belong in the top-level `README.md`:

- `testbed.md` — **the testbed in detail**: the app and flow, why the
  non-MCP generation condition is called Codegen, how a run is measured,
  setup, every run command, and what each file in the repo is for.
- `results.md` — **the headline results**: test generation on the
  realistic primer v3 (baseline and nudged batches: cost, efficiency,
  failure causes, quality with measured flakiness) and test healing (the
  survival check and the healing pilot, with integrity scores). Facts
  only so far; conclusions still to come.
- `app-knowledge/` — the "tester knowledge" primer fed to both
  conditions' prompts (where things are, known app-level quirks; the
  current v3 is short tester's notes, the older v1/v2 went down to
  fields and selectors — all gathered by exploring the running app). **Versioned** (`v1.md`, `v2.md`, `v3.md`;
  default v3, the realistic "tester's notes" baseline, `CLAUDE.md`
  decision 16): the primer is an explicit experimental variable, since
  v1 → v2 moved results more than anything else measured. Its
  `README.md` has the version table and the rules (never edit a published
  version). See `README.md` "How the testbed works" for why a
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
- `test-bed-evolution.md` — development history: the N=1 pair and the
  two primer-v1/v2 batches, what each taught us (contamination, timeouts,
  toolset, the primer's weight), full analysis kept as it was. Lessons,
  not real-world measurements.
- `run-heal.md` — runbook for the test-healing flow: the app updates
  ("breaks"), the zero-LLM survival check, and the two heal conditions
  with their exact tools and prompts.
- `heal-rubric.md` — integrity rubric for healed specs (is it still the
  same test?), scored from the heal diff.
- `quality-rubric.md` — 7-criterion manual scoring rubric for a generated
  test file (5 from `CLAUDE.md` decision 2, plus 2 added and flagged after
  real scoring passes showed a need for them - task/spec compliance and
  config/data separation). Applied to every scored run (`results.md`,
  and `test-bed-evolution.md` for the development batches).
  Automated/LLM-judge scoring is a later option, see `TODO.md` Phase 3.
- `testing-best-practices/` — agent-facing guidance for **nudged** runs,
  one practice per quality-rubric criterion. Versioned like the primer:
  `v1` (what the first nudged batch saw, including an intro describing
  the benchmark) and `v2` (the default: the practices only, no app
  knowledge). Its `README.md` has the wiring and the version table.
