# First results (2026-09-25)

**Status: N=1 per condition.** This is a first read on real numbers, not a
statistically meaningful comparison yet — see "Caveats" below before
drawing conclusions from it. The repeat-run count needed for an actual
comparison is still an open decision in `TODO.md`.

Both runs used the confirmed v1 flow (`flows/01-add-employee-leave-request.md`,
"add employee → assign leave → verify") against a freshly reset,
identically seeded OrangeHRM instance, model `sonnet`, exactly as documented
in `docs/run-mcp-condition.md` / `docs/run-codegen-condition.md`. Both produced
a passing test on the first complete run of each condition.

## The runs

| | MCP (`mcp-2026-09-25T06-32-18-639Z`) | Codegen (`codegen-2026-09-25T08-46-56-590Z`) |
|---|---|---|
| Phases | explore + generate | generate only |
| Turns | 58 + 77 = **135** | **9** |
| `run_playwright_test` iterations to green | 8 | 4 |
| Wall clock | ~2.9 min + ~6.9 min = **~9.8 min** | **~4.1 min** |
| Permission denials | 0 | 0 |
| Result | passed, re-confirmed with a second run | passed |

Full detail in `results/mcp-2026-09-25T06-32-18-639Z/metrics.json` and
`results/codegen-2026-09-25T08-46-56-590Z/metrics.json`.

## Cost: two different pictures depending on what you measure

**Dollar cost** (Claude Code's own list-price-equivalent `total_cost_usd`,
which already applies standard prompt-cache discounting to repeated
context):

| | MCP | Codegen | Ratio |
|---|---|---|---|
| Cost | $0.80 (explore) + $1.20 (generate) = **$2.00** | **$0.28** | **~7.0x** |

**Raw token volume** (input + output + cache-write + cache-read tokens
summed — i.e. how much context actually got reprocessed each turn, before
cache-discount pricing is applied):

| | MCP | Codegen | Ratio |
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
  turn, where the Codegen condition mostly just writes/edits a file and reads
  back condensed test-run output.
  - MCP explore phase alone: 14 snapshots, 16 clicks, 10 type actions, 7
    key presses just to map out the flow before any code was written.
- **Iterations to green**: MCP needed 8 `run_playwright_test` calls, Codegen
  needed 4 — roughly 2x, smaller than the turn-count gap, suggesting the
  extra MCP turns are mostly exploration/browser-interaction overhead
  rather than extra debugging cycles once actual test-writing started.
- **Wall clock**: ~9.8 min vs ~4.1 min, **~2.4x** — smallest of the three
  ratios, because MCP's per-turn cost is dominated by very large
  (but cache-discounted, and thus not necessarily slow) context, not by
  proportionally more real work.

## Quality — scored against `docs/quality-rubric.md`

Each criterion is 0-4; criterion 3 (flakiness) is **measured**, not
estimated: both generated tests were actually re-run 5 times in a row
(`--repeat-each=5 --workers=1`) against a freshly re-seeded, live app.
Rescored below against the rubric's revised 7-criterion version (criterion
2 tightened to require fail-fast checkpoints *and* failure diagnostics,
not just correct end-state assertions; criterion 7, config/data
separation, added) — the totals below supersede the earlier /24 scoring,
and the changes cut in **both** directions, not just against Codegen:

| Criterion | MCP | Codegen |
|---|---|---|
| 1. Selector robustness | 4 | 4 |
| 2. Assertion meaningfulness | **3** | **4** |
| 3. Pass reliability (5 real repeat runs) | **4** (5/5 passed) | **2** (2/5 passed) |
| 4. Playwright best practices | 4 | 4 |
| 5. Line count / structure | 3 | 4 |
| 6. Task/spec compliance | 4 | 2 |
| 7. Config/data separation | **2** | **2** |
| **Total /28** | **24** | **22** |

Two things changed the picture from the original /24 pass, and both are
worth calling out rather than glossing over:

- **Criterion 2 flipped.** Codegen's test actually has *more* fail-fast
  checkpoints than MCP's (asserts the employee-details heading right after
  creation, asserts the Assign Leave URL right after navigating there) and
  it logs real diagnostic context when the Leave List check comes up empty
  (`console.log('Leave List did not show the new request (known app
  quirk)...')`). MCP's assertions are correctly placed too, but it has no
  diagnostic logging anywhere - a bare Playwright timeout trace is all a
  future maintainer gets. Under the tightened criterion, that's a real
  difference: Codegen 4, MCP 3.
- **Criterion 7 is new, and it dings MCP, not Codegen, on the "config" half.**
  MCP hardcodes the full absolute base URL in three separate `page.goto()`
  calls, duplicating what `playwright.config.ts`'s `baseURL` already
  provides - works today, breaks silently if that config value ever
  changes. Codegen navigates by clicking links / a relative path, so it never
  hits this. But Codegen still loses a point on the "data" half of the same
  criterion for the same hardcoded `firstName = 'Thomas'` already flagged
  under criterion 6 - both conditions land on **2/4** here, for two
  genuinely different reasons.

Both generated tests are structurally solid on inspection: role-based
locators throughout (no brittle CSS/XPath), no hard sleeps, correct
handling of the "insufficient leave balance" confirmation dialog and the
known Leave List search quirk (toast as primary success signal, list
search as best-effort only — both conditions were given this via
`docs/app-knowledge.md`). Both agents independently caught the same real
bug during iteration: `Locator.isVisible()` checks state once and doesn't
wait, so calling it right after triggering the confirmation dialog raced
its render and silently skipped the required "Ok" click. Both fixed it
the same way (`locator.waitFor({ state: 'visible' })`) despite neither
condition being told about this bug in advance — a mildly reassuring
signal that the flow spec and app-knowledge primer are fair to both
conditions. The Codegen condition's agent also caught a bug the MCP agent
never had to: blindly picking the Leave Type listbox's "first option"
could select the re-rendered `-- Select --` placeholder rather than a
real leave type — an artifact specific to working from an imperfect
recording instead of live-observing the dropdown.

**Where the score actually diverges, and why — this is the interesting
part.** The Codegen test failed 3 of 5 repeat runs, always at the same line:
timing out waiting for the employee autocomplete option to appear. Root
cause, confirmed against the database rather than guessed: the Codegen test
hardcodes `firstName = 'Thomas'` (inherited literally from the codegen
fixture — see `fixtures/README.md`) and only generates a unique *last*
name, then searches the autocomplete by typing just `firstName`. The flow
spec explicitly asks for "a unique, generated first *and* last name."
Every run (this scoring pass included) leaves another `Thomas Mueller*`
row in the database — after the fixture recording, the first Codegen run, and
this 5x scoring pass, there were **8** employees named "Thomas" — so
searching by "Thomas" alone got steadily less selective, and the
autocomplete increasingly failed to surface the *new* one inside the
test's timeout. The MCP test generates both names
(`TestFN<timestamp>`/`TestLN<timestamp>`), so its search term stays
unique no matter how many prior runs exist, and it passed 5/5. **A
literal one-field spec-compliance gap (criterion 6) directly and
measurably caused the flakiness (criterion 3)** — not a coincidence, not
two independent weaknesses, the same root cause showing up on two
criteria. This is exactly the kind of finding a single-pass read
(without actually re-running the tests) would have missed entirely: both
files looked equally solid on inspection alone.

One asymmetry worth flagging as a possible confound, not a finding: the
MCP condition's agent chose to run the test **twice** after first going
green (to confirm stability) before stopping; the Codegen condition's agent
stopped after the first pass. That's a difference in agent judgment, not
something either prompt requested — worth watching across more runs before
reading anything into it. Notably, the Codegen agent's choice to stop after
one pass meant it never had the chance to catch its own flakiness bug the
way the MCP agent's extra confirmation run might have surfaced an
equivalent issue, had one existed.

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
  typical or an outlier. Do not cite the ratios above as "the" MCP/Codegen gap.
- **Both runs below are affected by a since-fixed contamination bug**:
  Claude Code was auto-attaching this repo's own `CLAUDE.md` (15.9K chars)
  and auto-memory files to every session regardless of `--system-prompt` -
  confirmed by inspecting the real transcripts, not assumed. See `TODO.md`
  Gotchas for the full investigation and the fix
  (`harness/src/lib/isolated-session.ts`). The token/cost numbers below
  are real (that's genuinely what got billed) but measure something
  slightly larger than what `docs/run-mcp-condition.md` /
  `docs/run-codegen-condition.md` document as the system prompt. Don't
  reuse these two runs as 1-of-3 when the N=3 baseline set gets built -
  redo all 3 on the fixed harness so the set is homogeneous.
- **Not a blind/controlled trial** in the stricter sense — both runs used
  the same model, flow, and app-knowledge primer (that symmetry is
  deliberate, see `README.md`), but only one seed/attempt each.
- **The flakiness measurement (criterion 3) was run against accumulated,
  not freshly reset, app state** — by design this time (it's exactly what
  exposed the Codegen test's bug), but it means the 5/5 vs 2/5 pass counts
  aren't from identical starting conditions each run. A cleaner
  methodology for future scoring passes would run each repeat against a
  full app reset, though that would have hidden this specific finding -
  worth deciding deliberately, not by default, once this becomes a
  repeated/automated step.
- **The quality rubric itself is new** (`docs/quality-rubric.md`) and its
  6th criterion (task/spec compliance) isn't part of the original
  `CLAUDE.md` decision 2 axis list — added because the first scoring pass
  showed a direct need for it, flagged explicitly in that doc's own
  header rather than silently folded in.
- **App state wasn't pristine for the Codegen run** in one sense worth noting:
  the codegen fixture itself (`fixtures/01-add-employee-leave-request.codegen.ts`)
  has two documented deviations from the flow spec (a two-day date range,
  and extra login-detail setup) — see `fixtures/README.md`. The Codegen
  condition's agent had to clean these up as part of its job, which is
  in-scope by design, not a run defect, but means the Codegen condition's task
  is arguably slightly harder than "just clean up a recording" in a way
  the MCP condition doesn't have an equivalent for.

## Reproducing these runs

See `docs/run-mcp-condition.md` and `docs/run-codegen-condition.md` for the
exact commands and prompts. Short version, from a plain terminal (not from
inside a Claude Code session — see those docs for why):

```bash
npm run cleanup:app && npm run setup:app
npm run explore:mcp && RUN_ID=<id> npm run generate:mcp   # MCP condition (re-seeds itself)
npm run bench:codegen                                          # Codegen condition (re-seeds itself)
```
