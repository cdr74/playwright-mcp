# First results (2026-09-25)

**Status: N=1 per condition.** This is a first read on real numbers, not a
statistically meaningful comparison yet — see "Caveats" below before
drawing conclusions from it. The repeat-run count needed for an actual
comparison is still an open decision in `TODO.md`.

Both runs used the confirmed v1 flow (`flows/01-add-employee-leave-request.md`,
"add employee → assign leave → verify") against a freshly reset,
identically seeded OrangeHRM instance, model `sonnet`, exactly as documented
in `docs/run-mcp-condition.md` / `docs/run-cli-condition.md`. Both produced
a passing test on the first complete run of each condition.

## The runs

| | MCP (`mcp-2026-09-25T06-32-18-639Z`) | CLI (`cli-2026-09-25T08-46-56-590Z`) |
|---|---|---|
| Phases | explore + generate | generate only |
| Turns | 58 + 77 = **135** | **9** |
| `run_playwright_test` iterations to green | 8 | 4 |
| Wall clock | ~2.9 min + ~6.9 min = **~9.8 min** | **~4.1 min** |
| Permission denials | 0 | 0 |
| Result | passed, re-confirmed with a second run | passed |

Full detail in `results/mcp-2026-09-25T06-32-18-639Z/metrics.json` and
`results/cli-2026-09-25T08-46-56-590Z/metrics.json`.

## Cost: two different pictures depending on what you measure

**Dollar cost** (Claude Code's own list-price-equivalent `total_cost_usd`,
which already applies standard prompt-cache discounting to repeated
context):

| | MCP | CLI | Ratio |
|---|---|---|---|
| Cost | $0.80 (explore) + $1.20 (generate) = **$2.00** | **$0.28** | **~7.0x** |

**Raw token volume** (input + output + cache-write + cache-read tokens
summed — i.e. how much context actually got reprocessed each turn, before
cache-discount pricing is applied):

| | MCP | CLI | Ratio |
|---|---|---|---|
| Total tokens | **5,632,672** | **196,000** | **~28.7x** |

These tell different stories on purpose. The **~29x raw-token-volume gap**
is the closer analog to what the
[inspiring post](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html)
originally measured (~114K vs ~27K tokens, ~4.2x, on a simpler ~10-step
task with no disclosed caching behavior) — MCP's live accessibility-tree
snapshots get re-sent in full on every turn, and this run had 58+77 = 135
turns to accumulate that cost across. The **~7x dollar-cost gap** is
smaller only because Claude Code's prompt caching heavily discounts
repeated context server-side — cache reads are billed far below fresh
input tokens. Put plainly: **prompt caching hides most, but not all, of
MCP's raw context-bloat problem from your bill, but the underlying
inefficiency (context reprocessed per turn) is still there and roughly 4x
worse than what caching's dollar figure alone suggests.**

## Efficiency

- **Turns**: MCP took **15x** as many turns (135 vs 9) — expected, since
  each MCP browser action (navigate, snapshot, click, type...) is its own
  turn, where the CLI condition mostly just writes/edits a file and reads
  back condensed test-run output.
  - MCP explore phase alone: 14 snapshots, 16 clicks, 10 type actions, 7
    key presses just to map out the flow before any code was written.
- **Iterations to green**: MCP needed 8 `run_playwright_test` calls, CLI
  needed 4 — roughly 2x, smaller than the turn-count gap, suggesting the
  extra MCP turns are mostly exploration/browser-interaction overhead
  rather than extra debugging cycles once actual test-writing started.
- **Wall clock**: ~9.8 min vs ~4.1 min, **~2.4x** — smallest of the three
  ratios, because MCP's per-turn cost is dominated by very large
  (but cache-discounted, and thus not necessarily slow) context, not by
  proportionally more real work.

## Quality (qualitative, N=1 — not scored against `docs/quality-rubric.md`,
which doesn't exist yet)

Both generated tests are structurally solid: role-based locators
throughout (no brittle CSS/XPath), no hard sleeps, correct handling of the
"insufficient leave balance" confirmation dialog and the known Leave List
search quirk (toast as primary success signal, list search as best-effort
only — both conditions were given this via `docs/app-knowledge.md`).

Both agents independently caught the same real bug during iteration:
`Locator.isVisible()` checks state once and doesn't wait, so calling it
right after triggering the confirmation dialog raced its render and
silently skipped the required "Ok" click. Both fixed it the same way
(`locator.waitFor({ state: 'visible' })`). Neither condition was told about
this bug in advance — it's a genuine, independently-discovered fix on both
sides, which is a mildly reassuring signal about the flow spec and
app-knowledge primer being fair to both conditions.

The CLI condition's agent caught one bug the MCP condition's agent never
had to: working from the raw codegen recording, blindly picking the Leave
Type listbox's "first option" could select the re-rendered `-- Select --`
placeholder instead of a real leave type — an artifact specific to
starting from an imperfect recording rather than live-observing the
dropdown, which is exactly the kind of condition-specific failure mode
this project is trying to surface.

One asymmetry worth flagging as a possible confound, not a finding: the
MCP condition's agent chose to run the test **twice** after first going
green (to confirm stability) before stopping; the CLI condition's agent
stopped after the first pass. That's a difference in agent judgment, not
something either prompt requested — worth watching across more runs before
reading anything into it.

## How this compares to the inspiring post

The post claims ~114K vs ~27K tokens (~4.2x, up to "10x" in the more
extreme framing) for a simpler ~10-step task, with no disclosed
methodology. This run's flow is more involved (add employee → assign leave
→ verify, ~20+ real interactions, split across two MCP phases) and shows a
**larger** gap by raw token volume (~29x) but a **smaller** one by dollar
cost (~7x) once prompt caching is accounted for — which the original post
doesn't appear to control for or disclose either way. Neither number
straightforwardly confirms or refutes the post's claim; they're not
measuring quite the same thing, which is itself the main point of building
this harness instead of trusting either figure blind.

## Caveats — what this is not yet

- **N=1 per condition.** No error bars, no idea yet whether either run was
  typical or an outlier. Do not cite the ratios above as "the" MCP/CLI gap.
- **Not a blind/controlled trial** in the stricter sense — both runs used
  the same model, flow, and app-knowledge primer (that symmetry is
  deliberate, see `README.md`), but only one seed/attempt each.
- **No quality rubric yet** (`docs/quality-rubric.md`, `TODO.md` Phase 3) —
  the quality comparison above is a manual read, not a scored one.
- **App state wasn't pristine for the CLI run** in one sense worth noting:
  the codegen fixture itself (`fixtures/01-add-employee-leave-request.codegen.ts`)
  has two documented deviations from the flow spec (a two-day date range,
  and extra login-detail setup) — see `fixtures/README.md`. The CLI
  condition's agent had to clean these up as part of its job, which is
  in-scope by design, not a run defect, but means the CLI condition's task
  is arguably slightly harder than "just clean up a recording" in a way
  the MCP condition doesn't have an equivalent for.

## Reproducing these runs

See `docs/run-mcp-condition.md` and `docs/run-cli-condition.md` for the
exact commands and prompts. Short version, from a plain terminal (not from
inside a Claude Code session — see those docs for why):

```bash
npm run cleanup:app && npm run setup:app && npm run seed
npm run explore:mcp && RUN_ID=<id> npm run generate:mcp   # MCP condition
npm run bench:cli                                          # CLI condition
```
