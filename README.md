# playwright-mcp: MCP vs Codegen token cost & quality benchmark

A reproducible testbed for measuring what it actually costs — in tokens,
iterations, and resulting test quality — to have an AI agent generate (and
eventually heal) Playwright end-to-end tests two different ways:

- **Playwright MCP**: the agent drives a live browser through the Model
  Context Protocol, seeing accessibility-tree snapshots and calling tools
  like `browser_navigate` / `browser_click` step by step.
- **Codegen flow**: the agent works from a `playwright codegen` recording
  plus terse `npx playwright test` output — no live page visibility —
  cleaning up and extending a human's own CLI recording, not driving a
  live browser step by step itself. (Called the "Codegen" condition
  throughout, not "CLI" — see "How the comparison works" for why.)

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

| | MCP condition | Codegen condition |
|---|---|---|
| Starting point | Natural-language task spec + app knowledge (see below) | Natural-language task spec + app knowledge + a checked-in `playwright codegen` recording |
| Tools available to the agent | Playwright MCP (browser control + snapshots) + scoped file write + scoped test runner | Scoped file write + a scoped test-runner tool that wraps `npx playwright test` — **no** raw shell, **no** live browser tools (see `CLAUDE.md` decision 1) |
| How it "sees" the app | Live accessibility-tree snapshots each step | Only the raw codegen recording and terse test-run output |
| Iteration loop | Explore live → write a test plan → author the test → run it → fix → repeat | Rewrite/clean the recording → run tests → read failure output → fix → repeat |

We call this the **Codegen condition**, not "CLI" — despite the name, the
agent itself never gets a real command line. A human runs
`playwright codegen` once, up front, to produce the raw recording
(deterministic, zero LLM tokens); from there the agent only gets a
scoped `run_playwright_test` tool, not actual shell access to `npx`. This
project doesn't currently test what an agent with genuine, unscoped CLI
access would do differently - that's a real, separate question, not
answered here.

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
Broader model coverage, to see whether the MCP/Codegen gap is model-dependent,
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
automated and verified, see `docs/verify-setup.md`). Both the **MCP
condition** (`npm run explore:mcp`, `npm run generate:mcp`) and the
**Codegen condition** (`npm run bench:codegen`) harnesses are built, and
the first 3-repeat baseline batch has been run and analysed - see
"Results" below and `docs/results.md`. `docs/run-mcp-condition.md` /
`docs/run-codegen-condition.md` / `docs/run-repeats.md` have the exact,
reproducible steps. Everything has to run from a plain terminal, not from
inside another Claude Code session (see `harness/README.md`). Two baseline
batches are done (primer v1 and v2); next up is the nudged variant — see
`TODO.md`.

## Results

Two 3-repeat baseline batches (`npm run repeat:baseline`, model
`sonnet`), identical except for the **app-knowledge primer** both
conditions get: batch 1 used primer v1, batch 2 primer v2 (v1 plus three
short paragraphs on app traps every batch-1 run hit). **Full analysis in
`docs/results.md`.**

| Means per run | MCP, v1 | Codegen, v1 | MCP, v2 | Codegen, v2 |
|---|---|---|---|---|
| Cost | $0.71 | ≥$0.62* | $0.91 | **$0.15** |
| Turns | 60 | ≥23* | 73 | **5.7** |
| Test runs to green | 3.0 | ~11* | 2.3 | 2.3 |
| Wall clock | 4.1 min | ≥8.8 min* | 4.9 min | **2.0 min** |
| **MCP : Codegen cost** | **1.16x** | | **6.3x** | |
| Quality (`docs/quality-rubric.md`, /28) | 21.7 | 24.0 (finished runs) | 23.3 | **26.3** |
| Measured reliability (5 re-runs each) | 3 of 3 specs 5/5 | 2 of 2 finished specs 5/5 | 3 of 3 specs 5/5 | 3 of 3 specs 5/5 |

`*` one batch-1 Codegen run was cut off by a since-fixed timeout; lower
bounds.

What we learned:

- **What the agent knows about the app matters more than its tooling.**
  Adding three paragraphs to the primer moved the MCP:Codegen cost ratio
  from ~1.2x to ~6.3x and flipped which condition is faster.
- **Codegen's cost is the price of not knowing the app.** Blind to the
  page, it debugs through terse test output. In batch 1 most of its 29
  failures traced to three app traps. Once they were documented, it had
  4 failures and cost dropped 76%.
- **MCP pays for discovery every run.** Told about the traps, it
  verifies them live anyway: exploration got *longer*. What it buys is a
  generate phase that often passes first try.
- **So the [inspiring
  post](https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html)'s
  4x–10x is reachable, but only when the non-browsing agent already
  knows the app.** Without that, the gap nearly disappears. Prompt
  caching also keeps the dollar gap much smaller than the token gap
  (6.3x vs 35x).
- **The two conditions spend money differently in both batches.** MCP:
  many cheap turns, ~80% of cost is re-read context. Codegen: few
  expensive turns, ~55% output, because every fix rewrites the whole
  file.
- **Quality is high in both, and got better with the primer.** Every
  spec from a finished run passes 5/5 on re-run (11 of 11 across both
  batches), and under v2 every spec generates unique names and picks a
  weekday. Codegen scores ~3 points higher in batch 2 (26.3 vs 23.3 /28),
  entirely because it respects `baseURL` and leans on the recording's
  role-based locators, where MCP hardcodes the URL and uses CSS
  selectors.
- **Small samples mislead.** The first single-run pair said 7x, batch 1
  said ~1.2x, batch 2 says 6.3x. The first reversal was run-to-run
  variance; the second was the primer change.

<details>
<summary>Original N=1 pair (superseded — kept for the record)</summary>

| | MCP | Codegen | Ratio |
|---|---|---|---|
| Cost (list-price, cache-discounted) | $2.00 | $0.28 | ~7.0x |
| Total tokens (incl. cache reads) | 5.63M | 196K | ~28.7x |
| Turns | 135 | 9 | ~15x |
| Test-run iterations to green | 8 | 4 | ~2x |
| Wall clock | ~9.8 min | ~4.1 min | ~2.4x |
| Quality /28 | 24 | 22 | |

Run before the CLAUDE.md-contamination fix and without repeats; see the
appendix of `docs/results.md`.

</details>

## Getting started

```bash
cp .env.example .env
npm install
npm run setup           # target app (Docker or Podman both work) + Playwright browser binary
npm run verify:tools    # sanity-check playwright and playwright-mcp are both runnable
```

No API key needed - just the `claude` CLI installed and authenticated
(`claude auth login`).

Then walk through `docs/verify-setup.md` to manually confirm the app,
Playwright CLI, and Playwright MCP all actually work. `npm run cleanup:app`
tears the app stack back down (pair with a fresh `npm run setup:app` to
get back to a clean, known state).

Run the MCP condition end to end (**from a plain terminal, not from
inside a Claude Code session** — see `harness/README.md` for why):

```bash
npm run explore:mcp     # prints a RUN_ID
RUN_ID=<id> npm run generate:mcp
```

Results land in `results/<run-id>/` (`test-plan.md`, `tests/*.spec.ts`,
`metrics.json`) and `results/raw/<run-id>/` (full transcripts). The
Codegen condition is ready to run the same way:

```bash
npm run bench:codegen        # prints a RUN_ID
```

Neither command needs a separate login step first - both refresh the
authenticated session and one-time Leave module setup themselves as their
first move (`npm run seed`, still available standalone if you want to warm
that state without spinning up Claude Code - see `harness/README.md`).

### Reproducing the full comparison (both conditions, 3 repeats)

The commands above are for a single one-off run of one condition. To
actually reproduce the N=3-per-condition dataset this project's numbers
are supposed to rest on (**from a plain terminal**, same restriction as
above):

```bash
npm run repeat:baseline   # both conditions, 3 repeats each, resets the app before every run
npm run repeat:nudged     # same, with docs/testing-best-practices.md's guidance appended
```

See `docs/run-repeats.md` for what this actually does (a full app reset
before *every individual run*, not just once per batch - that distinction
is what caught the Codegen condition's first flakiness bug, see
"Quality" above), cost/time expectations (~$7, ~50 min for a baseline
batch), and where the `RUN_ID`s get logged.

## License

[MIT](LICENSE).
