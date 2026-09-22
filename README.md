# playwright-mcp: MCP vs CLI token cost & quality benchmark

A reproducible testbed for measuring what it actually costs — in tokens,
iterations, and resulting test quality — to have an AI agent generate (and
eventually heal) Playwright end-to-end tests two different ways:

- **Playwright MCP**: the agent drives a live browser through the Model
  Context Protocol, seeing accessibility-tree snapshots and calling tools
  like `browser_navigate` / `browser_click` step by step.
- **Playwright CLI**: the agent works from a `playwright codegen` recording
  plus terse `npx playwright test` output — no live page visibility — the
  way a developer using the CLI directly would.

## Why

This project was sparked by
[this post](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html),
which claims a roughly 4x (up to 10x) token cost gap between MCP and CLI
approaches on a ~10-step task (~114K vs ~27K tokens), attributed to MCP
re-injecting the full page state — and ~13.7K tokens of tool definitions —
on every single step.

Those numbers are plausible, but the post doesn't show its work: no
methodology, no test app, no harness, no code. It cites other people's
benchmarks rather than presenting a reproducible one. This project is an
attempt to actually build that harness — openly, so the numbers (and the
assumptions behind them) can be checked, reproduced, and extended by anyone.

It's also deliberately broader than a single token-count comparison: cost
without quality is a meaningless metric for something like test generation.
An agent that produces a cheap-but-flaky test hasn't "won."

## How the comparison works

MCP and Playwright CLI don't offer symmetric capabilities, so this isn't a
same-tools-different-labels comparison — it's a comparison of two
realistic, best-practice workflows for the same task:

| | MCP condition | CLI condition |
|---|---|---|
| Starting point | Natural-language task spec only | Natural-language task spec + a checked-in `playwright codegen` recording |
| Tools available to the agent | Playwright MCP (browser control + snapshots) + file write | File read/write + shell (`npx playwright test`) — **no** live browser tools |
| How it "sees" the app | Live accessibility-tree snapshots each step | Only the raw codegen recording and terse test-run output |
| Iteration loop | Explore → act → observe → repeat, then author the test | Rewrite/clean the recording → run tests → read failure output → fix → repeat |

Both conditions get the **exact same task description**. The codegen
recording step is a deterministic, zero-LLM-token, one-time recording
(checked into `fixtures/` so nobody needs to re-record it to reproduce a
run) — it models the fact that a human CLI user would record their own
flow first, the same way an MCP-driven agent gets to look at the live page.

Every run is measured on three axes, not just token count:

1. **Cost** — exact input/output tokens from the Anthropic API's `usage`
   field on every call.
2. **Efficiency** — number of tool calls/turns, test-run iterations to
   green, wall-clock time.
3. **Quality** — a rubric on the resulting test file: selector robustness,
   assertion quality, flakiness across repeat runs, adherence to Playwright
   best practices.

v1 benchmarks a single model (Claude Sonnet) to keep the first pass simple.
Broader model coverage, to see whether the MCP/CLI gap is model-dependent,
is a deliberate later phase — see `TODO.md`.

See `CLAUDE.md` for the full set of confirmed design decisions and
`TODO.md` for what's built vs. still open.

## What gets kept

Each benchmark run produces a lot of exhaust — full agent transcripts, raw
MCP accessibility-tree dumps, Playwright screenshots/videos/traces. None of
that belongs in git. What's actually kept, per run, in `results/<run-id>/`:

- the generated test file itself (the actual deliverable of the run)
- token usage (input/output, from the API's `usage` field)
- efficiency counts (tool calls/turns, iterations-to-green, wall-clock time)
- quality rubric scores

Full raw transcripts and any Playwright run artifacts (screenshots, videos,
trace files, HTML reports) go under `results/raw/`, which is gitignored —
useful locally for debugging a specific run, never committed. See
`results/README.md`.

## Test bed

**Target app: OrangeHRM 5.9, self-hosted** via `app/docker-compose.yml`
(works with Docker or Podman — validated with `podman-compose`/Podman
during scaffolding). We initially planned to point at OrangeHRM's public
demo instance, but it turned out not to be reliably usable as a self-serve
benchmark target, so self-hosting a pinned version is the plan instead —
which is arguably better for this project anyway: no third-party uptime
dependency, no shared state polluted by other visitors, and results that
don't silently drift if the vendor changes the app. See `app/README.md`.

Why OrangeHRM: it's a long-standing, purpose-built QA/test-automation
practice app — stable, well-structured, and complex enough to be a fair
test (multi-page navigation, forms with validation, dropdowns, date
pickers, data tables) without being a sprawling real-world app that would
make "one flow" an arbitrary slice.

**Flow (v1): "Add employee, then apply and verify leave"**

1. Log in.
2. Go to PIM → Add Employee, create a new employee with a generated unique
   name/ID.
3. Go to Leave → Apply, submit a leave request for that employee covering a
   specific date range.
4. Go to Leave → My Leave / Leave List, and verify the request appears with
   the expected employee, dates, and status.

That's ~8–12 logical steps: login, multi-page navigation, form-filling with
validation, and reading back a data table to verify state — comparable in
shape to the "log in, navigate, read a table, click through" example from
the inspiring post, but concrete and scripted rather than hand-waved.

Confirmed as the v1 flow — may be adjusted as the harness comes together
and we see how it behaves in practice.

**Resetting between runs:** a full teardown + reinstall
(`podman-compose down -v && ./install.sh`) takes about **80 seconds**
end-to-end (measured during scaffolding, with images already cached
locally) — cheap enough next to an actual agent run that we just do that
between benchmark repeats, rather than snapshot/restoring the DB. Revisit
if it turns out to be a bottleneck once the harness is running many repeats.

## Status

Environment phase done: the target app (self-hosted, scripted install),
Playwright, and Playwright MCP are all automated and independently
verified working (see `docs/verify-setup.md`). The measurement harness
itself doesn't exist yet — no runs, no numbers — see `TODO.md` for the
build plan.

## Getting started

```bash
cp .env.example .env
npm install
npm run setup          # target app (Docker or Podman both work) + Playwright browser binary
npm run verify:tools   # sanity-check playwright and playwright-mcp are both runnable
```

Then walk through `docs/verify-setup.md` to manually confirm the app,
Playwright CLI, and Playwright MCP all actually work before anything is
built on top of them. `npm run cleanup:app` tears the app stack back down.

The harness itself isn't runnable end-to-end yet — see `TODO.md`. Once it
lands:

```bash
npm run bench:mcp      # run the MCP condition
npm run bench:cli      # run the CLI condition
```

## License

[MIT](LICENSE).
