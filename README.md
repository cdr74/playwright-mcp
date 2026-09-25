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
| Starting point | Natural-language task spec + app knowledge (see below) | Natural-language task spec + app knowledge + a checked-in `playwright codegen` recording |
| Tools available to the agent | Playwright MCP (browser control + snapshots) + scoped file write + scoped test runner | File read/write + shell (`npx playwright test`) — **no** live browser tools |
| How it "sees" the app | Live accessibility-tree snapshots each step | Only the raw codegen recording and terse test-run output |
| Iteration loop | Explore live → write a test plan → author the test → run it → fix → repeat | Rewrite/clean the recording → run tests → read failure output → fix → repeat |

Both conditions get the **exact same task description**. The codegen
recording step is a deterministic, zero-LLM-token, one-time recording
(checked into `fixtures/` so nobody needs to re-record it to reproduce a
run) — it models the fact that a human CLI user would record their own
flow first, the same way an MCP-driven agent gets to look at the live page.

The MCP condition itself runs as two separate agent phases, each its own
measured phase in `metrics.json`: **explore** (browser tools + a
`write_file` tool scoped to the run's output directory - produces
`test-plan.md`, no code yet) and **generate** (same tools, plus a
`run_playwright_test` tool that runs `npx playwright test <path>` and
returns condensed pass/fail output - produces and iterates on the actual
spec file). Splitting it this way mirrors how a tester would actually
work, and keeps "did it explore effectively" and "did it turn that into a
working test" separately measurable. See `harness/src/explore-mcp.ts` /
`harness/src/generate-mcp.ts`.

### The "tester knowledge" assumption

Neither condition starts from zero. A real tester assigned to test an app
would already have a rough mental model of it - where things live, what
the modules are called - before writing a single test. Pretending an
agent should rediscover that from scratch on every run would bias the
comparison toward whichever condition happens to explore more cheaply,
which isn't the thing we're trying to measure.

So both conditions are given the same **app knowledge primer**
(`docs/app-knowledge.md`) verbatim, as part of the system prompt, in
addition to the task spec (`flows/`). It covers navigation structure,
where the relevant forms live, and known quirks/gotchas of this specific
app build - all gathered by actually exploring the running instance during
harness development, not guessed. This is also where environment-level
prerequisites the flow itself shouldn't have to deal with are documented
(see "one-time environment setup" below) - the same way a tester wouldn't
expect to have to configure basic org settings as part of testing a
specific feature.

Every run is measured on three axes, not just token count:

1. **Cost** — exact input/output/cache tokens and an implied USD figure,
   read straight off `claude -p --output-format json`'s own result for
   every call (see "Measurement mechanism" below).
2. **Efficiency** — number of tool calls/turns, test-run iterations to
   green, wall-clock time.
3. **Quality** — a rubric on the resulting test file: selector robustness,
   assertion quality, flakiness across repeat runs, adherence to Playwright
   best practices.

v1 benchmarks a single model (Claude Sonnet) to keep the first pass simple.
Broader model coverage, to see whether the MCP/CLI gap is model-dependent,
is a deliberate later phase — see `TODO.md`.

### Measurement mechanism

The harness drives **Claude Code** (`claude -p`, non-interactive) as the
agent for each phase, rather than calling the Anthropic API directly —
this was a real pivot partway through building it, not the original plan.
Reason: API usage is billed per token on top of whatever you already pay
for; Claude Code usage rides on an existing subscription, the same
reasoning as registering an MCP server in Copilot/VS Code instead of
paying per call. Before committing to the rewrite, confirmed there's no
loss of measurement precision: Claude Code's own session logs (and
`claude -p --output-format json`'s result object directly) carry the exact
same token/cache/cost data the raw API returns. See `CLAUDE.md` decision 3
for the full mechanics (how the tool surface stays scoped under Claude
Code, how permission bypass for unattended runs works, what was verified
before building on top of it).

See `CLAUDE.md` for the full set of confirmed design decisions and
`TODO.md` for what's built vs. still open.

## What gets kept

Each benchmark run produces a lot of exhaust — full agent transcripts, raw
MCP accessibility-tree dumps, Playwright screenshots/videos/traces. None of
that belongs in git. What's actually kept, per run, in `results/<run-id>/`:

- the generated test file itself (the actual deliverable of the run)
- for the MCP condition, the exploration phase's `test-plan.md`
- token/cache/cost usage (from `claude -p`'s own result)
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

**Flow (v1): "Add employee, then assign and verify leave"** — see
`flows/01-add-employee-leave-request.md` for the exact task spec given to
both conditions:

1. Create a new employee (PIM module) with a generated unique name.
2. Assign that employee a leave request via the Leave module's
   **administrative assignment** screen (not the self-service "Apply"
   screen, which only applies leave for whichever user is logged in - see
   `docs/app-knowledge.md` for why this distinction matters and tripped up
   exploration).
3. Verify the request was recorded.

That's a non-trivial multi-page, multi-module flow with real form
validation and state to verify — comparable in shape to the "log in,
navigate, read a table, click through" example from the inspiring post,
but concrete and scripted rather than hand-waved. Login itself isn't part
of the flow given to the agent - see "one-time environment setup" below.

Confirmed as the v1 flow — may be adjusted as the harness comes together
and we see how it behaves in practice.

**One-time environment setup, not part of the flow:** logging in, and a
freshly-installed OrangeHRM's Leave module being completely unusable until
an admin has defined a Leave Period and at least one Leave Type - both
one-time org configuration a real tester would expect to already be done,
not something an "add an employee, assign them leave" test should have to
set up itself. `harness/src/seed.ts` (`npm run seed`) does this once,
deterministically, outside either condition's token budget, and saves an
authenticated browser storage state both conditions start from. Full
details in `docs/app-knowledge.md`.

**Resetting between runs:** a full teardown + reinstall
(`podman-compose down -v && ./install.sh`) takes about **80 seconds**
end-to-end (measured during scaffolding, with images already cached
locally) — cheap enough next to an actual agent run that we just do that
between benchmark repeats, rather than snapshot/restoring the DB. Revisit
if it turns out to be a bottleneck once the harness is running many repeats.

## Status

Environment phase done (target app, Playwright, Playwright MCP - all
automated and verified, see `docs/verify-setup.md`). The **MCP condition**
harness is built (`npm run seed`, `npm run explore:mcp`,
`npm run generate:mcp`) and has completed one full, uninterrupted run of
both phases end to end (see `docs/run-mcp-condition.md` for the exact,
reproducible steps and `results/mcp-2026-09-25T06-32-18-639Z/metrics.json`
for the first real numbers: ~$2.00 total across both phases, 8 test-run
iterations to a stable green). Has to run from a plain terminal, not from
inside another Claude Code session (see `harness/README.md`). The **CLI
condition** harness doesn't exist yet. See `TODO.md`.

## Getting started

```bash
cp .env.example .env
npm install
npm run setup           # target app (Docker or Podman both work) + Playwright browser binary
npm run verify:tools    # sanity-check playwright and playwright-mcp are both runnable
npm run seed             # log in once, do one-time env setup, save auth state
```

No API key needed - just the `claude` CLI installed and authenticated
(`claude auth login`).

Then walk through `docs/verify-setup.md` to manually confirm the app,
Playwright CLI, and Playwright MCP all actually work. `npm run cleanup:app`
tears the app stack back down (pair with a fresh `npm run setup:app` +
`npm run seed` to get back to a clean, known state).

Run the MCP condition end to end (**from a plain terminal, not from
inside a Claude Code session** — see `harness/README.md` for why):

```bash
npm run explore:mcp     # prints a RUN_ID
RUN_ID=<id> npm run generate:mcp
```

Results land in `results/<run-id>/` (`test-plan.md`, `tests/*.spec.ts`,
`metrics.json`) and `results/raw/<run-id>/` (full transcripts). The CLI
condition (`npm run bench:cli`) isn't built yet — see `TODO.md`.

## License

[MIT](LICENSE).
