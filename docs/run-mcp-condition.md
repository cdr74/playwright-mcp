# Running the MCP condition (reproducible runbook)

Every step, command, and prompt actually sent to Claude Code for the MCP
condition, in one file, so two different people — or the same person weeks
apart — running the same flow get directly comparable results. See
`docs/run-codegen-condition.md` for the Codegen condition's counterpart, and
`docs/results.md` for the numbers.

`harness/src/explore-mcp.ts` / `generate-mcp.ts` assemble the system prompts
below at runtime from checked-in source files (`conditions/mcp/*.md`,
the app-knowledge primer `docs/app-knowledge/<PRIMER>.md`, `flows/*.md`)
plus `TARGET_APP_URL`. This doc
mirrors that assembly verbatim so it's readable in one place without tracing
through code.

**If you edit any of those source files, resync the quoted blocks below in
the same commit.** This repo's standing rule (`CLAUDE.md`, "Before every
commit") already requires reviewing every `.md` file before committing —
treat this file as one of the ones that rule protects, since it's now the
one place a stale copy would actually mislead someone.

## 0. Prerequisites

- `claude` CLI installed and authenticated (`claude auth login`) — a Claude
  Code subscription, not an API key.
- `.env` populated from `.env.example` (defaults below assume it's untouched:
  `TARGET_APP_URL=http://localhost:8081/`, `CLAUDE_MODEL=claude-sonnet-5`).
- Run every command below **from a plain terminal, not from inside a Claude
  Code session** — `--dangerously-skip-permissions` is required for
  unattended tool use, and a Claude Code session's own auto-mode classifier
  blocks it from spawning a nested permission-bypassed session (confirmed
  during harness development, see `TODO.md` Gotchas / `harness/README.md`).

## 1. Reset to a known state

```bash
npm run cleanup:app     # tear down app + volumes
npm run setup:app       # fresh OrangeHRM 5.9 install, ~80s end-to-end
```

No separate seed step needed here - `explore:mcp` and `generate:mcp` each
run it themselves as their first move (login + one-time Leave module
setup, saves `harness/.auth/state.json`), since the saved session can
expire between runs and there's no reason to make freshness the
operator's problem (see `TODO.md` Gotchas). `npm run seed` is still
available standalone if you want to warm that state without spinning up
Claude Code.

Skip the reset above only if you deliberately want to run against
non-fresh app state (e.g. re-running `generate:mcp` against an existing
`RUN_ID` after fixing a harness bug) — otherwise always reset first so
runs are comparable.

## 2. Phase 1 — explore

```bash
npm run explore:mcp
```

First move, before anything else: re-runs the seed logic (login + Leave
Period/Type check, overwrites `harness/.auth/state.json`) — always, not
conditionally, since checking staleness is more code than just refreshing
unconditionally. This is zero-LLM-token setup, same as a standalone
`npm run seed` (see `CLAUDE.md` decision 11) — it doesn't count toward
this phase's measured cost/turns.

Then, what this invokes in `claude -p --output-format json` terms:

- **Model**: `claude-sonnet-5` (or `$CLAUDE_MODEL`), an exact id rather
  than the `sonnet` alias; the id the API actually served is recorded as
  `resolvedModels` in `metrics.json`
- **Tools**: playwright-mcp's **full toolset** (~25 browser tools,
  including `browser_evaluate` / `browser_run_code_unsafe`) plus the
  scoped `tools` server's `write_file` (and, technically,
  `run_playwright_test` — every tool of every registered MCP server is
  offered; explore agents haven't used it). By decision: `CLAUDE.md`
  decision 13. `--tools` is passed only `mcp__tools__write_file`, which
  matters for one reason: it names no built-in tools, so `Bash`, `Write`
  etc. are excluded. It does not filter MCP tools at all (`CLAUDE.md`
  decision 3).
- **Process `cwd`**: a scratch directory outside this repo entirely
  (`os.tmpdir()/playwright-mcp-bench/<run-id>`, via
  `harness/src/lib/isolated-session.ts`), not the repo root - Claude Code
  auto-attaches this repo's own `CLAUDE.md` and auto-memory files to
  every session regardless of `--system-prompt`, confirmed empirically,
  and an external cwd is what actually stops it without also breaking
  `--mcp-config` (see "Gotchas" below and `TODO.md`).
- **MCP servers**: `playwright-mcp` (absolute path into this repo's
  `node_modules/.bin/`, not `npx` - the relocated cwd can't resolve that
  via its own node_modules walk; `--browser chromium --headless
  --isolated --storage-state harness/.auth/state.json --output-dir
  results/raw/<run-id>/playwright-mcp`, so its own accessibility-snapshot
  and console-log dumps land under `results/raw/` instead of the repo
  root — see "Gotchas" below) + the scoped `tools` server
  (`harness/src/mcp-tools-server.ts`, also an absolute path, `RUN_DIR`
  set to this run's output directory)
- **System prompt** (`conditions/mcp/explore-prompt.md` + target URL +
  the app-knowledge primer), verbatim as of this writing, **with the
  default primer `v3`** (`docs/app-knowledge/v3.md`). With `PRIMER=v1`
  or `v2` the `## App knowledge` block is that file instead;
  everything else is identical. The primer is an explicit experimental
  variable (`CLAUDE.md` decision 14) and is recorded per run as
  `primerVersion`:

  ````markdown
  You are an expert QA engineer. You have live browser control tools
  (Playwright MCP) for the application, plus a `write_file` tool scoped to
  this run's output directory - you cannot access anything else on the
  filesystem.

  Your job in this phase is NOT to write test code yet. Use the browser
  tools to actually navigate the app and confirm the flow described by the
  user works the way you expect. Only claim a selector, label, or URL if you
  actually observed it in a snapshot - don't guess ahead of what you've seen.

  When you're confident you understand the flow end to end, call `write_file`
  to save a test plan to `test-plan.md`. The plan should be a numbered list
  of concrete steps (navigate / fill / click / assert), each naming the real
  selector or accessible name you'd use, ending with exactly how you'd verify
  success. Plain language, not Playwright code.

  Then stop. Do not write any test code in this phase.

  Target application base URL: http://localhost:8081/

  ## App knowledge

  # OrangeHRM test environment: notes

  Our test instance runs OrangeHRM 5.9 (open source). You're logged in as
  the admin user. Basic org setup is already done: a leave period exists and
  there's one leave type, "Annual Leave".

  ## Finding your way around

  The left sidebar lists the modules. Employees live in **PIM**, and leave
  management in **Leave**, which has its own menu across the top. It's a
  single-page app, so content renders after navigation: wait for it rather
  than assuming it's there straight away.

  Dropdowns are custom widgets, not native `<select>` elements. Employee
  fields are autocompletes: type part of the name, then pick a suggestion.

  ## Things that trip people up

  - **Assigning leave to someone else is Leave → Assign Leave.** "Apply"
    only files leave for yourself, the logged-in user.
  - **Weekends aren't working days.** A request covering only a Saturday or
    Sunday is rejected ("No Working Days Selected"). Use a weekday.
  - **New employees have no leave balance.** Assigning leave still works,
    but you first get a confirmation dialog about insufficient balance that
    you have to OK.
  - **The date fields are fiddly.** Setting the value directly often isn't
    picked up. Typing the date in (`yyyy-mm-dd`) works.
  - **Leave List search is unreliable on this build.** A request that was
    saved sometimes doesn't show up. The "Successfully Saved" message after
    assigning is the reliable signal.
  ````

- **User message** (`flows/01-add-employee-leave-request.md`), verbatim:

  ````markdown
  Write a single Playwright test for OrangeHRM that does the following:

  1. Create a new employee via the PIM module. Use a unique, generated first
     and last name so the test can be re-run without colliding with existing
     data.
  2. Assign that employee a leave request (any available leave type, any
     single-day date in the future) via the Leave module's administrative
     assignment flow.
  3. Verify the leave request was recorded successfully.

  Save the finished test as `tests/add-employee-leave.spec.ts`, relative to
  your output directory. It should use `@playwright/test`'s `test`/`expect`.
  The browser context is already authenticated against the app - do not
  write a login step.
  ````

Prints a `RUN_ID` when done. Produces `results/<run-id>/test-plan.md`.

## 3. Phase 2 — generate

```bash
RUN_ID=<id-from-step-2> npm run generate:mcp
```

Also re-seeds first, same as phase 1 - there's no guarantee this runs
right after `explore:mcp`, so it can't assume that phase's fresh session
is still fresh. Otherwise: same model, MCP servers, and browser tools as
phase 1, plus `mcp__tools__run_playwright_test`.

- **System prompt** (`conditions/mcp/generate-prompt.md` + target URL +
  the app-knowledge primer — the app-knowledge block is identical to phase
  1's, only the lead-in differs), verbatim as of this writing:

  ````markdown
  You are an expert QA engineer writing Playwright tests. You have:

  - A `write_file` tool scoped to this run's output directory - you cannot
    access anything else on the filesystem.
  - A `run_playwright_test` tool that runs `npx playwright test <path>` on a
    file inside this run's output directory and returns condensed pass/fail
    output.
  - Live browser control tools (Playwright MCP) for the application, in case
    you need to double-check something while debugging a failure.

  You've already produced a test plan during exploration (given below in the
  user message). Turn it into a real, runnable Playwright test using
  `@playwright/test`'s `test`/`expect`. The browser context is already
  authenticated - do not write a login step, and do not use
  `test.use({ storageState: ... })` yourself, that's handled by the run
  configuration.

  Save it with `write_file` to `tests/add-employee-leave.spec.ts`, then run
  it with `run_playwright_test`. If it fails, read the output, fix the test,
  and run it again. Stop once it passes. If after a few honest attempts you
  believe the *application* (not your test) is the actual problem, stop and
  explain why in your final message rather than looping forever.

  Target application base URL: http://localhost:8081/

  ## App knowledge

  [same app-knowledge primer content as phase 1 above]
  ````

  **Nudged variant** (`explore:mcp:nudged` then `generate:mcp:nudged` /
  `NUDGE_QUALITY=1`): this phase only (explore never gets it) appends
  `\n\n## Testing best practices\n\n` and
  `docs/testing-best-practices.md` verbatim after the app knowledge. The
  explore phase still needs the flag to mint an `mcp-nudged-` `RUN_ID`;
  `generate-mcp.ts` warns if the prefix and flag disagree.

- **User message**, assembled as:

  ```
  ## Flow

  <flows/01-add-employee-leave-request.md verbatim, same as phase 1's user message>

  ## Test plan (from exploration)

  <results/<run-id>/test-plan.md produced by phase 1>
  ```

  The test plan half is different on every run by design — it's phase 1's
  actual output, not a fixed input. That's why this doc can pin everything
  else but not that block verbatim.

Produces `results/<run-id>/tests/add-employee-leave.spec.ts`,
`results/<run-id>/metrics.json`, and
`results/raw/<run-id>/{explore,generate}-transcript.jsonl`.

## Gotchas confirmed on the first real run

- **`playwright-mcp` writes its own output files (accessibility snapshots,
  console logs referenced from tool results) relative to its cwd by
  default** — without `--output-dir`, that's the repo root, not
  `results/raw/<run-id>/`, and it's not gitignored either. The first real
  run left a stray, untracked `.playwright-mcp/` directory (55 files) at
  the repo root before this was caught and fixed by passing `--output-dir
  results/raw/<run-id>/playwright-mcp` (now in `explore-mcp.ts` /
  `generate-mcp.ts`). If you're on an older checkout without this fix,
  check for a stray `.playwright-mcp/` after a run.
- **Claude Code auto-attaches this repo's `CLAUDE.md` and auto-memory
  files to every session regardless of `--system-prompt`.** Found by
  actually inspecting the raw transcripts, not assumed - the original N=1
  pair (`docs/test-bed-evolution.md` appendix) was affected; every batch run since
  is clean. Fixed by
  running `claude -p` from a `cwd` outside this repo (see "Process `cwd`"
  above); `--bare`/`--safe-mode` were tested and ruled out first (API-key
  billing, silently broken `--mcp-config`, respectively). Full
  investigation in `TODO.md` Gotchas.

## What "reproducible" means here

This doc pins the *inputs*: prompt text, tool surface, environment, and
starting app state (via the reset in step 1). It does not pin the *output* —
LLM generations aren't perfectly deterministic even given an identical
prompt, and that variance (across repeat runs) is itself one of the things
this benchmark measures, not noise to eliminate — which is why results
come from 3-repeat batches (`CLAUDE.md` decision 12, `docs/run-repeats.md`).
