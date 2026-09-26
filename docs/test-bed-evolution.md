# How the test bed evolved

**Not the results.** The current, real-world-relevant results are in
[`results.md`](results.md). This document is the development history:
the runs we made while building the harness, what each one taught us, and
why the setup looks the way it does now. Its numbers were measured
against setups we later changed on purpose. Read them as lessons, not as
measurements of MCP vs Codegen.

## The short version

| Stage | What changed | What it taught us |
|---|---|---|
| N=1 pair (appendix) | First end-to-end run of each condition | The pipeline works. One run each said "7x", which later reversed. |
| Contamination fix | Claude Code was attaching this repo's `CLAUDE.md` + memory to every run; fixed by running from an outside cwd | Check what the agent actually saw, from the transcripts. `--system-prompt` alone isn't isolation. |
| Batch 1, primer v1 | 3 repeats per condition | Variance matters: n=1 misled. A 10-min timeout was censoring the slowest runs. The MCP tool allow-list had never been enforced. |
| Full MCP toolset | Adopted as the MCP condition (`CLAUDE.md` decision 13) | "MCP out of the box" is what gets measured. |
| Batch 2, primer v2 | Primer + three app traps that every batch-1 run had hit | **What the agent is told about the app outweighs its tooling**: cost ratio 1.2x → 6.3x. |
| Primer v3 | Cut back to what a real tester would actually write down (`CLAUDE.md` decision 16) | v1/v2 were written by us while building the harness, and v2's traps came from watching agents fail on this exact screen, so it worked partly as an answer key. v3 is the baseline for [`results.md`](results.md). |

The most important lesson: **how much the agent knows about the app
decides the size of the gap**, and v2 went further than any real tester's
notes would. That's why v3 exists, and why v1/v2 numbers aren't
headline results.

Everything below is the detailed write-up of batches 1 and 2 as it stood
before v3 (2026-09-25). Both batches: baseline prompts (not nudged),
model `sonnet` (resolved to `claude-sonnet-5` in every run), the contamination-fixed harness, playwright-mcp's full
toolset, a full app reset before every run.

| Batch | Log | Primer | Runs |
|---|---|---|---|
| 1 | `results/repeat-run-log-20260925T132116Z.txt` | v1 | 3 MCP + 3 Codegen (1 Codegen censored by a since-fixed timeout, `*`) |
| 2 | `results/repeat-run-log-20260925T151730Z.txt` | v2 = v1 + three app traps | 3 MCP + 3 Codegen, all complete |

Verified from the transcripts themselves (the system prompt is recorded
in them): every batch-2 session saw primer v2, every earlier session v1,
none carries the old `CLAUDE.md`/auto-memory contamination.

## Batches 1 and 2: summary

1. **The app-knowledge primer, not the tooling, decides the size of the
   gap.** Same tools, same flow, same model — adding three short
   paragraphs about app traps moved the MCP:Codegen **cost ratio from
   1.16x to 6.3x**, turns from 2.6x to 12.9x, raw token volume from 2.7x
   to 35x, and **flipped wall clock** (MCP from ~2x faster to ~2.4x
   slower).
2. **Codegen's cost is the price of not knowing the app.** Primer v1 → v2:
   cost **$0.62 → $0.15** (−76%), turns 23 → 5.7, test runs to green
   ~11 → 2.3, wall clock 8.8 → 2.0 min. Most of its batch-1 failures
   traced back to exactly the traps v2 documents (§3); with them written
   down, it mostly writes a working test on the first or third try.
3. **MCP pays for discovery every run, whether or not it needs to.**
   Primer v1 → v2: cost $0.71 → $0.91, explore turns 44 → 56. Given the
   traps up front, MCP's explore phase engages with each of them live
   (and writes them into a longer test plan) rather than trusting the
   primer. What it *does* buy: the generate phase passed on its **first**
   test run in 2 of 3 batch-2 runs (3 turns, ~$0.06).
4. **The post's 4x–10x is reachable — but it's a statement about context,
   not just tooling.** Batch 2 lands at 6.3x cost / 35x tokens, in or above
   the [inspiring post](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html)'s
   range. Batch 1 was ~1.2x. The same MCP-vs-CLI claim is true or false
   depending on how much the non-browsing agent already knows.
5. **The cost anatomy holds in both batches.** MCP: many cheap turns,
   ~80% of cost is context. Codegen: few expensive turns, ~55% output
   (every fix rewrites the whole file).
6. **Quality improved in both conditions under v2, and Codegen now
   scores higher.** Every batch-2 spec generates both names uniquely and
   picks a weekday; Codegen's specs now also respect `baseURL` (3/3, vs
   0/3 MCP). All six batch-2 specs pass 5/5 on re-run. Rubric
   means: **Codegen 26.3 vs MCP 23.3** (/28) — a real gap this time, but
   it comes *entirely* from two criteria: Codegen uses relative URLs where
   MCP hardcodes the base URL (config, #7), and two of its specs use no
   CSS locators at all (#1). On reliability, spec compliance and best
   practices the conditions are identical.
7. **One recurring trap is left, and it's not an app quirk:** the
   confirmation dialog appears asynchronously, and code like
   `isVisible({ timeout })` doesn't wait for it, so the "Ok" click is
   silently skipped and nothing saves. Both conditions have hit it in
   every batch. It's a Playwright-API gotcha, which is what the (still
   unrun) nudged primer's guidance targets, not the app primer.
8. **Small samples mislead, twice over.** The original N=1 pair suggested
   7x; batch 1 (n=3) said ~1.2x; batch 2 says 6.3x. The first reversal was
   variance, the second a controlled change. Neither single number is
   "the" answer without saying what the agent was told about the app.

## A. Batch 2 (primer v2): what the primer changed

### Per run

| Run | Cost | Turns | Test runs | Wall clock | Total tokens | Output share | Context share |
|---|---|---|---|---|---|---|---|
| MCP r1 `mcp-…15-18-56-657Z` | $0.82 (explore $0.76 + gen $0.06) | 64 (61+3) | `P` | 2.9 min | 2.33M | 15% | 85% |
| MCP r2 `mcp-…15-27-17-187Z` | $1.15 ($0.49 + $0.66) | 89 (45+44) | `FFFPP` | 6.5 min | 2.74M | 23% | 77% |
| MCP r3 `mcp-…15-39-25-865Z` | $0.78 ($0.72 + $0.06) | 66 (63+3) | `P` | 5.4 min | 2.24M | 17% | 83% |
| Codegen r1 `codegen-…15-23-31-133Z` | $0.15 | 7 | `FFP` | 2.2 min | 0.08M | 54% | 46% |
| Codegen r2 `codegen-…15-36-21-741Z` | $0.09 | 3 | `P` | 1.0 min | 0.03M | 63% | 37% |
| Codegen r3 `codegen-…15-47-05-687Z` | $0.20 | 7 | `FFP` | 2.9 min | 0.10M | 62% | 38% |

### Before / after (means, primer v1 → v2)

| | MCP v1 | MCP v2 | Codegen v1 | Codegen v2 | MCP:Codegen v1 → v2 |
|---|---|---|---|---|---|
| Cost | $0.71 | $0.91 | ≥$0.62 | $0.15 | 1.16x → **6.3x** |
| Turns | 60 | 73 | ≥23 | 5.7 | 2.6x → **12.9x** |
| Test runs to green | 3.0 | 2.3 | 11 (n=2) | 2.3 | ~0.27x → 1.0x |
| Wall clock | 4.1 min | 4.9 min | ≥8.8 min | 2.0 min | 0.47x → **2.4x** |
| Total tokens | 1.73M | 2.44M | ≥0.65M | 0.07M | 2.7x → **35x** |
| MCP explore turns / cost | 44 / $0.50 | 56 / $0.66 | — | — | — |

### Why Codegen gained so much

In batch 1, 29 Codegen test failures were dominated by "Successfully Saved
toast not found" — a symptom several different upstream bugs share (§3).
Three of those bugs are exactly what v2 documents: the `-- Select --`
placeholder picked as a leave type, a weekend date silently rejected, and
an autocomplete value asserted with one space instead of two. With them
written down, batch 2's Codegen runs had **4 failures in total**, not 29,
and every spec shows the primer's influence directly: weekday logic in 3/3,
and one spec asserts the double-space value verbatim. Shorter runs also
mean shorter context: cache-read per turn fell from 22–27K to 6–11K.

The remaining failures were the async confirmation dialog (TL;DR 7) and,
once, a 30s click timeout on a selector carried over from the raw
recording. Codegen r2 wrote a passing test on its first try — 3 turns,
$0.09, one minute.

### Why MCP didn't

MCP's exploration doesn't shrink when it's told more — it grows. In
batch 2 its assistant messages during explore refer to the documented
traps several times per run, and all three test plans now spell out
weekday selection (two also spell out the double-space value) — so it is
reading the primer, and then *confirming* it in the browser. Explore
turns rose from 44 to 56 on average and explore cost from $0.50 to $0.66.
The payoff shows in generate: two of three runs passed on their very
first test run (3 turns, ~$0.06 each). MCP r2 is the exception again —
its generate phase failed three times, went back to the browser
(including `browser_evaluate` x3 and `browser_run_code_unsafe` x4, both
part of the full toolset per decision 13), and cost $0.66 on its own.

Put differently: MCP's cost is mostly a **fixed cost of looking**; the
primer barely changes it. Codegen's cost is mostly a **variable cost of
not knowing**; the primer removes most of it.

### Quality (batch 2)

Same rubric and protocol as batch 1 (§5): 7 criteria, 0–4 each; criterion
3 measured by re-running each spec 5x after a full app reset + seed.

| Criterion | MCP r1 | MCP r2 | MCP r3 | CG r1 | CG r2 | CG r3 |
|---|---|---|---|---|---|---|
| 1. Selector robustness | 2 | 3 | 3 | 4 | 4 | 2 |
| 2. Assertions (fail-fast + diagnostics) | 3 | 3 | 4 | 3 | 3 | 4 |
| 3. Pass reliability, 5 measured runs | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) |
| 4. Playwright best practices | 4 | 4 | 4 | 4 | 4 | 4 |
| 5. Line count / structure | 4 | 3 | 3 | 4 | 4 | 3 |
| 6. Task/spec compliance | 4 | 4 | 4 | 4 | 4 | 4 |
| 7. Config/data separation | 2 | 2 | 2 | 4 | 4 | 4 |
| **Total /28** | **23** | **23** | **24** | **27** | **27** | **25** |

| Signal | MCP r1 | MCP r2 | MCP r3 | CG r1 | CG r2 | CG r3 |
|---|---|---|---|---|---|---|
| Lines | 83 | 120 | 139 | 100 | 95 | 136 |
| CSS class locators | 3 | 2 | 2 | 0 | 0 | 3 |
| `waitForTimeout` | 0 | 0 | 0 | 0 | 0 | 0 |
| Absolute base URL | 1 | 1 | 1 | **0** (relative) | **0** | **0** |
| Both names generated | yes | yes | yes | yes | yes | yes |
| Weekday-date logic | yes | yes | yes | yes | yes | yes |
| Autocomplete search term | first name (unique) | first name (unique) | first name (unique) | **`firstName.slice(0, 5)`** | first name (unique) | **`firstName.slice(0, 5)`** |
| `expect()` calls | 3 | 9 | 4 | 4 | 4 | 12 |
| Diagnostics | — | — | API status + 1 log | — | — | API status w/ response body in message + 1 log |

**Measured reliability: all six specs pass 5/5.** Across both batches,
every spec from a run that finished — 11 of 11 — passes 5/5 from a clean
reset. Codegen r3's five runs took 2.3 min against ~38s for the others:
reliable, but noticeably slower per run (its defensive response waits),
which the rubric doesn't currently score.

**Totals: MCP 23.3 / 28, Codegen 26.3 / 28** (batch 1: 21.7 vs 24.0 for
finished runs). Both conditions improved under v2 — every spec now
generates both names and picks a weekday (criterion 6 is 4 across the
board; in batch 1, two MCP specs hardcoded a first name). Unlike batch 1,
the gap between conditions now exceeds the spread within either one, and
it has two identifiable sources:

- **Criterion 7 (config):** all three Codegen specs navigate with
  relative paths, respecting `playwright.config.ts`'s `baseURL`; all
  three MCP specs hardcode the absolute URL once (a `goto` or a
  `BASE_URL` constant). In batch 1, *all six* specs hardcoded it — so
  this is new, and Codegen-specific. A plausible reason: the recording it
  starts from opens with an absolute URL inside the login step its prompt
  tells it not to write, so rewriting navigation is already on its plate;
  MCP only ever sees full URLs in its browser snapshots. That's a
  hypothesis, not tested.
- **Criterion 1 (selectors):** Codegen r1/r2 use no CSS class locators
  at all — the raw recording it starts from is built on `getByRole`, and
  those survive the cleanup. Every MCP spec uses some CSS: `.oxd-select-*`
  on the custom dropdown in two, and `input[placeholder=…]` attribute
  selectors (where `getByPlaceholder` would do) in the third.

One latent risk the 5x protocol doesn't catch: **Codegen r1 and r3 search
the employee autocomplete by `firstName.slice(0, 5)`** — `"Thoma"`, shared
by every Codegen employee (all keep the recording's "Thomas" as a name
prefix). From a clean reset that's fine (5/5); in a shared, long-lived
environment it's the same shape as the original N=1 "Thomas" flakiness
bug (appendix). Criterion 6 doesn't flag it — the names *are* unique;
only the search term isn't.

---

# Batch 1 in detail (primer v1)

Sections 1–7 below are the full analysis of batch 1, written before primer
v2 existed. Their numbers are batch-1 numbers; see §A above for batch 2.

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
success signal `docs/app-knowledge/` recommends) and asserted on the
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

---

# Across both batches

## 8. Compared to the inspiring post

The [post](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html)
claims ~114K vs ~27K tokens (~4.2x, "up to 10x") for MCP vs CLI on a
~10-step task, attributed to MCP re-injecting page state every step.

| | Token volume ratio | Dollar cost ratio |
|---|---|---|
| Post | ~4.2x (up to 10x) | not stated |
| Our N=1 pair (appendix) | ~29x | ~7x |
| Batch 1 (primer v1) | ~2.7x | ~1.2x (MCP cheaper at the median) |
| Batch 2 (primer v2) | **~35x** | **~6.3x** |

- **The post's range is reachable — under specific conditions.** With a
  primer that covers the app's traps, we land in or above it. Without,
  the gap nearly vanishes. The post doesn't say what its CLI agent knew
  about the app beforehand, and that turns out to be the largest single
  factor we've measured.
- **Dollar cost ≠ token volume.** Prompt caching turns most of MCP's
  extra context into $0.20/M cache reads; the dollar gap is always much
  smaller than the token gap. The post doesn't say whether it accounts
  for caching.
- **Mechanism:** supported — MCP context grows with run length, and MCP
  keeps paying for exploration even when told what it'll find (§A). But
  the *other* side's cost is driven by what that agent doesn't know, not
  by its tooling per se.
- Our "Codegen" condition isn't exactly what the post calls CLI — the
  agent never gets a shell (see `README.md` "How the comparison works").

## 9. Recommendations and open questions

Decided so far:

- **MCP toolset** (§7.1): the full playwright-mcp toolset is the MCP
  condition (`CLAUDE.md` decision 13).
- **Primer v2** (`CLAUDE.md` decision 10): the three recurring traps are
  in `docs/app-knowledge/`. Batch 1's prediction — "Codegen should gain
  the most, narrowing or flipping the iterations-to-green and wall-clock
  gaps" — **held, and understated it**: Codegen's cost fell 76%, the
  iterations gap closed completely, wall clock flipped, and the cost gap
  widened from 1.2x to 6.3x.
- **The primer is now an explicit experimental variable** (`CLAUDE.md`
  decision 14): v1 and v2 are frozen in `docs/app-knowledge/`, selected
  per run, recorded as `primerVersion` in every `metrics.json`
  (backfilled for all earlier runs from transcript evidence). This doc
  reports per version; don't pool across them.

Still open (each touches the experiment's design, so proposals only):

- **Run the nudged variant** (`npm run repeat:nudged`) — wired, no data
  yet, and decided to use app primer v2, so it compares against batch 2.
  It's the natural test for the one remaining recurring trap (the async
  confirmation dialog, TL;DR 7), which is Playwright-API knowledge, not
  app knowledge.
- **An edit-style tool for Codegen** would test how much of its
  (now small) cost is whole-file rewrites. Changes a condition's tool
  surface — design decision.
- **More repeats**: n=3 per cell is enough to see a 4x shift, not to
  estimate distributions. MCP in particular has one expensive outlier in
  each batch (batch 1 r3, batch 2 r2).
- **Model coverage** (`CLAUDE.md` decision 7) — does a stronger or weaker
  model need the primer less or more? Given how much the primer matters,
  this interacts with it directly.

## Caveats

- n=3 per condition per batch; batch 1 has one censored Codegen point.
  Directional only.
- Single model (`sonnet`), single flow, single app build.
- Batches are **not poolable**: they differ in the primer (by design) and
  were run a couple of hours apart on the same machine.
- The MCP condition had playwright-mcp's full toolset in every run —
  first by accident, then by decision (§7.1).
- Quality criteria 2 and 5 involve judgement; 1, 3, 4, 6 and 7 are backed
  by objective signals (§5, §A).
- Runs were sequential on one machine; OrangeHRM was fully reset before
  each run by `harness/run-repeats.sh`.

## Reproducing

```bash
npm run repeat:baseline -- --primer v1    # batch 1's setup
npm run repeat:baseline -- --primer v2    # batch 2's setup
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
