# playwright-mcp: MCP vs Codegen token cost & quality benchmark

A reproducible testbed measuring what it costs, in tokens, iterations and
resulting test quality, to have an AI agent **write** a Playwright
end-to-end test, and to **heal** one after an app update, two ways:

- **MCP**: the agent drives a live browser through
  [Playwright MCP](https://github.com/microsoft/playwright-mcp), step by
  step, seeing accessibility-tree snapshots.
- **Codegen**: the agent starts from a human's `playwright codegen`
  recording and only sees terse `npx playwright test` output, with no live
  page.

## How the testbed works

The agent under test is Claude Code in non-interactive mode, one model
(`claude-sonnet-5`), against a self-hosted **OrangeHRM 5.9**, a common
QA practice app, reset to a clean install before every run. Both
conditions get the same task; only their tools differ, and that
difference is what's measured.

**Create flow: write a new test.** The task
([`flows/`](flows/01-add-employee-leave-request.md)): create an
employee, assign them leave, verify it was recorded.

- **MCP** works in two phases: *explore* the live app through
  Playwright MCP and write a test plan, then *generate* the test, run it
  and fix it until it passes, still with the browser at hand.
- **Codegen** starts from a checked-in `playwright codegen` recording
  that a human made once (no LLM tokens), and turns it into a clean test.
  It never sees the app: its only feedback is test output. It has no
  command line either, only a tool that runs the test.

**Heal flow: fix a test that used to pass.** A known-good test is broken
by an app update: a renamed button, or renamed CSS classes.

- **MCP** is Playwright's own bundled
  [healer agent](https://playwright.dev/docs/test-agents), word for word,
  with its MCP server: run the test, pause at the failure, inspect the
  live page, fix.
- **Non-MCP** gets the same healer instructions, but only test output
  plus the page snapshot Playwright saves on failure (`error-context.md`).

**App knowledge ("primer").** Both conditions get the same short notes
about the app, the kind a tester would keep (where things are, known
quirks): [`docs/app-knowledge/v3.md`](docs/app-knowledge/v3.md). How
much the agent is told turned out to matter more than anything else, so
the notes are versioned and every run records which version it saw.

**Quality criteria.** Cost alone doesn't decide anything: a cheap test
that's flaky hasn't won.

- A **generated test** is scored on 7 criteria, 0–4 each (/28): robust
  locators, meaningful assertions, measured reliability (5 re-runs from
  a clean app), Playwright best practices, structure, doing what the
  task asked, and no hardcoded config
  ([`docs/quality-rubric.md`](docs/quality-rubric.md)).
- A **healed test** is scored for integrity, /20: assertions and steps
  kept, not skipped, locators still specific, smallest change
  ([`docs/heal-rubric.md`](docs/heal-rubric.md)). A test that passes by
  testing less is a bad heal.

**Terms used below.**

| Term | Meaning |
|---|---|
| **Baseline** | Task + app notes, nothing else |
| **Nudged** | Baseline plus general Playwright best-practices guidance ([`docs/testing-best-practices/`](docs/testing-best-practices/)) in the phase that writes code |
| **Non-MCP** (healing) | The healer without a browser: test output and Playwright's failure snapshot only |
| **Survival check** | Re-running existing generated tests after an app update, no LLM: which ones break at all? |
| **Cost** | What the tokens would cost at list price (runs use a Claude Code subscription) |
| **Test runs until it passed** | How many times the agent ran the test before it went green |

**→ The full testbed (app, how to run it, what every file is for):
[docs/testbed.md](docs/testbed.md).**

## What has been tested so far

| Flow | Variant | MCP | Non-MCP (Codegen when creating) | Status |
|---|---|---|---|---|
| **Create a new test** (add employee → assign leave → verify) | Baseline: task + app notes | 3 runs | 3 runs | ✅ measured |
| | Nudged: + testing best-practices guidance | 3 runs | 3 runs | ✅ measured |
| | (First nudged batch, earlier guidance version with an app hint) | 3 runs | 3 runs | ✅ measured, superseded |
| **Heal a test that used to pass** (after a label or DOM change in the app) | Survival check: 12 specs × 4 app updates (no LLM) | | | ✅ measured |
| | Pilot: 2 app updates (label, DOM) | 6 runs | 6 runs | ✅ measured |

All measured runs: model `claude-sonnet-5`, app-knowledge primer v3
(short notes of the kind a tester keeps), one self-hosted OrangeHRM 5.9
install reset before every run. Earlier development runs with more
detailed primers are kept separately in
[docs/test-bed-evolution.md](docs/test-bed-evolution.md) and aren't part
of these numbers.

## First facts

Means per run, n=3 per cell. Full tables, per-run data, failure analysis
and caveats: **[docs/results.md](docs/results.md)**. What they suggest:
[Key insights](#key-insights) below.

| | MCP baseline | Codegen baseline | MCP nudged | Codegen nudged |
|---|---|---|---|---|
| Cost (list-price equivalent) | $0.51 | $0.42 | $1.49 | $0.50 |
| **MCP : Codegen cost** | **1.2x** | | **3.0x** | |
| Test runs until the test passed | 1.3 | 8.3 | 6.0 | 7.7 |
| Wall clock | 3.3 min | 8.4 min | 9.6 min | 6.5 min |
| Quality score (/28, [rubric](docs/quality-rubric.md)) | 22.7 | 23.3 | 24.7 | 26.7 |
| Specs passing 5 of 5 re-runs | 3/3 | 3/3 | 3/3 | 3/3 |

- **Baseline:** MCP's cost is mostly exploring the live app (~90%);
  after that its test usually passed on the first run. Codegen, which
  can't see the app, needed ~8 test runs, each rewriting the whole file.
- **Nudged:** guidance on test-writing practices raised quality in both
  conditions. It raised MCP's cost 2.9x (new assertions failed and MCP
  debugged them in the live browser) and Codegen's by 18%.
- The first nudged batch used an earlier version of the guidance whose
  one example URL came from this app. With it, Codegen cost $0.22
  instead of $0.50: a single hint about the app mattered more than all
  the best-practice advice.
- In every batch, some MCP specs hardcode values the agent saw while
  exploring (a leave date, a first name), even when told not to. No
  Codegen spec does.

**Healing** a spec broken by an app update (MCP = Playwright's own
healer agent; non-MCP = test output plus Playwright's failure snapshot):

| Mean per heal run | Label change, MCP | Label change, non-MCP | DOM change, MCP | DOM change, non-MCP |
|---|---|---|---|---|
| Cost | $0.19 | $0.05 | $0.14 | $0.20 |
| Healed, passes 5/5 re-runs | 3/3 | 3/3 | 3/3 | 3/3 |
| Integrity (/20, [rubric](docs/heal-rubric.md)) | 20 | 20 | 19.7 | 18.3 |

- Each app update broke exactly the generated specs whose locators
  depend on what changed.
- Every heal run fixed the test, 11 of 12 with the minimal one-line
  change. One (non-MCP, DOM change) weakened an assertion and still
  passes 5/5.
- The cheaper condition depended on the change: non-MCP for the label
  change, MCP for the DOM change.

## Key insights

Not "CLI good, MCP bad": which approach is cheaper, and by how much,
depends on what the agent knows, what kind of test work it does, and how
the tests are written. One app, one flow, one model, n=3; read these as
direction, not precise ratios. **Details, numbers and limits:
[docs/insights.md](docs/insights.md).**

1. **The cost gap depends mostly on what the agent already knows.** With
   the kind of notes a tester keeps, MCP cost 1.2x the no-browser
   approach. With notes that also listed this screen's exact pitfalls
   (e.g. "weekend dates are rejected", "the selected name shows a double
   space"), it was 6.3x. "MCP costs 4–10x more" is a statement about
   context, not about MCP.
2. **Knowledge replaces looking.** App-specific notes (pitfalls, where
   pages are) save the no-browser approach a lot and MCP almost nothing,
   since MCP can simply look. Playwright best-practice guidance improves
   quality for both, but costs MCP far more (+190% vs +18%).
3. **MCP looks first; the no-browser approach needs more attempts.** MCP
   spends ~90% of its cost exploring the app, then usually passes on the
   first test run. Codegen writes, runs, reads the error and rewrites:
   ~8 test runs until it passes.
4. **Quality didn't depend on the tooling.** All 18 generated tests pass
   5 of 5 re-runs; Playwright best-practice guidance raised the quality
   score of both by 2–3 points.
5. **For fixing a broken test, knowing which kind of locator failed lets
   you pick the cheaper tool; if you don't know, MCP is the safer
   default.** A renamed label is visible in Playwright's failure output,
   and the no-browser fix cost $0.05. A renamed CSS class isn't, and MCP
   was cheaper and steadier. MCP's cost was stable in both cases and it
   never weakened a test.
6. **A fixed test can pass and still check less than before.** One AI fix
   replaced a check with a weaker one and passed every re-run; only
   reading the change showed it. Review AI fixes like any code change.

## External references

- **The post that started this project:** [Playwright MCP vs the CLI: Why
  Your Browser Agent Burns 114K Tokens When It Could Use 27K](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html)
  (Dex Mareno, dreaming.press, July 2026). Cites ~114K vs ~27K tokens
  (MCP vs CLI) for a ~10-step task, from other people's benchmarks,
  without methodology, test app or harness of its own.
- **Microsoft's Playwright CLI:** [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli)
  README. A browser-driving CLI for coding agents, described as more
  token-efficient than MCP because it avoids "large tool schemas and
  verbose accessibility trees", while MCP "remains relevant for […]
  exploratory automation, self-healing tests, or long-running autonomous
  workflows". This is very likely the "CLI" the post compares; **our
  Codegen condition is a different setup** (a recording plus test output,
  no browser at all).
- **Where ~114K vs ~27K comes from is unclear.** Articles attribute it
  differently: to "the Playwright team's own benchmarks"
  ([TestCollab, Feb 2026](https://testcollab.com/blog/playwright-cli)),
  to "a recent r/ClaudeAI post"
  ([DEV Community](https://dev.to/leonting1010/playwright-mcp-burns-114k-tokens-for-one-workflow-heres-why-and-what-to-do-about-it-57k8)),
  or to a Medium article from February 2026 (the source the post above
  links). None of them links a benchmark we could check, and we haven't
  found a primary source.
- **Playwright's own test agents:** [Playwright Test Agents](https://playwright.dev/docs/test-agents)
  (planner, generator, healer). Our heal flow's MCP condition is that
  healer.
- **Why tool definitions and page state cost tokens:** [Code execution
  with MCP: building more efficient agents](https://www.anthropic.com/engineering/code-execution-with-mcp)
  (Anthropic, Nov 2025), on tool definitions and intermediate results
  filling the context window.

## What's next

Open questions the insights raise, none of them run yet:

- **Escalation for healing:** a short no-browser attempt, then MCP.
  Cheaper overall? (insight 5)
- **Out-of-date notes that contradict the app**, rather than just
  missing the change (insight 2).
- **More app updates, repeats, flows and models**, to firm up the
  ratios.

Details are in [`TODO.md`](TODO.md).

## License

[MIT](LICENSE).
