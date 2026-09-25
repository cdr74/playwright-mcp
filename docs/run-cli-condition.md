# Running the CLI condition (reproducible runbook)

Every step, command, and prompt actually sent to Claude Code for the CLI
condition, in one file — the counterpart to `docs/run-mcp-condition.md`.

`harness/src/run-cli.ts` assembles the system prompt and user message
below at runtime from checked-in source files (`conditions/cli/*.md`,
`docs/app-knowledge.md`, `flows/*.md`, `fixtures/*.codegen.ts`) plus
`TARGET_APP_URL`. This doc mirrors that assembly verbatim so it's readable
in one place without tracing through code.

**If you edit any of those source files, resync the quoted blocks below in
the same commit.** This repo's standing rule (`CLAUDE.md`, "Before every
commit") already requires reviewing every `.md` file before committing —
treat this file the same way as `docs/run-mcp-condition.md`.

## 0. Prerequisites

- `claude` CLI installed and authenticated (`claude auth login`) — a Claude
  Code subscription, not an API key.
- `.env` populated from `.env.example` (defaults below assume it's untouched:
  `TARGET_APP_URL=http://localhost:8081/`, `CLAUDE_MODEL=sonnet`).
- Run every command below **from a plain terminal, not from inside a Claude
  Code session** — same `--dangerously-skip-permissions` restriction as the
  MCP condition, see `docs/run-mcp-condition.md` §0 for why.
- Unlike the MCP condition, this one also depends on a one-time, human-
  recorded fixture: `fixtures/01-add-employee-leave-request.codegen.ts`.
  It's already recorded and checked in (see `fixtures/README.md` for
  exactly how and when) — you don't need to re-record it to run this,
  only if the target app or flow changes.

## 1. Reset to a known state

```bash
npm run cleanup:app     # tear down app + volumes
npm run setup:app       # fresh OrangeHRM 5.9 install, ~80s end-to-end
npm run seed             # login + one-time Leave module setup, saves harness/.auth/state.json
```

Skip this step only if you deliberately want to run against non-fresh app
state — otherwise always reset first so runs are comparable, including
against the MCP condition's runs.

## 2. Run it

```bash
npm run bench:cli
```

What this invokes, in `claude -p --output-format json` terms:

- **Model**: `sonnet` (or `$CLAUDE_MODEL`)
- **Tools**: exactly `mcp__tools__write_file` and
  `mcp__tools__run_playwright_test` — no `playwright-mcp`, no browser tools
  of any kind, and critically Claude Code's native `Bash` is **not** in the
  allow-list (see `CLAUDE.md` decision 1, "no raw shell").
- **MCP servers**: only the scoped `tools` server
  (`harness/src/mcp-tools-server.ts`, `RUN_DIR` set to this run's output
  directory) — no `playwright-mcp` registered at all.
- **System prompt** (`conditions/cli/system-prompt.md` + target URL +
  `docs/app-knowledge.md`), verbatim as of this writing:

  ````markdown
  You are an expert QA engineer writing Playwright tests. You have:

  - A `write_file` tool scoped to this run's output directory - you cannot
    access anything else on the filesystem.
  - A `run_playwright_test` tool that runs `npx playwright test <path>` on a
    file inside this run's output directory and returns condensed pass/fail
    output.

  You do NOT have a live browser, a shell, or any other tool - you cannot see
  the running application directly. Everything you know about the page comes
  from the raw `playwright codegen` recording given below in the user
  message, plus the app knowledge also given below.

  The codegen recording is a raw, unedited click-recording: expect brittle or
  redundant selectors, hardcoded values from whatever was typed during
  recording, no meaningful assertions, and no error handling. Your job is to
  turn it into a clean, well-structured Playwright test using
  `@playwright/test`'s `test`/`expect` - not to just wrap the recording in a
  `test()` block unchanged. Generate unique values where the task requires
  re-runnability (e.g. employee name), and add real assertions for the
  outcomes the task asks you to verify.

  The browser context is already authenticated - do not write a login step,
  and do not use `test.use({ storageState: ... })` yourself, that's handled
  by the run configuration.

  Save your test with `write_file` to `tests/add-employee-leave.spec.ts`,
  then run it with `run_playwright_test`. If it fails, read the output, fix
  the test, and run it again. Stop once it passes. If after a few honest
  attempts you believe the *application* (not your test) is the actual
  problem, stop and explain why in your final message rather than looping
  forever.

  Target application base URL: http://localhost:8081/

  ## App knowledge

  [same `docs/app-knowledge.md` content as the MCP condition - see
  `docs/run-mcp-condition.md` §2 for the full text, verbatim and identical
  for both conditions]
  ````

- **User message**: the flow spec, a heading, then the fixture content
  wrapped in a fenced typescript code block, verbatim as of this writing:

  ````markdown
  ## Flow

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

  ## Raw codegen recording (starting point - clean this up, don't just wrap it)

  ```typescript
  import { test, expect } from '@playwright/test';

  test.use({
    viewport: {
      height: 1200,
      width: 1900
    }
  });

  test('test', async ({ page }) => {
    await page.goto('http://localhost:8081/web/index.php/auth/login');
    await page.getByRole('textbox', { name: 'Username' }).click();
    await page.getByRole('textbox', { name: 'Username' }).fill('Admin');
    await page.getByRole('textbox', { name: 'Username' }).press('Tab');
    await page.getByRole('textbox', { name: 'Password' }).fill('PwMcpBench#2026');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('link', { name: 'PIM' }).click();
    await page.getByRole('button', { name: ' Add' }).click();
    await page.getByRole('textbox', { name: 'First Name' }).click();
    await page.getByRole('textbox', { name: 'First Name' }).fill('Thomas');
    await page.getByRole('textbox', { name: 'First Name' }).press('Tab');
    await page.getByRole('textbox', { name: 'Middle Name' }).press('Tab');
    await page.getByRole('textbox', { name: 'Last Name' }).fill('Mueller');
    await page.getByRole('textbox', { name: 'Last Name' }).press('Tab');
    await page.getByRole('textbox').nth(4).press('Tab');
    await page.locator('.oxd-switch-input').click();
    await page.getByLabel('', { exact: true }).check();
    await page.getByRole('textbox').nth(5).click();
    await page.getByRole('textbox').nth(5).fill('ThoMu');
    await page.locator('input[type="password"]').first().click();
    await page.locator('input[type="password"]').first().fill('PwMcpBench#2026');
    await page.locator('input[type="password"]').nth(1).click();
    await page.locator('input[type="password"]').nth(1).fill('PwMcpBench#2026');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('link', { name: 'Leave' }).click();
    await page.getByRole('link', { name: 'Assign Leave' }).click();
    await page.getByRole('textbox', { name: 'Type for hints...' }).click();
    await page.getByRole('textbox', { name: 'Type for hints...' }).fill('Thom');
    await page.getByText('-- Select --').click();
    await page.getByRole('textbox', { name: 'yyyy-mm-dd' }).first().click();
    await page.getByText('22').click();
    await page.getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(1).click();
    await page.getByText('23').click();
    await page.getByText('-- Select --').click();
    await page.getByText('-- Select --').click();
    await page.getByRole('button', { name: 'Assign' }).click();
    await page.getByRole('button', { name: 'Ok' }).click();
  });
  ```
  ````

  This fixture block is fixed (checked in, not regenerated per run) unlike
  the MCP condition's test-plan half, which is genuinely different every
  run. See `fixtures/README.md` for the two documented deviations in this
  recording (a two-day date range instead of single-day, and out-of-scope
  login-detail setup) that the agent has to notice and clean up itself.

Prints a `RUN_ID` when done. Produces
`results/<run-id>/tests/add-employee-leave.spec.ts` and
`results/<run-id>/metrics.json` (single `"generate"` phase entry — see
`results/README.md`), plus
`results/raw/<run-id>/cli-transcript.jsonl`.

## What "reproducible" means here

Same caveat as the MCP condition (`docs/run-mcp-condition.md`): this doc
pins the *inputs* - prompt text, tool surface, environment, starting app
state, and the fixture - not the output. LLM generations vary run to run
even given an identical prompt; that variance is part of what this
benchmark measures, not noise to eliminate. See `CLAUDE.md`'s open
repeat-run-count decision in `TODO.md`.
