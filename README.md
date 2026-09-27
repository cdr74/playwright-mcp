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

## What has been tested so far

| Flow | Variant | MCP | Codegen | Status |
|---|---|---|---|---|
| **Create a new test** (add employee → assign leave → verify) | Baseline: task + app notes | 3 runs | 3 runs | ✅ measured |
| | Nudged: + testing best-practices guidance (v1) | 3 runs | 3 runs | ✅ measured |
| | Nudged, clean guidance (v2: no benchmark talk, no app hints) | | | ⏳ to run |
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
and caveats: **[docs/results.md](docs/results.md)**. Conclusions are
still to be drawn.

| | MCP baseline | Codegen baseline | MCP nudged | Codegen nudged |
|---|---|---|---|---|
| Cost (list-price equivalent) | $0.51 | $0.42 | $1.23 | $0.22 |
| **MCP : Codegen cost** | **1.2x** | | **5.5x** | |
| Test runs until the test passed | 1.3 | 8.3 | 5.0 | 3.0 |
| Wall clock | 3.3 min | 8.4 min | 7.5 min | 2.7 min |
| Quality score (/28, [rubric](docs/quality-rubric.md)) | 22.7 | 23.3 | 24.7 | 26.7 |
| Specs passing 5 of 5 re-runs | 3/3 | 3/3 | 3/3 | 3/3 |

- **Baseline:** MCP's cost is mostly exploring the live app (~90%);
  after that its test usually passed on the first run. Codegen, which
  can't see the app, needed ~8 test runs, each rewriting the whole file.
- **Nudged:** guidance on test-writing practices raised quality in both
  conditions. It raised MCP's cost 2.4x (new assertions failed and MCP
  debugged them in the live browser) and cut Codegen's by about half.
- In both batches, some MCP specs hardcode values the agent saw while
  exploring (a leave date, a first name). No Codegen spec does.

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

## Why

This project started from
[this post](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html).
It claims a ~4x (up to 10x) token gap between MCP and CLI approaches
(~114K vs ~27K tokens for a ~10-step task), but gives no methodology,
test app or harness. This repo builds that harness in the open, so anyone
can check, reproduce or extend the numbers. It also measures quality,
because a cheap test that's flaky hasn't "won".

## How the comparison works

Two realistic workflows for the same task. The tools differ on purpose;
that difference is what's being measured.

| | MCP condition | Codegen condition |
|---|---|---|
| Input | Task spec + app primer | Task spec + app primer + checked-in `playwright codegen` recording |
| Tools | Playwright MCP's full browser toolset + scoped `write_file` + scoped `run_playwright_test` | Scoped `write_file` + scoped `run_playwright_test` only. **No** browser, **no** shell |
| Sees the app via | Live accessibility snapshots | The recording and test-run output |
| Phases | **explore** (writes `test-plan.md`), then **generate** (writes and iterates on the spec) | One phase: clean up the recording, run, fix, repeat |

- **Identical task spec** for both ([`flows/`](flows/)). This is the
  controlled variable.
- **Why "Codegen" and not "CLI":** a human runs `playwright codegen` once,
  up front, with zero LLM tokens. The agent itself never gets a real
  command line, only a tool that runs `npx playwright test` inside the
  run directory. (The tests it writes are Node.js code, though, and can
  do anything a test can.) How an agent with unrestricted CLI access
  would behave is a separate question this project doesn't answer.
- **App-knowledge primer:** both conditions get the same "tester
  knowledge" doc ([`docs/app-knowledge/`](docs/app-knowledge/)) covering
  navigation, forms and known quirks, all observed in the running app. A
  real tester wouldn't start from zero. The primer turned out to be the
  largest single factor measured
  ([how we found out](docs/test-bed-evolution.md)), so it's versioned and
  every run records which version it used. The current one (v3) is kept
  deliberately to what a tester would actually write down.
- **Three axes:** cost (tokens, cache, list-price USD), efficiency
  (turns, tool calls, test runs to green, wall clock) and quality (a
  7-criterion rubric, with flakiness measured by 5 re-runs).
- **Mechanism:** each phase is one `claude -p` (Claude Code,
  non-interactive) call with an explicit system prompt, tool allow-list
  and MCP config. Tokens and cost come straight from its JSON result.
  It uses a Claude Code subscription, not metered API calls.

### Healing

A known-good spec ([`fixtures/heal/`](fixtures/heal/add-employee-leave.spec.ts))
is broken by an app update: a label change or a CSS-class change, applied
to the running app by [`app/break.sh`](app/break.sh). An agent then has
to fix it.

| | MCP condition | Non-MCP condition |
|---|---|---|
| Agent | Playwright's own bundled healer agent, word for word | The same healer text, with the browser steps replaced by "read the failure output and its page snapshot" |
| Tools | Playwright's `playwright-test` MCP server (run, pause on error, inspect the live page) + scoped file read/write/patch | Scoped test runner whose failure output includes Playwright's `error-context.md` snapshot + the same file tools. **No** browser, **no** shell |
| Scored on | Cost and efficiency, pass rate over 5 re-runs, and an **integrity rubric**: is it still the same test? ([`docs/heal-rubric.md`](docs/heal-rubric.md)) | same |

Both get the same app notes and task message. Beforehand, a zero-token
**survival check** measures which already-generated specs each update
breaks at all.

The confirmed design decisions, with the reasoning behind them, are in
[`CLAUDE.md`](CLAUDE.md). The exact prompts are in
[`docs/run-mcp-condition.md`](docs/run-mcp-condition.md),
[`docs/run-codegen-condition.md`](docs/run-codegen-condition.md) and
[`docs/run-heal.md`](docs/run-heal.md).

## Test bed

- **App:** self-hosted **OrangeHRM 5.9** (Docker or Podman,
  [`app/`](app/)). It's a long-standing QA practice app with multi-page
  navigation, validated forms, custom dropdowns, date pickers and tables.
  A pinned local install means no third-party uptime dependency and no
  drift between runs.
- **Flow:** create an employee (PIM), assign them leave through the
  admin **Assign Leave** screen, and verify the result
  ([`flows/01-add-employee-leave-request.md`](flows/01-add-employee-leave-request.md)).
- **Out of scope for the agent:** login and one-time Leave module setup.
  [`harness/src/seed.ts`](harness/src/seed.ts) handles both
  deterministically before every run.
- **Reset:** a full app reinstall (~80s) before *every* run, so repeats
  are independent.

## Getting started

Requires Node, Docker or Podman, and the [`claude`](https://claude.com/claude-code)
CLI, installed and authenticated (no API key needed).

```bash
cp .env.example .env
npm install
npm run setup           # target app + Playwright browser
npm run verify:tools    # smoke-check playwright / playwright-mcp
```

[`docs/verify-setup.md`](docs/verify-setup.md) walks through checking
the setup by hand.

**Run from a plain terminal, not from inside a Claude Code session.** The
harness spawns permission-bypassed `claude -p` sessions, and Claude Code
blocks that when it's done from inside another session
([`harness/README.md`](harness/README.md)).

```bash
# Full comparison: both conditions, 3 repeats, app reset before every run (~$3, ~45 min)
npm run repeat:baseline
npm run repeat:nudged                      # same, plus best-practices guidance (docs/testing-best-practices/)
npm run repeat:baseline -- --primer v2     # an earlier primer (default: v3)

# Healing
npm run survival                           # which generated specs each app update breaks (no LLM)
npm run repeat:heal                        # healing pilot: 2 app updates x 2 conditions x 3 repeats

# Single runs
npm run explore:mcp                        # prints a RUN_ID
RUN_ID=<id> npm run generate:mcp
npm run bench:codegen
HEAL_BREAK=dom-select npm run heal:mcp     # or heal:artifacts
```

Each run writes its spec, `metrics.json` and (for MCP) `test-plan.md` to
`results/<run-id>/`, heal runs also a `heal.diff`. Full transcripts go to
`results/raw/`, which is gitignored ([`results/README.md`](results/README.md)).
[`docs/run-repeats.md`](docs/run-repeats.md) and
[`docs/run-heal.md`](docs/run-heal.md) cover batches in detail.

## What's next

- **Re-run the nudged batch** with the clean guidance (v2); the first
  one (v1) told the agents they'd be scored and carried a URL hint.
- **Conclusions** from the generation batches and the healing pilot.
- **Test healing beyond the pilot**, if the conclusions call for it:
  more app updates or repeats ([runbook](docs/run-heal.md)).

Details are in [`TODO.md`](TODO.md).

## License

[MIT](LICENSE).
