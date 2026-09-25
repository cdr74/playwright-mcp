# Results

Last updated after the **first repeat batch** (2026-09-25,
`results/repeat-run-log-20260925T132116Z.txt`): 3 MCP runs and 3 Codegen
runs, baseline prompts, model `sonnet`, all on the harness *after* the
CLAUDE.md-contamination fix (see `TODO.md` Gotchas). One Codegen run was
killed by a (since-fixed) 10-minute harness timeout **before it had
finished** — its final spec doesn't pass; its usage was recovered from its
transcript and it's reported below as a **censored** data point (marked
`*`), not dropped.

The original single-run pair from earlier the same day is kept in the
appendix. **Most of what it suggested did not survive repetition** - that
reversal is itself one of the main findings.

## TL;DR

1. **On cost, the two conditions are roughly even in this flow.** Mean
   $0.71 (MCP) vs ≥$0.62 (Codegen); median $0.47 vs ≥$0.58 — the *typical*
   MCP run was cheaper, and one expensive MCP run pulls its mean up. Not
   the 4x–10x gap the inspiring post claims, and not the 7x our own N=1
   pair showed.
2. **They spend money in opposite ways.** MCP is *many cheap turns*: ~80%
   of its cost is context (cache writes/reads), ~220 output tokens per
   turn. Codegen is *few expensive turns*: ~53% of its cost is output,
   ~1,400 output tokens per turn, because every iteration rewrites the
   whole spec file.
3. **MCP front-loads, Codegen iterates blind.** MCP's explore phase is
   63–82% of its cost, and in 2 of 3 runs the generate phase then passed
   on its **second** test run (`FP`). Codegen needed **9 and 13** test
   runs to reach green, and its third run hadn't got there after 11 when
   it was cut off: it can only see terse test output, and its
   dominant failure — "Successfully Saved toast not found" — is where
   several *different* upstream bugs all surface looking identical.
4. **MCP was faster, not slower.** 4.1 min mean (2.3–7.3) vs ≥8.8 min for
   Codegen (6.8–≥10.0). The N=1 pair said the opposite.
5. **Variance is large, and N=1 was misleading.** MCP's most expensive
   run cost 2.6x its cheapest out of just three. Cost ratio, iteration
   ratio, wall-clock ratio, and two of the N=1 "quality" conclusions all
   **reversed** once repeats existed.
6. **Quality converges; neither condition "wins" it.** Every run that
   finished produced a test that passes **5/5** from a clean reset (3 MCP,
   2 Codegen); both fall into the same traps (hardcoded base URL 6/6, CSS
   locators for OrangeHRM's custom dropdown 5/6). Rubric means are 21.7
   (MCP) vs 24.0 (Codegen, finished runs) out of 28 — within the spread
   between runs of the *same* condition. The "hardcoded first name"
   defect the N=1 pair pinned on Codegen showed up in **2 of 3 MCP**
   specs and **0 of 3 Codegen** specs this time.
7. **Two harness findings change how to read the data** (§7): the
   curated MCP tool allow-list was **never enforced** (every MCP run had
   playwright-mcp's full toolset, 3 of 4 used "excluded" tools) — since
   decided to *be* the MCP condition — and a 10-minute timeout was
   silently censoring the slowest runs (fixed).
8. **The app-knowledge primer has since been extended** with the three
   traps behind most of Codegen's failures (§9). Everything above used the
   old primer; the next batch doubles as a before/after comparison.

## 1. Cost & efficiency

Prices that reproduce every recorded `costUsd` exactly: **$2 / $10 / $4 /
$0.20 per million** input / output / cache-write / cache-read tokens
(list-price equivalent; runs are billed against a Claude Code
subscription, see `CLAUDE.md` decision 3).

| Run | Cost | Turns | Test runs (F=fail, P=pass) | Wall clock | Total tokens |
|---|---|---|---|---|---|
| MCP r1 `mcp-…13-22-39-956Z` | $0.46 (explore $0.36 + gen $0.10) | 39 (34+5) | `FP` | 2.9 min | 0.86M |
| MCP r2 `mcp-…13-35-26-429Z` | $0.47 ($0.39 + $0.08) | 41 (36+5) | `FP` | 2.3 min | 1.03M |
| MCP r3 `mcp-…13-50-16-805Z` | $1.21 ($0.76 + $0.44) | 100 (63+37) | `FFFPP` | 7.3 min | 3.29M |
| Codegen r1 `codegen-…13-27-12-487Z` | $0.56 | 19 | `FFFFFFFFP` | 6.8 min | 0.53M |
| Codegen r2 `codegen-…13-39-19-429Z` | $0.71 | 26 | `FFFFFFFFFFFPP` | 9.5 min | 0.80M |
| Codegen r3* `codegen-…14-00-05-130Z` | ≥$0.58* | ≥24* | `FFFFFFFFFF` `p` + killed — not finished | ≥10.0 min* | ≥0.61M* |

| Summary | MCP (n=3) | Codegen (n=3, 1 censored) | MCP : Codegen |
|---|---|---|---|
| Cost, mean (median) | $0.71 ($0.47) | ≥$0.62 (≥$0.58) | ≤1.15x (≤0.81x) |
| Turns, mean | 60 | ≥23 | ≤2.6x |
| Test runs to green, mean | 3 | 11 (n=2; r3 not green after 11) | ~0.27x |
| Wall clock, mean | 4.1 min | ≥8.8 min | ≤0.47x |
| Total tokens processed, mean | 1.73M | ≥0.65M | ≤2.7x |

`*` Codegen r3 was killed by the old 10-minute `claude -p` timeout while
it was still debugging. Its one pass (lowercase `p`) was a stripped-down
`'debug autocomplete'` probe test it wrote to investigate, not the real
flow; it was running the real test again when it was killed, and that
final spec fails 5/5 when re-run (§5). Turns and tokens are reconstructed
from its session transcript (deduplicated by API message id — a method
validated to reproduce two other runs' `metrics.json` exactly), so its
cost, turns and duration are **lower bounds**, and whether it would have
finished is unknown.

## 2. Why: cost anatomy

| Run | Output share of cost | Cache-write share | Cache-read share | Cache-read tokens / turn | Output tokens / turn |
|---|---|---|---|---|---|
| MCP r1 | 21% | 44% | 35% | 20.5K | 243 |
| MCP r2 | 20% | 38% | 41% | 23.7K | 234 |
| MCP r3 | 17% | 30% | 53% | 31.8K | 209 |
| Codegen r1 | 53% | 30% | 17% | 24.2K | 1,560 |
| Codegen r2 | 53% | 27% | 20% | 27.5K | 1,466 |
| Codegen r3* | 53% | 28% | 19% | 22.5K | 1,281 |

- **Per-turn context is about the same size in both conditions**
  (20–32K cache-read tokens per turn). MCP's accessibility-tree snapshots
  do make its context grow over a long run (r3: 31.8K/turn at 100 turns vs
  r1: 20.5K/turn at 39), which is the mechanism the inspiring post
  describes — but prompt caching makes re-reading it cheap ($0.20/M).
- **What differs is how many turns, and how much each turn writes.** MCP
  takes many small steps (navigate, snapshot, click, type...), each
  emitting a couple hundred tokens. Codegen takes fewer, heavier steps:
  `write_file` takes the *entire* spec as its argument, so every fix
  re-emits ~100–160 lines of code as output tokens — the most expensive
  token class.
- **Implication:** Codegen's cost is dominated by *how many times it has
  to rewrite the file*. An edit/patch-style tool instead of whole-file
  `write_file` would likely cut its cost substantially — but that changes
  the condition's tool surface, so it's a design question, not a tweak
  (see §9).

## 3. Where each condition spends its effort

### MCP: pay up front, then mostly just write it down

The explore phase is **63–82% of MCP's cost** (r1 79%, r2 82%, r3 63%).
It interacts with the real form: it discovers that the Leave Type
dropdown's `-- Select --` placeholder is itself rendered as an option,
that the confirmation dialog appears for a zero-balance employee, and how
the date picker behaves — and writes all of it into `test-plan.md`. In r1
and r2, generate then wrote the test, saw one failure, fixed it, and
passed: **5 turns, ~$0.09, no browser use at all.**

r3 is the exception that sets the mean: its test failed three times on
the "Successfully Saved" toast, and generate went back to the live
browser (27 browser tool calls, including `browser_run_code_unsafe` —
see §7) to debug, costing 37 turns and $0.44 in generate alone.

MCP r1 is worth noting for a different reason: it dropped the toast (the
success signal `docs/app-knowledge.md` recommends) and asserted on the
actual `POST .../leave-requests` API response instead — arguably a
stronger, less timing-sensitive signal, found through live exploration.

### Codegen: write plausible code, then debug blind

Codegen never sees the page. Its only feedback is `run_playwright_test`'s
condensed output. Across its three runs, the failure log reads:

| Symptom seen by the agent | Occurrences | What was actually wrong upstream |
|---|---|---|
| "Successfully Saved" / `.oxd-toast` not found | 13 of 29 failures | The Assign never saved — the error itself doesn't say why |
| Autocomplete option never appeared / wrong value | 6 | Search term vs OrangeHRM's rendering (e.g. `"First  Last"` with a double space for an empty middle name) |
| 30s timeouts (click / page closed) | 4 | Selectors carried over from the raw recording that don't match |
| `-- Select --` still selected / "Required" | 3 | Picked the placeholder as if it were a real leave type |
| Other (post-save heading not found, dialog/feedback race x2) | 3 | — |

The key point: the toast assertion is the *first check after clicking
Assign*, so it's where **several different upstream bugs all surface
looking identical** — placeholder leave type, a weekend date the app
silently rejects, an unconfirmed dialog. The agent sees "toast not
found" and has to guess which. Codegen r2 only broke out of this loop
after instrumenting the test to dump the form state right before submit
(`Field state right before submit: {..."leaveType":"-- Select --"...}`) —
i.e. by building itself the visibility MCP gets for free. This is the
fail-fast / diagnostics criterion (`docs/quality-rubric.md` #2) paying
off inside the run, not just for a future maintainer.

Same traps, different price: both conditions hit the placeholder option,
the date picker and the dialog. MCP hits them *while exploring*, where
each costs one cheap turn; Codegen hits them *as test failures*, where
each costs a full-file rewrite plus a ~10–30s test run.

## 4. Variance

- **MCP:** cost $0.46–$1.21 (2.6x), turns 39–100 (2.6x), wall clock
  2.3–7.3 min (3.2x). Two runs were near-identical; the third went back
  to the browser during generate and roughly tripled everything.
- **Codegen:** cost $0.56–$0.71 (1.3x), turns 19–26, test runs 9–13 —
  tighter in relative terms, but *every* run needed many iterations.
- **Shape:** MCP looks bimodal (clean `FP` vs. a debug detour), Codegen
  looks consistently slow. With n=3 that's a hypothesis, not a finding.
- **N=3 was enough to overturn N=1, not enough to estimate a
  distribution.** Everything in the ratio column of §1 should be read as
  "direction, roughly" — a single additional expensive run on either side
  could move the means noticeably.

## 5. Quality

Scored against `docs/quality-rubric.md` (7 criteria, 0–4 each, /28).
Criterion 3 is **measured**: each spec re-run 5x serially
(`--repeat-each=5 --workers=1`) after a full app reset + seed, so every
spec starts from the same state and accumulates only its own data.

| Criterion | MCP r1 | MCP r2 | MCP r3 | CG r1 | CG r2 | CG r3* |
|---|---|---|---|---|---|---|
| 1. Selector robustness | 3 | 3 | 2 | 4 | 2 | 3 |
| 2. Assertions (fail-fast + diagnostics) | 4 | 3 | 3 | 3 | 4 | 3 |
| 3. Pass reliability, 5 measured runs | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) | **0** (0/5) |
| 4. Playwright best practices | 3 | 4 | 4 | 4 | 4 | 2 |
| 5. Line count / structure | 3 | 3 | 4 | 4 | 3 | 3 |
| 6. Task/spec compliance | 4 | 2 | 2 | 4 | 4 | 4 |
| 7. Config/data separation | 2 | 2 | 2 | 2 | 2 | 2 |
| **Total /28** | **23** | **21** | **21** | **25** | **23** | **17** |

**Measured reliability: every finished run's test passes 5/5** — all
three MCP specs and both finished Codegen specs. No measured flakiness in
either condition this time. The censored Codegen r3 spec fails 5/5, the
same way it was failing when the run was cut off (the "Success" toast
never appears — the Assign still isn't saving), which is consistent with
it simply not being finished rather than being flaky.

Means: **MCP 21.7 / 28**, **Codegen 24.0 / 28** (the two finished runs;
21.7 if the unfinished one is included). The gap between conditions is
smaller than the spread *within* each condition (MCP 21–23, Codegen
23–25 finished), so quality does not separate the two conditions in this
batch.

MCP r2's first-name-only autocomplete search (`'Testeragent'`, hardcoded)
did **not** cause flakiness from a clean reset: 5 runs leave 5
`Testeragent Autoqa<ts>` employees and the test still picked the right
one. The N=1 pair's 3/5 failure for the same kind of defect was measured
against *accumulated* state with several pre-existing "Thomas" employees.
So that defect is a latent risk that bites as same-named data
accumulates, not an immediate failure — criterion 6 still flags it, and
the rubric now fixes the measurement convention (reset before each spec)
so these numbers stay comparable (`docs/quality-rubric.md` criterion 3).

What the scores rest on (objective signals pulled from each spec):

| Signal | MCP r1 | MCP r2 | MCP r3 | CG r1 | CG r2 | CG r3 |
|---|---|---|---|---|---|---|
| Lines | 110 | 101 | 71 | 113 | 164 | 156 |
| CSS class locators | 2 | 1 | 3 | 0 | 6 | 2 |
| `waitForTimeout` | 1 | 0 | 0 | 0 | 0 | 2 |
| Absolute URL in `goto()` | 3 (via a `BASE_URL` constant) | 2 | 2 | 3 | 1 | 1 |
| First name generated? | yes | **no** (`'Testeragent'`) | **no** (`'Test'`) | yes | yes | yes |
| Autocomplete search term | full name | **first name only** | full name | first name (unique) | first name (unique) | full name |
| `expect()` calls | 6 | 11 | 5 | 4 | 11 | 3 |
| Diagnostics (logs / descriptive errors) | 3 logs | — | — | 2 logs | 2 throws + 2 messages | 1 throw |
| Success signal | API response | toast | toast | toast | toast | toast |

Observations:

- **Criterion 7 doesn't discriminate here: 6 of 6 specs hardcode the
  absolute base URL** despite `playwright.config.ts` providing `baseURL`.
  In the N=1 pair it looked like a Codegen strength; it was noise.
- **Criterion 1: both conditions reach for CSS** (`.oxd-select-*`) on
  OrangeHRM's custom dropdown — 5 of 6 specs. The app doesn't expose a
  clean accessible role for the closed control, so this is a property of
  the app as much as of either condition.
- **Criterion 6: the partial-uniqueness defect moved sides.** In the N=1
  pair only Codegen hardcoded a first name (inherited from the codegen
  recording's "Thomas"), and that caused its measured flakiness. This
  batch: MCP r2 and r3 hardcode it, all three Codegen runs generate both
  names (two keep the recording's "Thomas"/"Mueller" *as a prefix* and add
  a unique suffix — i.e. they generalized it correctly). So it's a
  general agent tendency, not a Codegen-specific artifact.
- **Criterion 5 is the least objective** of the seven; treat its 3-vs-4
  distinctions as low-confidence.

## 6. What the N=1 pair got right and wrong

| N=1 conclusion (appendix) | After the repeat batch |
|---|---|
| MCP costs ~7x more | **Reversed**: ≤1.15x by mean, MCP cheaper by median |
| MCP needs more test iterations (8 vs 4) | **Reversed**: 3 vs 11 (+ one Codegen run not green after 11) |
| MCP is ~2.4x slower | **Reversed**: MCP ~2x faster |
| MCP uses far more turns (15x) | **Held, much smaller**: 2.6x |
| ~29x raw token-volume gap | **Much smaller**: ~2.7x |
| Hardcoded first name is a Codegen artifact | **Reversed**: 2/3 MCP, 0/3 Codegen |
| Codegen respects `baseURL`, MCP doesn't | **Dissolved**: 6/6 hardcode it |
| Both agents independently rediscover the same app traps (dialog timing, `-- Select --` placeholder, weekend dates) | **Held** |
| MCP is context-heavy, Codegen generation-heavy | **Held, now quantified** (§2) |

How much of the N=1 gap was the CLAUDE.md contamination? It added an
estimated ~4K tokens per session: roughly **7–8% of those runs' cost**
(~$0.14 of MCP's $2.00, ~$0.02 of Codegen's $0.28). That's small — the
N=1 vs batch differences are overwhelmingly run-to-run variance. Whether
seeing the benchmark's own description changed agent *behavior* can't be
quantified from this data.

## 7. Harness findings from this batch

1. **The MCP tool allow-list was never enforced.** `claude -p --tools`
   only restricts Claude Code's *built-in* tools. The curated 13-tool list
   in `harness/src/lib/mcp-tool-names.ts` (since removed) was passed but ignored for
   MCP-server tools, so every MCP run had playwright-mcp's full toolset.
   3 of 4 MCP runs so far called tools the design deliberately excluded
   (`browser_run_code_unsafe` x3 — arbitrary JS — `browser_evaluate`,
   `browser_network_requests` x3, `browser_network_request`,
   `browser_console_messages`). Consequences: (a) the MCP condition was
   *more capable* than designed, most visibly in r3's generate-phase
   debugging; (b) its context carried all ~25 tool definitions every
   turn, not 13, so MCP cost figures include that overhead. The Codegen
   condition is unaffected (its only MCP server is ours, and `Bash` is a
   built-in, so that exclusion does hold). **Decided** (`CLAUDE.md`
   decision 13): the full toolset *is* the MCP condition from now on —
   which also means every MCP number in this doc stays valid as-is, now
   measuring the intended thing rather than an accident.
2. **A 10-minute timeout censored the slowest run.** `claude-runner.ts`
   killed Codegen r3 at exactly 10:00, mid-debugging and before it had a
   passing real test (its one PASS was a debug probe). Fixed: default
   30 min, `CLAUDE_RUN_TIMEOUT_MS` to override, and the error now names
   the transcript path. Any cap near real run times biases results toward
   the fast runs.
3. **Contamination fix confirmed working.** None of the six batch
   transcripts carries a `CLAUDE.md`/auto-memory attachment.

## 8. Compared to the inspiring post

The [post](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html)
claims ~114K vs ~27K tokens (~4.2x, "up to 10x") for MCP vs CLI on a
~10-step task, attributed to MCP re-injecting page state every step.

- **Token volume:** this batch shows **~2.7x** — the same direction and
  order of magnitude as the post, far from our own N=1 pair's 29x.
- **Dollar cost:** **~1.15x** (mean), MCP cheaper at the median. Prompt
  caching turns most of MCP's extra context into cheap cache reads; the
  post doesn't say whether it accounts for caching.
- **Mechanism:** partially supported — MCP context does grow with run
  length (§2) — but in this flow the bigger cost driver on the *other*
  side is Codegen rewriting whole files blind, which a token-count-only
  comparison doesn't surface.
- Caveat: our "Codegen" condition isn't what the post calls CLI — the
  agent never gets a shell (see `README.md` "How the comparison works").

## 9. Recommendations and open questions

Decided after this analysis:

- **MCP toolset** (§7.1): the full playwright-mcp toolset is the MCP
  condition (`CLAUDE.md` decision 13).
- **The three recurring traps are now in `docs/app-knowledge.md`**
  ("primer v2", `CLAUDE.md` decision 10): the `-- Select --` placeholder
  rendered as an option, the selected employee shown as `"First  Last"`
  (double space), and weekend dates rejected server-side. **Every run in
  this doc used primer v1**, so the next batch is also a before/after
  comparison. Prediction to check it against: Codegen should gain the
  most — most of its 29 failures (§3) trace back to these traps — which
  would narrow or flip the iterations-to-green and wall-clock gaps.

Still open (each touches the experiment's design, so proposals only):

- **An edit-style tool for Codegen** would test whether its cost is
  mostly an artifact of whole-file `write_file`. Changes the tool surface
  of a condition — design decision.
- **Run the nudged variant** (`npm run repeat:nudged`) — the wiring is
  done; no data yet.
- **Get to a real n** before drawing quantitative conclusions — at least
  for the MCP condition, where one run in three tripled the cost.

## Caveats

- n=3 per condition, one Codegen point censored. Directional only.
- Single model (`sonnet`), single flow, single app build.
- The MCP condition measured here had the full playwright-mcp toolset —
  not what the docs described at the time, but what was then decided
  to be the MCP condition (§7.1).
- All runs here used app-knowledge primer v1; later batches use v2 (§9)
  and aren't directly poolable with these.
- Quality criteria 2 and 5 involve judgement; 1, 3, 4, 6 and 7 are backed
  by the objective signals in §5.
- Runs were sequential on one machine; OrangeHRM was fully reset before
  each run by `harness/run-repeats.sh`.

## Reproducing

```bash
npm run repeat:baseline    # both conditions, 3 repeats, app reset before every run
```

See `docs/run-repeats.md`, and `docs/run-mcp-condition.md` /
`docs/run-codegen-condition.md` for the exact prompts. Run from a plain
terminal, not inside a Claude Code session.

---

## Appendix: the original N=1 pair (superseded)

Two runs from earlier on 2026-09-25 — **before** the CLAUDE.md
contamination fix and before any repeats. Kept because the reasoning
below (especially the flakiness root cause) is still instructive; its
numbers are not current.

| | MCP `mcp-2026-09-25T06-32-18-639Z` | Codegen `codegen-2026-09-25T08-46-56-590Z` |
|---|---|---|
| Cost | $2.00 ($0.80 + $1.20) | $0.28 |
| Turns | 135 (58 + 77) | 9 |
| Test runs to green | 8 | 4 |
| Wall clock | ~9.8 min | ~4.1 min |
| Total tokens | 5.63M | 196K |
| Quality /28 | 24 | 22 |

**The flakiness root cause from this pair** (still a good illustration of
why criterion 3 is measured rather than read off the code): the Codegen
spec hardcoded `firstName = 'Thomas'` (from the codegen recording),
generated only a unique last name, and searched the employee autocomplete
by first name. Every run left another "Thomas" in the database — 8 by the
time it was scored — so the search got steadily less selective and the
test failed 3 of 5 re-runs, while the MCP spec (both names generated)
passed 5/5. A literal spec-compliance gap (criterion 6) caused measured
flakiness (criterion 3). Both specs looked equally solid on inspection.

The pair also showed both agents independently catching the same
`Locator.isVisible()`-doesn't-wait bug around the confirmation dialog, and
the MCP agent choosing to re-run its passing test once more to confirm
stability while Codegen stopped at first green — a behavioral difference
the repeat batch also shows (MCP r3 `…PP`, Codegen r2 `…PP`), so it's not
condition-specific either.
