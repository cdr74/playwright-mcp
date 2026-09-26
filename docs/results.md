# Results

> **Status: waiting on the first primer-v3 batch.** Nothing below has
> been measured yet. Run `npm run repeat:baseline` (see
> [`run-repeats.md`](run-repeats.md)), then this page gets filled in.

## Setup these results come from

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
- **Model:** `sonnet`. **Repeats:** 3 per condition, with a full app
  reset before every run. **Prompts:** baseline (not nudged).

## Cost and efficiency

_Pending._

## Quality

Rubric: [`quality-rubric.md`](quality-rubric.md) (7 criteria, /28).
Flakiness is measured by 5 re-runs per spec after a full reset.

_Pending._

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
