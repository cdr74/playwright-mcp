# Results

Test **generation** for one flow, on the realistic app primer (v3).
Batch run 2026-09-26, log `results/repeat-run-log-20260926T081334Z.txt`.

## TL;DR

1. **With realistic app knowledge, MCP costs only ~1.2x as much as
   Codegen** ($0.51 vs $0.42 per test). That's far below the
   [inspiring post](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html)'s
   4x–10x. The raw token gap is ~3x; prompt caching shrinks the dollar
   gap further.
2. **MCP is faster and far more direct.** MCP: 3.3 min on average, and its
   generate phase passed on the **first** test run in 2 of 3 runs.
   Codegen: 8.4 min and **8.3 test runs** to green, because it debugs an
   app it can't see.
3. **They spend money in opposite ways.** MCP pays up front for
   looking: ~90% of its cost is the explore phase, many cheap turns of
   re-read context. Codegen pays for guessing: every failed attempt
   rewrites the whole file, so ~55% of its cost is output tokens.
4. **Quality is high and about equal:** Codegen 23.3 vs MCP 22.7 out of
   28, a gap smaller than the spread within either condition. **All six
   specs pass 5/5 re-runs.** Each condition has its own typical weakness.
   MCP tends to copy concrete values it saw while exploring into the
   test (2 of 3 hardcode a date, 1 a first name). Codegen uses more CSS
   selectors (2 of 3).
5. **Codegen hits the traps the old, detailed primer used to spell out**
   (a blank starting page, the double-space name, the `-- Select --`
   option, the auto-filled To Date). It works each one out from test
   output, at the cost of time and output tokens, not quality.

## Setup

- **Task:** write one Playwright test for "add an employee, assign them
  leave, verify it" in a self-hosted OrangeHRM 5.9
  ([`flows/`](../flows/01-add-employee-leave-request.md)).
- **Conditions:** MCP (live browser via playwright-mcp, explore then
  generate) vs Codegen (a checked-in `playwright codegen` recording plus
  test output only, no browser). See the [README](../README.md#how-the-comparison-works).
- **What the agent knows about the app:** primer **v3**
  ([`app-knowledge/v3.md`](app-knowledge/v3.md)), short notes of the
  kind a tester would actually keep. The earlier, more detailed primers
  (v1, v2) were harness-development tools. Their results are in
  [`test-bed-evolution.md`](test-bed-evolution.md) and aren't comparable
  to this page.
- **Model:** `claude-sonnet-5` (pinned; `resolvedModels` confirms it in
  every phase). **Repeats:** 3 per condition, with a full app reset
  before every run. **Prompts:** baseline (not nudged).
- Checked from the transcripts: every session saw primer v3, none
  carries repo-context contamination, and there were no permission
  denials.

## Cost and efficiency

| Run | Cost | Turns | Test runs (F=fail, P=pass) | Wall clock | Total tokens | Output share of cost |
|---|---|---|---|---|---|---|
| MCP r1 `mcp-…08-15-01-569Z` | $0.47 (explore $0.43 + gen $0.04) | 40 (37+3) | `P` | 2.4 min | 0.99M | 16% |
| MCP r2 `mcp-…08-27-27-503Z` | $0.49 ($0.44 + $0.04) | 48 (45+3) | `P` | 4.4 min | 1.14M | 21% |
| MCP r3 `mcp-…08-47-04-742Z` | $0.56 ($0.48 + $0.08) | 48 (43+5) | `FP` | 3.1 min | 1.34M | 18% |
| Codegen r1 `codegen-…08-18-58-826Z` | $0.41 | 17 | `FFFFFFFP` | 7.0 min | 0.35M | 55% |
| Codegen r2 `codegen-…08-33-30-390Z` | $0.44 | 19 | `FFFFFFFFP` | 12.1 min | 0.43M | 55% |
| Codegen r3 `codegen-…08-51-43-630Z` | $0.41 | 17 | `FFFFFFFP` | 6.2 min | 0.35M | 56% |

| Means | MCP | Codegen | MCP : Codegen |
|---|---|---|---|
| Cost | $0.51 | $0.42 | **1.2x** |
| Turns | 45 | 18 | 2.6x |
| Test runs to green | 1.3 | 8.3 | 0.16x |
| Wall clock | 3.3 min | 8.4 min | 0.39x |
| Total tokens processed | 1.16M | 0.38M | 3.1x |

Cost is the list-price equivalent `claude -p` reports (runs are billed
against a Claude Code subscription, `CLAUDE.md` decision 3). Tokens
include cache reads, which are cheap. That's why the token ratio (3.1x)
is well above the dollar ratio (1.2x).

### MCP: look first, then write it down once

The explore phase is 86–91% of MCP's cost. It walks the real form and
writes a test plan. Given that plan, generate wrote a passing test
straight away in r1 and r2 (3 turns, $0.04 each). r3 failed once, on an
ambiguous `getByText('Assign Leave')` that matched two elements, then
passed.

### Codegen: write plausible code, then debug blind

Codegen's 22 failed test runs, by what was actually wrong:

| Cause | Failures | Note |
|---|---|---|
| "Successfully Saved" never appeared | 8 | Several different upstream bugs all surface here looking identical, so the agent has to guess which. |
| Deliberate debug probes | 4 | r2 wrote assertions designed to fail, just to dump form state into the test output: building the visibility MCP gets for free. |
| Test started on a blank page | 3 | Every run, first attempt. Dropping the recording's login steps also dropped its only `goto()`, and v3 names no URLs. |
| Selected-name rendering (`"First  Last"`, double space) | 3 | 2 of 3 runs. |
| To Date auto-filled from From Date, so typing appended to it | 2 | 2 of 3 runs. |
| `-- Select --` placeholder picked as the leave type | 1 | |
| CSS selector matching two elements | 1 | |

All of these are app facts that primer v2 spelled out or implied, and
v3 deliberately doesn't. Codegen worked each one out from test output,
which is exactly what its extra turns and output tokens pay for.

## Quality

Rubric: [`quality-rubric.md`](quality-rubric.md) (7 criteria, 0–4 each,
/28). Criterion 3 is measured: each spec re-run 5 times, serially,
after a full app reset and seed.

| Criterion | MCP r1 | MCP r2 | MCP r3 | CG r1 | CG r2 | CG r3 |
|---|---|---|---|---|---|---|
| 1. Selector robustness | 4 | 4 | 3 | 2 | 4 | 2 |
| 2. Assertions (fail-fast + diagnostics) | 3 | 3 | 3 | 3 | 3 | 3 |
| 3. Pass reliability, 5 measured runs | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) |
| 4. Playwright best practices | 3 | 4 | 4 | 4 | 3 | 4 |
| 5. Line count / structure | 4 | 4 | 3 | 3 | 3 | 4 |
| 6. Task/spec compliance | 2 | 4 | 4 | 4 | 4 | 4 |
| 7. Config/data separation | 1 | 2 | 1 | 2 | 2 | 4 |
| **Total /28** | **21** | **25** | **22** | **22** | **23** | **25** |

**Means: MCP 22.7, Codegen 23.3.** The difference is smaller than the
spread within either condition, so quality doesn't separate them.

What the scores rest on:

| Signal | MCP r1 | MCP r2 | MCP r3 | CG r1 | CG r2 | CG r3 |
|---|---|---|---|---|---|---|
| Lines | 60 | 84 | 85 | 95 | 101 | 99 |
| CSS locators | 0 | 0 | 1 | 3 | 0 | 2 |
| `waitForTimeout` | 0 | 0 | 0 | 0 | 0 | 0 |
| Absolute base URL | yes (2) | yes (2) | yes (constant) | yes (1) | yes (1) | **no** (relative) |
| Both names generated | **no** (`'TestQA'`) | yes | yes | yes | yes | yes |
| Leave date | **hardcoded** `2026-10-05` | computed weekday | **hardcoded** `2026-09-28` | computed weekday | computed weekday | computed weekday |
| Success signal | toast | API response (status, id, type, date) | toast + form reset | toast | toast | toast |
| Other | deprecated `type()` | | | | `networkidle` wait | |

Observations:

- **MCP copies what it saw.** Two MCP specs hardcode the leave date the
  agent picked in the live calendar, and one hardcodes a first name. We
  checked what happens once such a date is in the past: OrangeHRM
  accepts past-dated leave, so these tests **keep passing** but quietly
  stop testing "leave in the future", as the spec asks (r3 from
  2026-09-29, r1 from 2026-10-06). Criterion 7 scores this; the 5x
  re-run can't catch it.
- **Codegen generalizes what it was given.** All three Codegen specs
  compute a weekday date, and they're the only ones to use a relative
  URL (r3). They also pick up more CSS from the recording (r1, r3).
- **Only one spec asserts on the API response** (MCP r2), a signal it
  found by watching network traffic in the live browser.
- Latent risk in Codegen r3: it formats the date with `toISOString()`
  (UTC). Run between midnight and 02:00 local time (CEST), that gives the
  previous day, which can be a Sunday, which the app rejects. The 5x
  re-run can't catch this either.
- Criterion 5 is the least objective; treat its 3-vs-4 differences as
  low confidence.

## Compared to the inspiring post

The [post](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html)
claims ~4.2x tokens (up to 10x) for MCP vs CLI on a ~10-step task. With
realistic app knowledge we measure **3.1x tokens and 1.2x cost**. That's
in the same direction but smaller, and caching matters. During
development we did see 6.3x cost and 35x tokens, but only with a primer
detailed enough to be an answer key for this exact screen
([`test-bed-evolution.md`](test-bed-evolution.md)). How much the
non-browsing agent already knows decides where in that range you land,
and the post doesn't say what its CLI agent knew.

Our Codegen condition also isn't exactly the post's "CLI": the agent
never gets a shell (README, "How the comparison works").

## Caveats

- n=3 per condition. Enough to see direction, not to estimate
  distributions.
- One model, one flow, one app build.
- The primer only covers the parts of the app this flow touches. A real
  team's notes would cover much more of it. We don't expect that to
  change results much: the extra text would be cached context on every
  turn and adds nothing flow-specific. It's untested, though.
- The primer is our best attempt at "what a tester would write down".
  It's a judgment call, and it moves results a lot (see
  [`test-bed-evolution.md`](test-bed-evolution.md)), so it's versioned and
  recorded with every run.
- Quality criteria 2 and 5 involve judgment; the others rest on the
  objective signals above.

## Reproducing

```bash
npm run repeat:baseline    # both conditions, 3 repeats, primer v3, app reset before every run
```

Run it from a plain terminal, not inside a Claude Code session. See
[`run-repeats.md`](run-repeats.md), and the two runbooks for the exact
prompts.
