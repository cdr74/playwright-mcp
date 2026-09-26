# Results

Test **generation** for one flow, on the realistic app primer (v3), in
two batches that differ only in the prompt:

| Batch | Date | Log | Prompt |
|---|---|---|---|
| **Baseline** | 2026-09-26 | `results/repeat-run-log-20260926T081334Z.txt` | Task + app notes |
| **Nudged** | 2026-09-26 | `results/repeat-run-log-20260926T095822Z.txt` | Same, plus [`testing-best-practices.md`](testing-best-practices.md) in the code-writing phase |

This page records what was measured. Conclusions are still to be drawn.

## Measured facts

| Means per run (n=3) | MCP baseline | Codegen baseline | MCP nudged | Codegen nudged |
|---|---|---|---|---|
| Cost | $0.51 | $0.42 | $1.23 | $0.22 |
| **MCP : Codegen cost** | **1.2x** | | **5.5x** | |
| Turns | 45 | 18 | 90 | 7 |
| Test runs to green | 1.3 | 8.3 | 5.0 | 3.0 |
| Wall clock | 3.3 min | 8.4 min | 7.5 min | 2.7 min |
| Total tokens processed | 1.16M | 0.38M | 2.96M | 0.12M |
| Quality (/28, [rubric](quality-rubric.md)) | 22.7 | 23.3 | 24.7 | 26.7 |
| Specs passing 5/5 re-runs | 3 of 3 | 3 of 3 | 3 of 3 | 3 of 3 |

1. **Baseline:** MCP cost 1.2x Codegen. MCP reached green in 1.3 test
   runs and Codegen in 8.3. About 90% of MCP's cost was its explore phase;
   about 55% of Codegen's cost was output tokens (every fix rewrites the
   whole file).
2. **Nudged:** the ratio moved to 5.5x, in opposite directions. MCP cost
   went up 2.4x and Codegen cost went down 47%.
3. **Where MCP's extra nudged cost went:** the generate phase. The added
   checkpoint assertions failed (all six nudged runs of both conditions
   hit the double-space employee name), and MCP then debugged in the live browser: 34–48
   browser calls per generate phase, against 0 in every baseline run.
   Generate cost $0.84 on average (baseline $0.05).
4. **Where Codegen's saving came from:** its first attempt no longer
   started on a blank page. The best-practices text includes a relative
   `page.goto('/web/index.php/...')` example, and all three nudged runs
   navigated from their first attempt (0 of 3 in the baseline).
5. **Quality rose in both conditions with the nudge** (+2.0 MCP, +3.4
   Codegen). All 12 specs pass 5/5 re-runs. Nudged specs all use
   relative URLs (baseline: 1 of 6) and most log a diagnostic when an
   optional step doesn't happen.
6. **Hardcoded values copied from exploration appear in MCP specs in
   both batches.** Baseline: 2 of 3 hardcode a leave date, 1 a first
   name. Nudged: 1 hardcodes a date, 1 a first name. No Codegen spec does.

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
  every phase). **Repeats:** 3 per condition per batch, with a full app
  reset before every run.
- **Prompts:** baseline = task + app notes. Nudged = the same, plus
  [`testing-best-practices.md`](testing-best-practices.md) appended to
  the phases that write code (MCP generate, Codegen). MCP's explore
  phase is identical in both batches.
- Checked from the transcripts: every session saw primer v3, the
  best-practices text appears in exactly the nudged code-writing phases,
  none carries repo-context contamination, and there were no permission
  denials.

## Baseline batch

### Cost and efficiency

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

#### MCP: look first, then write it down once

The explore phase is 86–91% of MCP's cost. It walks the real form and
writes a test plan. Given that plan, generate wrote a passing test
straight away in r1 and r2 (3 turns, $0.04 each). r3 failed once, on an
ambiguous `getByText('Assign Leave')` that matched two elements, then
passed.

#### Codegen: write plausible code, then debug blind

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

### Quality

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

Observations (baseline):

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

## Nudged batch

### Cost and efficiency

| Run | Cost | Turns | Test runs (F=fail, P=pass) | Wall clock | Total tokens | Output share of cost |
|---|---|---|---|---|---|---|
| MCP r1 `mcp-nudged-…09-59-47-358Z` | $1.02 (explore $0.37 + gen $0.65) | 78 (33+45) | `FFFFP` | 5.8 min | 2.30M | 20% |
| MCP r2 `mcp-nudged-…10-11-52-390Z` | $1.21 ($0.40 + $0.81) | 98 (41+57) | `FFFP` | 7.6 min | 3.14M | 19% |
| MCP r3 `mcp-nudged-…10-25-26-038Z` | $1.46 ($0.41 + $1.05) | 95 (37+58) | `FFFFPP` | 9.2 min | 3.43M | 23% |
| Codegen r1 `codegen-nudged-…10-07-21-338Z` | $0.19 | 5 | `FP` | 2.2 min | 0.08M | 59% |
| Codegen r2 `codegen-nudged-…10-21-08-935Z` | $0.16 | 5 | `FP` | 1.9 min | 0.07M | 62% |
| Codegen r3 `codegen-nudged-…10-37-05-330Z` | $0.32 | 11 | `FFFFP` | 4.1 min | 0.22M | 59% |

| Means | MCP | Codegen | MCP : Codegen |
|---|---|---|---|
| Cost | $1.23 | $0.22 | **5.5x** |
| Turns | 90 | 7 | 12.9x |
| Test runs to green | 5.0 | 3.0 | 1.7x |
| Wall clock | 7.5 min | 2.7 min | 2.8x |
| Total tokens processed | 2.96M | 0.12M | 24x |

**MCP explore** (which never gets the best-practices text) cost $0.39 on
average, in line with the baseline's $0.45. The whole increase is in
**generate**: $0.84 on average against $0.05, with 34–48 live-browser
calls per run against 0 in the baseline.

**Failures, by condition.** All six nudged runs failed on the same new
checkpoint assertion, one the baseline specs didn't have: `toHaveValue`
on the employee field right after picking a suggestion, which renders
the name with a double space. MCP then went back to the browser to
investigate. Codegen fixed it from the test output, which shows the
expected and received values side by side. The remaining failures were "Successfully Saved"
not appearing (MCP 5, Codegen 1), a confirmation-dialog check (MCP 2),
and ambiguous text locators (MCP 1, Codegen 1).

**Codegen's first attempt navigated** in all three runs, using relative
`page.goto('/web/index.php/...')` calls. In the baseline, all three
first attempts started on a blank page. The best-practices text contains
exactly that path shape as an example for "don't hardcode the base URL".

### Quality

Same rubric and protocol as the baseline: 7 criteria, 0–4 each;
criterion 3 measured with 5 serial re-runs after a full reset and seed.

| Criterion | MCP r1 | MCP r2 | MCP r3 | CG r1 | CG r2 | CG r3 |
|---|---|---|---|---|---|---|
| 1. Selector robustness | 4 | 3 | 4 | 3 | 3 | 3 |
| 2. Assertions (fail-fast + diagnostics) | 4 | 3 | 4 | 4 | 4 | 4 |
| 3. Pass reliability, 5 measured runs | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) | 4 (5/5) |
| 4. Playwright best practices | 4 | 3 | 4 | 4 | 3 | 4 |
| 5. Line count / structure | 4 | 4 | 3 | 4 | 4 | 4 |
| 6. Task/spec compliance | 2 | 4 | 4 | 4 | 4 | 4 |
| 7. Config/data separation | 3 | 4 | 1 | 4 | 4 | 4 |
| **Total /28** | **25** | **25** | **24** | **27** | **26** | **27** |

**Means: MCP 24.7, Codegen 26.7** (baseline: 22.7 and 23.3).

| Signal | MCP r1 | MCP r2 | MCP r3 | CG r1 | CG r2 | CG r3 |
|---|---|---|---|---|---|---|
| Lines | 113 | 125 | 114 | 106 | 114 | 116 |
| CSS locators (with a comment saying why) | 0 | 1 (yes) | 0 | 1 (yes) | 3 (yes) | 4 (yes) |
| `expect()` calls | 11 | 16 | 12 | 9 | 14 | 11 |
| Diagnostic log / annotation | 1 | 0 | 2 | 1 | 1 | 2 |
| Absolute base URL | no | no | no | no | no | no |
| Both names generated | **no** (`'TestQA'`) | yes | yes | yes | yes | yes |
| Leave date | computed weekday | computed weekday | **hardcoded** `2026-10-05` | computed weekday | computed weekday | computed weekday |
| Other | | deprecated `type()`; asserts API response | | | deprecated `type()` | |

Observations (nudged):

- Every nudged spec navigates with relative URLs, and every CSS locator
  comes with a comment explaining why no accessible alternative exists.
  Both are items in the best-practices text.
- The two MCP habits from the baseline both survived the nudge in one
  run each: a hardcoded first name (`'TestQA'` again, r1) and a leave
  date picked during exploration (r3). The best-practices text
  explicitly says to generate all test data.
- Four specs format the date with `toISOString()` (UTC), the same latent
  midnight-to-02:00 issue noted for baseline Codegen r3.
- Codegen r1 searches the employee field by `firstName.slice(0, 8)`
  (`"Thomas"` plus two digits of a timestamp), a prefix shared by every
  employee it creates within roughly a quarter of an hour. That's
  harmless from a clean reset, a latent risk in a long-lived
  environment.

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
- **The best-practices text carries more than best practices.** It's fed
  verbatim, and its opening paragraphs describe the benchmark itself
  (the baseline-vs-nudged comparison, and that
  `docs/quality-rubric.md` is "what an agent gets scored against
  afterward"), so the nudged agents knew they were being scored. Its
  example `page.goto('/web/index.php/...')` also carries a small piece of
  app knowledge. Both affect how the nudged numbers should be read.

## Reproducing

```bash
npm run repeat:baseline    # both conditions, 3 repeats, primer v3, app reset before every run
npm run repeat:nudged      # the same, plus docs/testing-best-practices.md
```

Run it from a plain terminal, not inside a Claude Code session. See
[`run-repeats.md`](run-repeats.md), and the two runbooks for the exact
prompts.
