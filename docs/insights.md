# Key insights

What the measurements suggest, in detail. The short version is in the
[README](../README.md#key-insights); every number here comes from
[`results.md`](results.md) (or, where marked, from the development runs in
[`test-bed-evolution.md`](test-bed-evolution.md)).

The point isn't a verdict. "CLI good, MCP bad" is the claim going around,
and the data says it's not that simple: which approach is cheaper, and by
how much, depends on what the agent already knows, what kind of test work
it's doing, and how the tests are written.

**How far this goes:** one app, one flow, one model (`claude-sonnet-5`),
n=3 per cell (healing: a pilot with two app updates). Read the numbers as
direction and rough size, not as precise ratios.

---

## 1. The cost gap depends mostly on what the agent already knows

**What we saw.** Same task, same tools, same model; only the app notes
changed:

| App notes given to both agents | MCP : Codegen cost |
|---|---|
| Short notes, the kind a tester keeps (v3, the headline setting) | **1.2x** |
| Detailed notes that also list this screen's exact pitfalls: weekend dates are rejected, the selected name shows a double space, the dropdown's placeholder counts as an option (v2, development) | **6.3x** |
| Sparse, early notes (v1, development) | 1.2x |

And within the realistic setting, a single example URL of this app in the
nudged guidance cut Codegen's cost from $0.50 to $0.22.

**What it means.** A figure like "MCP costs 4–10x more" is a statement
about context, not a property of MCP. Our realistic setting lands at
1.2x; you can reach 6x by telling the non-browsing agent, in advance,
exactly which pitfalls this screen has.
The widely quoted ~114K vs ~27K tokens has no traceable source (see the
README's external references), and doesn't say what its CLI agent knew.

**Confidence:** high for the direction; the exact ratios move with n=3.

## 2. Knowledge replaces looking

**What we saw.** Three kinds of knowledge, three different effects:

| Kind of knowledge | Without a browser (Codegen) | With MCP |
|---|---|---|
| **App traps**: non-obvious behaviour (weekend dates rejected, a name rendered with a double space, a placeholder that counts as an option, a field that auto-fills) | Large saving: most of its failures come from these. Development notes v1 → v2 cut its cost by 76% | None: it finds them by looking. Told about them, it double-checks anyway (cost +28%) |
| **App orientation**: where pages are, what URLs look like | Large saving: without it, its first attempt starts on a blank page ($0.50 → $0.22 with one URL example) | None: it navigates by looking |
| **Playwright best-practice guidance** (locators, assertions, test data) | Better quality (23.3 → 26.7 /28), cost +18% | Better quality (22.7 → 24.7), cost **+190%** |

**What it means.** App-specific knowledge is a substitute for seeing the
app, so it pays off almost only for the approach that can't see it. For
no-browser workflows, writing down the app's non-obvious behaviour is the
cheapest improvement there is. Playwright best-practice guidance buys
quality with either approach, but costs MCP far more: every extra assertion is one more
thing that can fail, and MCP answers a failure by going back to the live
browser.

**Not observed:** knowledge that made quality worse. **Not tested:** out
of date notes that *contradict* the app (in our healing runs they were
only incomplete).

**Confidence:** high for app knowledge vs. looking; medium for the
guidance cost (one batch per guidance version).

## 3. MCP looks first; the no-browser approach needs more attempts

**What we saw.** Baseline, realistic notes:

| | MCP | Codegen |
|---|---|---|
| Where the cost goes | ~90% exploring the live app | ~55% output: every fix rewrites the whole file |
| Test runs until the test passed | 1.3 | 8.3 |
| Wall clock | 3.3 min | 8.4 min |
| Cost | $0.51 | $0.42 |

**What it means.** MCP spends its effort looking at the app, then mostly
gets the test right on the first run, so its cost is roughly fixed. The
no-browser approach can't look, so it learns by trial: write the test,
run it, read the error, rewrite the whole file, about 8 times here. Its
cost grows with how many surprises the app holds, which is why insight
2's knowledge matters so much to it.
At similar cost, MCP was also faster in wall-clock time.

**Confidence:** high.

## 4. Quality didn't depend on the tooling; best-practice guidance lifted both

**What we saw.** All 18 generated tests on the realistic setting pass 5
of 5 re-runs from a clean app. Quality scores between the conditions
differ less than they vary within each (baseline 22.7 vs 23.3 of 28).
Playwright best-practice guidance raised both by 2–3 points, and
produced the only two perfect scores.

**What it means.** For this flow, which approach writes the test doesn't
decide whether the test is good; what the agent is told about good tests
does. The approaches differ in characteristic weaknesses rather than
overall quality (MCP tends to hardcode values it saw on screen, Codegen to
reuse CSS selectors from the recording; see `results.md`).

**Confidence:** medium: one flow, and a manual rubric.

## 5. For fixing a broken test, the kind of locator that failed suggests the tool

**What we saw.** Healing pilot, 3 runs per cell:

| | Label change | CSS/DOM change |
|---|---|---|
| No browser (test output + Playwright's failure snapshot) | **$0.05**, always 2 test runs | $0.12–$0.29, 4–5 test runs; 1 of 3 weakened an assertion |
| MCP (Playwright's own healer) | $0.10–$0.25 | **$0.13–$0.15**, steady |

The failure snapshot shows names and roles but no CSS classes: a renamed
button is visible in it, a renamed class isn't. Healing cost about a
tenth of generating the test.

**What it means.** You often don't know *why* a test broke, but the
failure output tells you *which locator* failed, and what kind it is:

- A **role/text locator** failed (`getByRole('button', { name: 'Assign' })`):
  probably a label change, and the snapshot usually shows the new name.
  The no-browser fix is cheapest.
- A **CSS locator** failed (`.oxd-select-text`): the snapshot can't show
  what changed. MCP was cheaper and more reliable.

If you can't tell, or don't want to look, **MCP is the safer default**:
its cost was steady across both kinds of change ($0.10–$0.25) and none of
its fixes weakened the test.

Which kind of failure you'll mostly see depends on your locators. That's
common knowledge for testers, and the survival check confirms it: of 12
generated tests, a renamed button or placeholder broke all 12, while
renamed CSS classes broke only the 6 (dropdown) or 3 (autocomplete) that
used those classes. So a role-based suite, as Playwright recommends,
mostly breaks on label changes, where a no-browser first attempt pays
off; a CSS-heavy suite mostly breaks on DOM changes, which favours MCP. On our numbers, "no browser
first" is cheaper on average once more than about 30% of breakages are
label-type. A variant we did **not** test: give the no-browser attempt a
small budget (label fixes took exactly 2 test runs), then hand over to
MCP.

**Proportion:** these are cents per fix. Reviewing the change costs more
than the tokens (insight 6).

**Confidence:** medium: a pilot with two app updates.

## 6. A fixed test can pass and still check less than before

**What we saw.** One healed test had swapped "Annual Leave was selected"
for the weaker "the dropdown closed", with a comment that misdescribed
the app change. It passes 5 of 5 re-runs, like every other heal. Only
reading the diff shows it now tests less.

**What it means.** Re-running a fixed test only tells you it passes, not
that it still checks what it used to. A fix that quietly tests less looks
exactly like a good one. Review healed tests by their diff, with a checklist
(assertions kept, steps kept, not skipped, locators still specific);
ours is [`heal-rubric.md`](heal-rubric.md).

**Confidence:** high as a point; one observed case out of 12.
