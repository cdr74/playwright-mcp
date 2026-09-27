# The testbed in detail

How the benchmark is built, how to run it, and what every file in the
repo is for. For the short version see the [README](../README.md); for the
numbers see [`results.md`](results.md).

## The test bed

- **App:** self-hosted **OrangeHRM 5.9** ([`app/`](../app/)), run with
  Docker or Podman. It's a long-standing QA practice app with multi-page
  navigation, validated forms, custom dropdowns, date pickers and tables.
  A pinned local install means no third-party uptime dependency and no
  drift between runs. (OrangeHRM's public demo was the original plan, but
  it isn't reliably usable as a benchmark target.)
- **Flow:** create an employee (PIM module), assign them leave through
  the admin **Assign Leave** screen, and verify it was recorded
  ([`flows/01-add-employee-leave-request.md`](../flows/01-add-employee-leave-request.md)).
  That's several pages and modules, with real form validation and state
  to verify.
- **Out of scope for the agent:** logging in, and the one-time Leave
  module setup a fresh install needs (a leave period and a leave type).
  [`harness/src/seed.ts`](../harness/src/seed.ts) does both
  deterministically before every run and saves an authenticated browser
  state that the agents and the generated tests start from.
- **Reset:** a full reinstall (about 80 seconds) before *every* run, so
  repeats are independent: no data left over from earlier runs.
- **Model:** one model, pinned to `claude-sonnet-5`.

## Why "Codegen" and not "CLI"

The post that started this project compares MCP with "the CLI". Our
non-MCP generation condition is called **Codegen** because that's what
it actually is: a human runs `playwright codegen` once, up front (zero
LLM tokens), and the agent turns that recording into a test. The agent
never gets a real command line, only a tool that runs `npx playwright
test` inside its run directory, so it can't browse, inspect or script
anything outside a test. (The tests it writes are Node.js code, though,
and can do anything a test can.)

That's also different from Microsoft's
[Playwright CLI](https://github.com/microsoft/playwright-cli), a
browser-driving command line for coding agents, which is very likely
what the post means by "CLI". How an agent with such a CLI, or with
unrestricted shell access, would do is a separate question this project
doesn't answer.

## How a run is measured

Each agent phase is one call of **Claude Code** in non-interactive mode
(`claude -p`), from [`harness/src/lib/claude-runner.ts`](../harness/src/lib/claude-runner.ts):

- **Prompt:** an explicit system prompt (the phase's prompt + the app
  notes + the app's URL) replaces Claude Code's own. The process runs
  from a directory outside this repo, so Claude Code doesn't also attach
  this repo's `CLAUDE.md` and memory to the agent.
- **Tools:** no built-in Claude Code tools (no shell, no unscoped file
  writes). Everything the agent can do comes from MCP servers: Playwright
  MCP or Playwright's test server where a condition has them, plus our own
  small server ([`harness/src/mcp-tools-server.ts`](../harness/src/mcp-tools-server.ts))
  with file and test-run tools that can only touch the run's own
  directory. The tests an agent writes are ordinary Node.js code,
  though, and can do anything a test can.
- **Numbers:** tokens (input, output, cache writes and reads), a
  list-price cost, turns and duration come straight from Claude Code's
  JSON result; tool calls are counted from the session transcript. It
  runs on a Claude Code subscription, not metered API calls; the cost
  figure is what the same tokens would cost at list price.
- **Quality** is scored afterwards, by hand, with the rubrics in
  [`quality-rubric.md`](quality-rubric.md) and
  [`heal-rubric.md`](heal-rubric.md). Flakiness is measured, not judged:
  each spec runs 5 times from a fresh reset.

Every design decision, with its reasoning, is recorded in
[`CLAUDE.md`](../CLAUDE.md).

## Setup

Requires Node.js, Docker or Podman, and the
[`claude`](https://claude.com/claude-code) CLI, installed and
authenticated (no API key needed).

```bash
cp .env.example .env
npm install
npm run setup           # installs and starts the app, and the Playwright browser
npm run verify:tools    # smoke-checks playwright and playwright-mcp
```

[`verify-setup.md`](verify-setup.md) walks through checking the setup by
hand.

## Running it

**Run the benchmark from a plain terminal, not from inside a Claude Code
session.** The harness starts `claude -p` sessions with permission
prompts turned off, and Claude Code blocks that from inside another
session ([`harness/README.md`](../harness/README.md)).

```bash
# Test generation: both conditions, 3 repeats, app reset before every run (~$3, ~45 min)
npm run repeat:baseline
npm run repeat:nudged                          # the same, plus best-practices guidance
npm run repeat:baseline -- --primer v2         # with an earlier app-notes version (default v3)

# Test healing
npm run survival                               # which generated specs each app update breaks (no LLM)
npm run repeat:heal                            # 2 app updates x 2 conditions x 3 repeats

# Single runs
npm run explore:mcp                            # prints a RUN_ID
RUN_ID=<id> npm run generate:mcp
npm run bench:codegen
HEAL_BREAK=dom-select npm run heal:mcp         # or heal:artifacts
```

Each run writes its test, `metrics.json` (and for MCP generation
`test-plan.md`, for healing `heal.diff`) to `results/<run-id>/`. Full
transcripts go to `results/raw/`, which is gitignored
([`results/README.md`](../results/README.md)). Batch scripts log their
run IDs to `results/*-run-log-<timestamp>.txt`.

The runbooks pin every command and the exact prompts:
[`run-mcp-condition.md`](run-mcp-condition.md),
[`run-codegen-condition.md`](run-codegen-condition.md),
[`run-repeats.md`](run-repeats.md) and [`run-heal.md`](run-heal.md).

## What each file is for

### Top level

| File | Purpose |
|---|---|
| `README.md` | Overview: what's measured, what's been tested, the numbers, references |
| `CLAUDE.md` | Every confirmed design decision with its reasoning, plus guidance for Claude Code sessions working on this repo |
| `TODO.md` | What's open (at the top), then the full build history, including the pitfalls hit along the way |
| `package.json` | Dependencies (Playwright versions pinned exactly, see `CLAUDE.md`) and every `npm run` command |
| `playwright.config.ts` | Config the generated tests run with: base URL and the saved login from the seed step |
| `.env.example` | Settings to copy into `.env`: model, app URL, app credentials, optional overrides |

### `app/` — the target app

| File | Purpose |
|---|---|
| `docker-compose.yml`, `install.sh`, `cli_install_config.yaml` | Start OrangeHRM 5.9 + MariaDB and install it non-interactively, byte-for-byte reproducible |
| `cleanup.sh` | Tear the app and its data down (the reset between runs) |
| `break.sh` | Apply one "app update" for the healing study: two label changes, two CSS-class renames |
| `README.md` | How the install works and its pitfalls |

### Inputs the agents get

| File | Purpose |
|---|---|
| `flows/01-add-employee-leave-request.md` | The task, given word for word to both generation conditions |
| `docs/app-knowledge/v1.md`, `v2.md`, `v3.md` | App notes ("primer"), versioned. v3 is the current baseline; v1/v2 were development versions |
| `docs/testing-best-practices/v1.md`, `v2.md` | Best-practices guidance for nudged runs, versioned. v2 is the current default |
| `conditions/mcp/explore-prompt.md`, `generate-prompt.md` | The MCP generation condition's two phase prompts |
| `conditions/codegen/system-prompt.md` | The Codegen condition's prompt |
| `conditions/heal/artifacts-prompt.md` | The non-MCP healer's prompt (Playwright's healer text, steps 1–3 adapted). The MCP healer's prompt is read from Playwright itself |
| `fixtures/01-add-employee-leave-request.codegen.ts` | The human `playwright codegen` recording the Codegen condition starts from |
| `fixtures/heal/add-employee-leave.spec.ts` | The known-good test the healing study breaks |

### `harness/` — runs the agents and measures them

| File | Purpose |
|---|---|
| `src/explore-mcp.ts`, `src/generate-mcp.ts` | MCP generation condition, phase 1 (explore, writes a test plan) and phase 2 (write and run the test) |
| `src/run-codegen.ts` | Codegen generation condition (one phase) |
| `src/heal.ts` | One healing run, either condition: applies the app update, checks the test fails, lets the agent fix it, saves the diff |
| `src/seed.ts` | Login and one-time app setup before every run |
| `src/mcp-tools-server.ts` | Our MCP server: file and test-run tools, limited to the run's directory |
| `src/lib/claude-runner.ts` | Starts one `claude -p` phase and collects its numbers |
| `src/lib/metrics.ts`, `run-id.ts` | Writes `metrics.json`; names runs |
| `src/lib/primer.ts`, `nudge.ts` | Load the chosen app-notes and best-practices versions |
| `src/lib/isolated-session.ts` | Runs Claude Code from outside the repo, so it doesn't attach this repo's `CLAUDE.md` |
| `run-repeats.sh`, `run-heal-repeats.sh` | Batch runners: N repeats with an app reset before every run |
| `survival-check.sh` | Runs existing tests against each app update, no LLM involved |

### Scoring, results, runbooks

| File | Purpose |
|---|---|
| `docs/results.md` | **The results**: all numbers, per run and per condition, with caveats |
| `docs/quality-rubric.md` | 7-criterion quality score for a generated test (/28) |
| `docs/heal-rubric.md` | 5-criterion integrity score for a healed test (/20): is it still the same test? |
| `docs/test-bed-evolution.md` | Development history: earlier runs and what each one taught us. Not headline results |
| `docs/run-*.md` | Runbooks: every command and the exact prompts, per condition and for batches |
| `docs/verify-setup.md` | Manual walkthrough to check the setup |
| `results/<run-id>/` | Per run: the test the agent produced, `metrics.json`, and `test-plan.md` or `heal.diff` |
| `results/*-run-log-*.txt`, `results/survival-*.txt` | Which runs belong to which batch; survival-check results |
| `results/raw/` (gitignored) | Full transcripts and Playwright artifacts, local only |
