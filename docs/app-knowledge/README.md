# docs/app-knowledge/

The "tester knowledge" primer both conditions get in their system prompt
(`CLAUDE.md` decision 10). It is an **explicit experimental variable**
(`CLAUDE.md` decision 14): going from v1 to v2 moved the MCP:Codegen cost
ratio from ~1.2x to ~6.3x (`docs/test-bed-evolution.md` §A) — more than
anything else measured so far — so results are only comparable within a
primer version.

**v3 is the baseline** (`CLAUDE.md` decision 16): only what a real tester
would write down, in a tester's words. v1 and v2 were built while
developing the harness; they mix in locator-level advice (real teams keep
that in code), traps added after watching agents fail on this exact
screen, and our own evidence trail. Their results are development
history, not headline results.

This README is for humans; only the `v*.md` files are fed to agents,
verbatim, after a `## App knowledge` heading.

## Using a version

```bash
PRIMER=v2 npm run bench:codegen                 # any run script; default is v3
harness/run-repeats.sh --primer v2              # a whole batch
```

Every run records its version as `primerVersion` in `metrics.json`, and
`run-repeats.sh` logs it next to each `RUN_ID`. `generate-mcp.ts` warns
if it's run with a different `PRIMER` than the `explore-mcp.ts` phase
that minted the `RUN_ID`.

## Rules

- **Never edit a published version.** Add a new file instead, and add a
  `PRIMER_VERSIONS` entry in `harness/src/lib/primer.ts`. The whole point
  is that `v1` means the same bytes forever.
- **No benchmark meta-commentary** in new versions — agents read these
  verbatim. (v1 and v2 open with a paragraph about the benchmark itself;
  left as-is since they're frozen. v3 has none.)
- **Would a tester actually write this?** New versions keep to notes a
  real tester would keep. Locator recipes belong in test code, not here.
- **Evidence only.** Everything in a version should be something observed
  in the running app, not guessed.

## Versions

| Version | Default? | Content | Runs that used it |
|---|---|---|---|
| `v1.md` | | Navigation, the Add Employee and Assign Leave forms, the date-picker `.fill()` quirk, the zero-balance confirmation dialog, the Leave List search quirk, environment prerequisites. | The original N=1 pair and batch 1. (The N=1 pair saw it with one path in the intro reading `conditions/cli/` instead of `conditions/codegen/` — it predates that rename; otherwise identical.) |
| `v2.md` | | v1 plus three traps every batch-1 run of both conditions hit: the `-- Select --` placeholder is itself a `role="option"`; a selected employee renders as `"First  Last"` (double space); weekend dates are rejected server-side (`400 "No Working Days Selected"`). | Batch 2 (development history). |
| `v3.md` | ✓ | Short tester's notes (~270 words vs ~940): setup already done, where things are, custom dropdowns/autocompletes, and five things that trip people up (Assign vs Apply, weekends, zero-balance dialog, fiddly date fields, unreliable Leave List). No locator recipes, no `-- Select --` / double-space traps, no evidence trail. | The headline baseline (`docs/results.md`), from 2026-09-26. |

Which version a run saw was verified against the session transcripts
(they record the full system prompt), not assumed from timestamps.
