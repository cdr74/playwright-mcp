# TODO

Tracking for the MCP-vs-CLI token/quality benchmark. Phased roughly in build
order. Items marked **[DECISION]** need explicit user sign-off before work
starts on them, per `CLAUDE.md`.

## Open decisions (unblock these first)

- [x] **[DECISION]** Target app: **self-hosted OrangeHRM 5.9** via
      `app/docker-compose.yml` (works with Docker or Podman). The public
      demo (`opensource-demo.orangehrmlive.com`) was the original v1 plan
      but turned out not to be reliably reachable as a self-serve instance;
      self-hosting a pinned version was validated instead (confirmed
      working with `podman-compose`/Podman 5.7.0, rootless). Alternatives
      considered and rejected: Sauce Demo / Automation Exercise (too simple
      / likely heavily memorized by models from training data, which would
      unfairly help the blind/CLI condition).
- [x] Full install, scripted: `app/install.sh` + checked-in
      `app/cli_install_config.yaml` drive OrangeHRM's non-interactive CLI
      installer (`installer/cli_install.php`) — no manual web wizard
      needed. Validated end-to-end from a completely clean volume state
      (`down -v` then `install.sh`), including a real scripted login
      (`POST /web/index.php/auth/validate` → `302` to `/dashboard/index`)
      to prove the install actually works, plus a re-run to confirm the
      idempotent skip-if-already-installed path. Credentials: `Admin` /
      `PwMcpBench#2026`, in `.env.example`. One gotcha hit and fixed along
      the way: MariaDB's entrypoint starts a *temporary* server for
      first-run init before the real one — "ready for connections" appears
      twice in its logs — and naively waiting for just the first occurrence
      (or one successful ping) races it and intermittently breaks the
      install mid-migration.
- [x] **[DECISION]** Flow: "add employee → assign leave → verify" confirmed
      as the v1 flow (corrected from an earlier "Apply Leave" description —
      that screen is self-service only, doesn't fit "assign leave to a
      newly created employee"; the right screen is the admin "Assign
      Leave" flow, see `docs/app-knowledge.md`) — may still be adjusted as
      the harness comes together, that's expected iteration and doesn't
      need re-confirming.
- [x] **[DECISION]** Reset strategy between benchmark repeats: **full
      reinstall** (`podman-compose down -v && ./app/install.sh`), not DB
      snapshot/restore — measured at ~80s end-to-end (images cached
      locally), cheap enough next to an actual agent run. Revisit only if
      it turns out to be a real bottleneck once running many repeats.
- [x] **[DECISION]** Model: **v1 uses a single model, Claude Sonnet.**
      Broader model coverage is a deliberate later phase, not forgotten.
- [x] **[DECISION]** License: **MIT** (`LICENSE` added). Copyright holder
      currently set to the `cdr74` GitHub handle as a placeholder.
- [x] **[DECISION]** What results get committed vs. gitignored: per run,
      `results/<run-id>/` (generated test file + `metrics.json`: tokens,
      efficiency counts, quality scores) is committed-eligible;
      `results/raw/` (full transcripts incl. raw MCP snapshots, Playwright
      screenshots/videos/traces/HTML reports) is gitignored, local-only.
      See `results/README.md`.
- [ ] **[DECISION]** How many repeat runs per condition for statistical
      noise (token counts and agent behavior aren't perfectly
      deterministic even at temperature 0) — still open. Deliberately
      deferred again after the first real MCP run (~$2, ~10 min, see
      "Run a complete MCP condition end to end" below): decided to wait
      until the CLI condition runner exists too, so the repeat count is
      set for both conditions symmetrically rather than for MCP alone.
- [x] **[DECISION]** Measurement mechanism: **Claude Code (`claude -p`),
      not the Anthropic API directly** — pivoted after the harness was
      already built and working against the raw API, because API usage is
      metered/billed separately while Claude Code usage rides on an
      existing subscription (same reasoning as registering an MCP server
      in Copilot/VS Code instead of paying per token). Confirmed no loss
      of measurement precision first (see Gotchas below) before commiting
      to the rewrite. Both conditions go through Claude Code, for
      symmetry (the alternative — CLI condition direct-API, MCP condition
      via Claude Code — would compare two different mechanisms, not just
      two different tool surfaces). See `CLAUDE.md` decision 3.

## Phase 1 — Scaffolding (this delivery)

- [x] `CLAUDE.md`, `README.md`, `TODO.md`
- [x] Folder skeleton: `conditions/`, `flows/`, `fixtures/`, `harness/`,
      `results/`, `docs/`, `app/`
- [x] `git init`
- [x] `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`
- [x] `app/docker-compose.yml` + `app/install.sh` + `app/cli_install_config.yaml`
      — self-hosted OrangeHRM 5.9, validated fully installed and
      login-verified end-to-end with Podman, from a clean state
- [x] `app/cleanup.sh` — tears down containers + volumes (`--images` flag
      to also drop pulled images), validated: app stops responding after
      cleanup, `install.sh` brings it back cleanly.
- [x] Tool install automated: `npm install` (deps bumped off the initial
      guessed versions to current ones — this also fixed a real high-severity
      DNS-rebinding vuln in `@playwright/mcp` <0.0.40, see
      [GHSA-6fg3-hvw7-2fwq](https://github.com/advisories/GHSA-6fg3-hvw7-2fwq),
      by pinning `^0.0.82`) + `npm run setup:tools` (downloads the Chromium
      browser binary). `npm run verify:tools` smoke-checks both `playwright`
      and `playwright-mcp` binaries resolve and run. `playwright-mcp` was
      further checked by actually starting it in headless HTTP mode
      (`--port`) and confirming it binds and prints its client-config
      banner.
- [x] `docs/verify-setup.md` — manual walkthrough for the user to
      independently confirm the app, Playwright CLI (incl. `codegen`), and
      Playwright MCP all actually work, before anything is built on top.

## Phase 2 — Test bed setup

- [ ] **[DECISION]** Repeat-run count (only open decision left, see above).
- [x] `flows/01-add-employee-leave-request.md`: the exact natural-language
      task spec given verbatim to both conditions.
- [x] `docs/app-knowledge.md`: the shared "tester knowledge" primer fed to
      both conditions (navigation structure, exact fields/selectors for
      Add Employee and Assign Leave, the Leave List quirk, why environment
      prerequisites aren't part of the flow) — gathered by actually
      exploring the running app with a throwaway Playwright script, not
      guessed. See `CLAUDE.md` decision 10.
- [x] `harness/src/seed.ts` (`npm run seed`): login + one-time Leave
      Period/Leave Type setup + saves `harness/.auth/state.json`. Live-
      validated against a freshly-installed instance (idempotent leave-
      type check confirmed both "already exists" and "created" paths).
- [ ] **Record the CLI condition's codegen fixture** — the one thing
      currently blocking `npm run bench:cli` from actually running. Needs
      a human driving a real headed browser (`npx playwright codegen`),
      so it can't be done from an automated/sandboxed session. Exact
      steps and the metadata to fill in afterward are in
      `fixtures/README.md`.

## Phase 3 — Harness

**v1 (direct Anthropic API), built and validated, then retired:**
`harness/src/lib/agent-loop.ts` (generic tool-use loop) + `mcp-client.ts`
(bridged `playwright-mcp` via `@modelcontextprotocol/sdk`'s stdio
*client*) + `fs-tools.ts`/`run-test-tool.ts` (Anthropic-tool-executor-
shaped `write_file`/`run_playwright_test`). All live-validated (MCP
connected and listed 25 tools; `--storage-state` skipped login; the
scoped tools wrote a real spec and ran it against the live app
successfully) before being deleted once the Claude Code pivot (see Open
decisions above) was confirmed to lose no measurement fidelity.

**v2 (Claude Code-driven), current:**

- [x] `harness/src/lib/claude-runner.ts`: spawns `claude -p
      --output-format json` per phase, parses its JSON result (tokens,
      cache tokens, `total_cost_usd`, `num_turns`, `permission_denials`)
      directly, and separately extracts tool-call counts from the
      session's own JSONL transcript
      (`~/.claude/projects/<slug>/<session-id>.jsonl`).
- [x] `harness/src/mcp-tools-server.ts`: `@modelcontextprotocol/sdk`'s
      `McpServer` (server-side, not client) exposing `write_file` +
      `run_playwright_test`, scoped to a run directory passed via `RUN_DIR`
      env var, same path-traversal guard as v1. Live-validated directly
      via a real MCP client (not through Claude Code): listed both tools,
      wrote a real spec, blocked a path-traversal attempt, ran the spec
      against the live app — passed.
- [x] `harness/src/lib/mcp-tool-names.ts`: the curated (not full 25)
      playwright-mcp browser toolset actually offered to the agent -
      excludes `browser_run_code_unsafe`/`browser_evaluate` (arbitrary JS
      execution, more capability than this flow needs) and several others
      not relevant to a form-filling flow; deliberately includes
      `browser_handle_dialog` (needed for the zero-balance confirmation
      dialog, see `docs/app-knowledge.md`).
- [x] `playwright.config.ts`: unchanged from v1 - `storageState` from
      `seed.ts`, `baseURL` from `TARGET_APP_URL`.
- [x] MCP condition runner, still split into two phases per `CLAUDE.md`
      decision 1: `harness/src/explore-mcp.ts` / `generate-mcp.ts`,
      rewritten to call `runClaude()` instead of the old agent loop. Same
      `results/<run-id>/metrics.json` + `results/raw/<run-id>/*.jsonl`
      output shape as before (field names inside `metrics.json` changed
      to match Claude Code's richer usage object - see
      `results/README.md`).
- [x] **Partially live-validated**: an actual `explore-mcp.ts` run was
      attempted (not through a deliberate test - it ran until a 60s
      timeout killed it) and got far enough to prove `--mcp-config` +
      `--dangerously-skip-permissions` work end-to-end when spawned from a
      script (a real `mcp__playwright__browser_navigate` tool call
      happened) - but it also caught a real bug: the agent navigated to
      `localhost:3000` (a guessed default) instead of `localhost:8081`,
      because nothing in the prompt stated the target URL. Fixed by
      injecting `Target application base URL: ...` into the system prompt
      in both phase scripts, from `TARGET_APP_URL`.
- [x] `docs/run-mcp-condition.md`: reproducible runbook for the MCP
      condition - every command plus the exact composed system/user
      prompts sent to Claude Code for each phase, so different people
      running it get comparable results. Must be resynced whenever
      `conditions/mcp/*.md`, `docs/app-knowledge.md`, or the flow spec
      change (covered by the standing "sync all .md before commit" rule).
- [x] **Ran a complete MCP condition end to end** for the first time
      (`mcp-2026-09-25T06-32-18-639Z`, both phases, no timeout): explore
      $0.80 / 58 turns / ~3 min, generate $1.20 / 77 turns / ~7 min
      (8 `run_playwright_test` iterations to green, then 2 consecutive
      passes to confirm stability). The agent caught and fixed two real
      bugs in its own generated test along the way (a weekend date
      rejected by the Assign Leave API, and an `isVisible()` vs
      `waitFor()` polling bug that silently skipped a required dialog
      click) - a good sign for the "efficiency: iterations to green" and
      quality axes. Full numbers in
      `results/mcp-2026-09-25T06-32-18-639Z/metrics.json`.
- [x] Fixed a real gap this run surfaced: `playwright-mcp` was writing its
      own accessibility-snapshot/console-log dumps to a `.playwright-mcp/`
      directory at the repo root (untracked, ungitignored) instead of
      under `results/raw/<run-id>/` per decision 8. Fixed by passing
      `--output-dir` in `explore-mcp.ts`/`generate-mcp.ts`; see
      `docs/run-mcp-condition.md` "Gotchas confirmed on the first real
      run".
- [x] CLI condition runner (`harness/src/run-cli.ts`, `npm run bench:cli`):
      a single Claude Code phase, reusing `claude-runner.ts` +
      `mcp-tools-server.ts` (write_file/run_playwright_test only, no
      playwright-mcp registered, and `--tools` excludes Claude Code's
      native `Bash` - see `CLAUDE.md` decision 1). System prompt is
      `conditions/cli/system-prompt.md`, embeds the codegen fixture
      directly in the user message (no read tool needed). **Not runnable
      yet** - blocked on the fixture below, fails with a clear error
      until it exists.
- [ ] `docs/quality-rubric.md`: define the quality checks (selector
      robustness, assertion quality, best-practices adherence,
      flakiness-across-N-runs) and how they're scored — manual checklist
      first, consider an automated/LLM-judge pass later.
- [ ] Quality scorer: runs the rubric against a produced spec file.

## Gotchas hit and fixed during harness development

Kept here rather than only in commit history since they're the kind of
thing anyone reproducing this repo would hit again.

- **`seed.ts`'s Leave Type creation silently no-op'd — logged success,
  created nothing.** Surfaced when a user recording the CLI fixture hit
  "No Records Found" in the Assign Leave Type dropdown on a freshly
  seeded install; reproduced from a clean `cleanup:app` + `setup:app` +
  `seed` cycle, and confirmed at the network level (`page.on('request')`)
  that clicking "Save" immediately after `.fill()`-ing the Name field
  fired **no POST request at all** to `/api/v2/leave/leave-types` — no
  error, no toast, nothing — while `ensureLeaveTypeExists` still logged
  `Created leave type "Annual Leave"` because it only waited a fixed
  500ms timeout rather than checking anything actually happened. Root
  cause: clicking Save races the SPA's form-state update before the
  Name field's model binding settles. Fixed by blurring the field and
  waiting briefly before clicking Save, and by replacing the blind
  timeout with an explicit `page.waitForResponse` on the create POST
  that throws if it doesn't arrive — so a regression here fails loudly
  instead of silently lying again. Verified from a clean install: DB now
  actually has the row (`ohrm_leave_type`), and a second `npm run seed`
  correctly takes the idempotent "already exists" path. Confined to
  `seed.ts`'s own one-time setup action, not the flow either condition's
  agent is scored on — no `docs/app-knowledge.md` change needed.
- **dotenv silently truncates unquoted values at `#`.**
  `OHRM_ADMIN_PASSWORD=PwMcpBench#2026` in `.env` loaded as `PwMcpBench` —
  no error, just a truncated password that made `seed.ts` hang on the
  login form until diagnosed. Fixed by quoting the value in `.env.example`
  (`OHRM_ADMIN_PASSWORD="PwMcpBench#2026"`). Applies to any future env var
  with a `#` in it.
- **`@playwright/mcp` and `@playwright/test` can silently resolve to two
  different `playwright-core` copies.** `@playwright/mcp` hard-pins an
  exact (often alpha/ahead-of-stable) `playwright` version internally; if
  `@playwright/test`'s own version wants a different one, npm installs
  both, and whichever wins the `node_modules/.bin/playwright` symlink can
  be the *wrong* one for `@playwright/test`'s runtime. Symptom 1: `npx
  playwright test` fails every file with "Playwright Test did not expect
  test() to be called here / you have two different versions of
  @playwright/test" — a real singleton conflict, not a flake. Symptom 2
  (once past that): browser executable version mismatch. Fixed by pinning
  `@playwright/test` in `package.json` to the *exact* build string
  `@playwright/mcp` depends on, so npm dedupes to one shared copy — see
  `CLAUDE.md` tech stack section for the re-pin procedure when
  `@playwright/mcp` gets bumped.
- **OrangeHRM's Leave List search can silently show "No Records Found" for
  a leave request that genuinely exists** (confirmed via direct
  `ohrm_leave` / `ohrm_leave_request` table inspection in the app's own
  MariaDB) — reproduced consistently with an exact employee-name filter
  and a date range bracketing the known date, root cause not pinned down.
  Documented as a known quirk in `docs/app-knowledge.md` rather than
  something to "fix" (it's the app's behavior, not the harness's) — the
  flow's verification step is written to treat the post-assignment
  success toast as primary evidence, Leave List as secondary/best-effort.
- **Claude Code's session transcripts are a legitimate source of exact
  token/cost data.** Before pivoting away from the direct-API harness,
  checked this session's own `~/.claude/projects/.../*.jsonl` and
  confirmed each assistant message's `usage` field has the same shape the
  raw Anthropic API returns (`input_tokens`, `output_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens`) - actually
  richer, since `claude -p --output-format json`'s single result object
  also includes `total_cost_usd` and `permission_denials` without needing
  the transcript at all.
- **A Claude Code session cannot validate `--dangerously-skip-permissions`
  by running it on itself.** Trying (via this session's own Bash tool) to
  spawn a nested `claude -p --dangerously-skip-permissions ...` got
  blocked every time by the session's own auto-mode classifier
  ("Permission for this action was denied by the Claude Code auto mode
  classifier"), regardless of which bypass flag was used
  (`--dangerously-skip-permissions` vs `--permission-mode
  bypassPermissions`). This is a safety guardrail, not a bug - don't try
  to route around it. It did **not** block the same mechanism when called
  from inside a script via `child_process.execFile` (a real
  `explore-mcp.ts` run got far enough to make an actual
  `mcp__playwright__browser_navigate` tool call before a test timeout
  killed it) - so the restriction is specifically about a Claude Code
  session directly commanding a permission-bypassed nested session, not
  about the mechanism itself failing.
- **Nothing told the agent the target app's URL.** Neither
  `flows/01-add-employee-leave-request.md` nor `docs/app-knowledge.md`
  states it (reasonably, for app-knowledge - it's config, not "knowledge
  a tester would have memorized"). Caught for real: a live (if
  timeout-truncated) run navigated to `http://localhost:3000/...`, a
  guessed default, instead of `8081`. Fixed by injecting
  `Target application base URL: ${TARGET_APP_URL}` into both phase
  scripts' system prompts at runtime, not hardcoding it in a doc.
- Cleanup note: that same truncated test run left an unrelated **orphaned
  `playwright-mcp --port 8931` process** running from an earlier *manual*
  HTTP-mode smoke test hours before (its `kill` apparently didn't take, or
  a second instance got spawned) - found via `ps aux` while debugging,
  not by anything the harness itself does wrong. Worth an occasional
  `ps aux | grep playwright-mcp` sanity check during heavy harness
  iteration, not something to build automated cleanup for at this stage.

## Phase 4 — Run & report

- [ ] Run both conditions (N repeats per the decision above) against the
      confirmed flow.
- [ ] Aggregate results, write up findings (likely `docs/results.md` or a
      dated report) — token cost, efficiency, and quality side by side.
- [ ] Sanity-check findings against the ~4x (up to 10x) figure from the
      inspiring post.

## Phase 5 — Test healing (v2, not started)

- [ ] Design a repeatable "break" mechanism (e.g. a deliberately mutated
      selector/DOM change, or a page structure change in the self-hosted
      app) that both conditions have to recover from.
- [ ] Extend the harness with a healing runner sharing the same
      cost/efficiency/quality metrics.

## Nice-to-haves (not scoped, don't build unprompted)

- Results viewer / dashboard.
- Multi-app coverage beyond the one flow.
- CI workflow to re-run the benchmark on a schedule and track drift.
