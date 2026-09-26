# playwright-mcp: MCP vs Codegen token cost & quality benchmark

A reproducible testbed measuring what it costs, in tokens, iterations and
resulting test quality, to have an AI agent write Playwright end-to-end
tests two ways:

- **MCP**: the agent drives a live browser through
  [Playwright MCP](https://github.com/microsoft/playwright-mcp), step by
  step, seeing accessibility-tree snapshots.
- **Codegen**: the agent starts from a human's `playwright codegen`
  recording and only sees terse `npx playwright test` output, with no live
  page.

> ### 📊 Results → **[docs/results.md](docs/results.md)**
>
> Short version: **what the agent knows about the app matters more than
> its tooling.** Adding three paragraphs about app traps to the prompt
> moved the MCP:Codegen cost ratio from **1.2x to 6.3x**. Test quality is
> high in both conditions.

## Results at a glance

Two 3-repeat baseline batches (model `sonnet`, flow below), identical
except for the **app-knowledge primer** both conditions get: v1, then v2
(v1 plus three app traps every batch-1 run hit).

| Means per run | MCP, v1 | Codegen, v1 | MCP, v2 | Codegen, v2 |
|---|---|---|---|---|
| Cost | $0.71 | ≥$0.62* | $0.91 | **$0.15** |
| Turns | 60 | ≥23* | 73 | **5.7** |
| Test runs to green | 3.0 | ~11* | 2.3 | 2.3 |
| Wall clock | 4.1 min | ≥8.8 min* | 4.9 min | **2.0 min** |
| **MCP : Codegen cost** | **1.16x** | | **6.3x** | |
| Quality (/28, [rubric](docs/quality-rubric.md)) | 21.7 | 24.0 | 23.3 | **26.3** |
| Specs passing 5/5 re-runs | 3 of 3 | 2 of 2 finished | 3 of 3 | 3 of 3 |

`*` one batch-1 Codegen run was cut off by a since-fixed timeout; lower
bounds.

- **Codegen's cost is the price of not knowing the app.** Unable to see
  the page, it debugs through test output. Once the traps were written
  down, its cost dropped 76%.
- **MCP pays for discovery every run.** Even when told about the traps,
  it checks them live, so its exploration got *longer*.
- **The [inspiring post](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html)'s
  4x–10x is reachable only when the non-browsing agent already knows the
  app.** Prompt caching also keeps the dollar gap far below the token gap
  (6.3x vs 35x).
- **Small samples mislead.** A single run said 7x, batch 1 said 1.2x and
  batch 2 said 6.3x.

Full analysis, per-run tables, cost anatomy, failure taxonomy and caveats
are in **[docs/results.md](docs/results.md)**.

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
  run directory. How an agent with unrestricted CLI access would behave
  is a separate question this project doesn't answer.
- **App-knowledge primer:** both conditions get the same "tester
  knowledge" doc ([`docs/app-knowledge/`](docs/app-knowledge/)) covering
  navigation, forms and known quirks, all observed in the running app. A
  real tester wouldn't start from zero. The primer turned out to be the
  largest single factor measured, so it's versioned and treated as an
  experimental variable. Every run records which version it used.
- **Three axes:** cost (tokens, cache, list-price USD), efficiency
  (turns, tool calls, test runs to green, wall clock) and quality (a
  7-criterion rubric, with flakiness measured by 5 re-runs).
- **Mechanism:** each phase is one `claude -p` (Claude Code,
  non-interactive) call with an explicit system prompt, tool allow-list
  and MCP config. Tokens and cost come straight from its JSON result.
  It uses a Claude Code subscription, not metered API calls.

The confirmed design decisions, with the reasoning behind them, are in
[`CLAUDE.md`](CLAUDE.md). The exact prompts are in
[`docs/run-mcp-condition.md`](docs/run-mcp-condition.md) and
[`docs/run-codegen-condition.md`](docs/run-codegen-condition.md).

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
# Full comparison: both conditions, 3 repeats, app reset before every run (~$3, ~30 min)
npm run repeat:baseline
npm run repeat:nudged                      # same, plus docs/testing-best-practices.md
npm run repeat:baseline -- --primer v1     # older app primer (default: v2)

# Single runs
npm run explore:mcp                        # prints a RUN_ID
RUN_ID=<id> npm run generate:mcp
npm run bench:codegen
```

Each run writes its spec, `metrics.json` and (for MCP) `test-plan.md` to
`results/<run-id>/`. Full transcripts go to `results/raw/`, which is
gitignored ([`results/README.md`](results/README.md)).
[`docs/run-repeats.md`](docs/run-repeats.md) covers batches in detail.

## Status and what's next

- ✅ Test **generation**: both conditions built, two baseline batches
  run and analysed.
- ⏳ **Nudged** batch (best-practice guidance added to the prompt): wired
  up, not yet run.
- 🔜 Test **healing**: change the app under a working test (one label
  change, one DOM change) and measure what it costs to fix it, and
  whether the fix keeps the test honest. We compare Playwright's own
  MCP-based healer against an agent that only has test output and
  Playwright's failure snapshot. Designed, not built yet (`CLAUDE.md`
  decision 15).

Details are in [`TODO.md`](TODO.md).

## License

[MIT](LICENSE).
