# TODO

Tracking for the MCP-vs-Codegen token/quality benchmark. Phased roughly in build
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
      unfairly help the blind/Codegen condition).
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
- [x] **[DECISION]** Repeat runs per condition for statistical noise:
      **3**. Deferred twice before this (once before the Codegen runner
      existed, once pending its first real run) so it wasn't picked
      blind — decided once both conditions had real cost/duration numbers
      to size against (`docs/results.md`). Applies per prompt variant, not
      just per condition, if the baseline-vs-nudged comparison below also
      gets built (3 × 2 conditions × 2 variants = 12 runs, not 6). See
      `CLAUDE.md` decision 12.
- [x] **[DECISION]** Baseline-vs-nudged quality comparison: **build it,
      run it later.** `docs/testing-best-practices.md` (mirrors
      `docs/quality-rubric.md`'s 7 criteria one-for-one) is now wired into
      the code-writing phase of both conditions
      (`generate-mcp.ts`/`run-codegen.ts`, not `explore-mcp.ts` - see that
      file's own header), opt-in and symmetric, via `NUDGE_QUALITY=1` /
      the `*:nudged` npm scripts (`explore:mcp:nudged` +
      `generate:mcp:nudged`, `bench:codegen:nudged`). `RUN_ID` gets an
      `mcp-nudged-`/`codegen-nudged-` prefix so results stay
      distinguishable by directory name alone, and `metrics.json` also
      carries an explicit `promptVariant: "baseline" | "nudged"` field for
      querying without parsing the prefix. `generate-mcp.ts` warns loudly
      if its `NUDGE_QUALITY` and the `RUN_ID` prefix it was handed
      disagree.
      - **Not yet run.** No nudged runs exist yet. Tracked with the rest
        of the actual-run work in Phase 4 below ("Run both conditions
        3 repeats each").
- [x] **[DECISION]** Measurement mechanism: **Claude Code (`claude -p`),
      not the Anthropic API directly** — pivoted after the harness was
      already built and working against the raw API, because API usage is
      metered/billed separately while Claude Code usage rides on an
      existing subscription (same reasoning as registering an MCP server
      in Copilot/VS Code instead of paying per token). Confirmed no loss
      of measurement precision first (see Gotchas below) before commiting
      to the rewrite. Both conditions go through Claude Code, for
      symmetry (the alternative — Codegen condition direct-API, MCP condition
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

- [x] **[DECISION]** Repeat-run count: **3** — see Open decisions above.
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
- [x] **Recorded the Codegen condition's codegen fixture**
      (`fixtures/01-add-employee-leave-request.codegen.ts`, 2026-09-25).
      Recording this surfaced a real `seed.ts` bug (see Gotchas below,
      Leave Type creation silently no-op'ing) that had to be fixed first.
      Two deviations from the intended steps, documented in
      `fixtures/README.md`: recorded a two-day leave range instead of a
      single day (still a valid DB-confirmed assignment, but the Codegen
      agent has to narrow it itself), and recorded enabling login details
      for the employee (out of flow scope, left in as realistic noise).
      `npm run bench:codegen` is now actually runnable.

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
- [x] Codegen condition runner (`harness/src/run-codegen.ts`, `npm run bench:codegen`):
      a single Claude Code phase, reusing `claude-runner.ts` +
      `mcp-tools-server.ts` (write_file/run_playwright_test only, no
      playwright-mcp registered, and `--tools` excludes Claude Code's
      native `Bash` - see `CLAUDE.md` decision 1). System prompt is
      `conditions/codegen/system-prompt.md`, embeds the codegen fixture
      directly in the user message (no read tool needed). Now runnable -
      the fixture it depends on is recorded (see above).
- [x] **Ran the Codegen condition end to end** for the first time
      (`codegen-2026-09-25T08-46-56-590Z`): $0.28 / 9 turns / ~4 min, 4
      `run_playwright_test` iterations to green (vs. MCP's $0.80+$1.20 /
      135 turns / ~10 min, 8 iterations - see the MCP run above). Big
      caveat: this is one run of each, not a controlled comparison yet
      (see the open repeat-count decision) - but the first real signal
      lines up directionally with the inspiring post's cost-gap claim.
      The agent correctly narrowed the fixture's recorded two-day leave
      range to a single day per the flow spec, caught the same
      `isVisible()`-vs-`waitFor()` dialog-timing bug the MCP condition's
      agent found independently, and also caught a second one specific
      to the raw recording: blindly picking the Leave Type listbox's
      "first option" could select the re-rendered `-- Select --`
      placeholder rather than a real leave type. Full numbers in
      `results/codegen-2026-09-25T08-46-56-590Z/metrics.json`.
- [x] `docs/quality-rubric.md`: started at 6 criteria (5 from `CLAUDE.md`
      decision 2 plus task/spec compliance), now 7 - a config/data
      separation criterion was added, and the assertions criterion
      tightened for fail-fast/diagnostics, after user-proposed additions
      for larger-suite practices. Current totals are out of /28, not the
      original /24 - see `docs/results.md`. Manual for now, per the
      original plan; automated/LLM-judge pass still a later option, see
      below.
- [x] First manual scoring pass, both runs from `docs/results.md`
      (originally MCP 23/24, Codegen 20/24; rescored to MCP 24/28, Codegen
      22/28 after the rubric's criterion-2/7 revisions above - see that doc
      for what changed and why). Criterion 3 (flakiness) was **measured**,
      not estimated - each test actually re-run 5x (`--repeat-each=5
      --workers=1`) against a live, re-seeded app: MCP 5/5, Codegen 2/5.
      Root cause of the Codegen gap traced to the DB, not guessed:
      Codegen's test
      hardcodes `firstName = 'Thomas'` (inherited from the codegen
      fixture) and only generates a unique last name, so its employee-
      autocomplete search gets less selective every time the test runs -
      8 "Thomas" employees existed by the time of this scoring pass. A
      literal criterion-6 gap directly caused the criterion-3 flakiness -
      see `docs/results.md` "Quality" for the full writeup.
- [ ] Quality scorer: an automated/LLM-judge pass that runs the rubric
      against a produced spec file without a human doing it by hand. Not
      started - the manual pass above is still the only path today.

## Gotchas hit and fixed during harness development

Kept here rather than only in commit history since they're the kind of
thing anyone reproducing this repo would hit again.

- **[Not yet root-caused] One Codegen repeat in the first real
  `repeat:baseline` batch failed outright** -
  `results/codegen-2026-09-25T14-00-05-130Z/` has a partial spec file but
  no `metrics.json` and no raw transcript at all, and
  `run-repeats.sh`'s log correctly shows an empty `run_id` field for that
  repeat too (its `extract_run_id` found nothing to parse, consistent
  with the run itself erroring before printing its `==> Done:` line).
  Time-boxed out of the session that found it - next step is checking
  whatever partial output the terminal captured at the time, or just
  re-running `--condition codegen --repeats 1` and watching it live.

- **Claude Code was auto-attaching this repo's entire `CLAUDE.md`
  (15,909 chars) plus its auto-memory files to every single benchmark
  run, regardless of `--system-prompt`.** Surfaced by the user asking
  "how do we avoid session memory giving wrong results for repeat runs" -
  answered empirically instead of assumed: grepped the real transcripts
  from both existing runs for auto-memory content and found it, in all
  three phase transcripts. Confirmed the mechanism with
  `python3 -c "json.loads(...)"` on the raw JSONL: an `"attachment"` entry
  of `attachment.type: "instructions"` carrying
  `/home/chris/dev/playwright-mcp/CLAUDE.md` (`type: "Project"`) and
  `.../memory/MEMORY.md` (`type: "AutoMem"`) verbatim, on every phase of
  every run. This is a *separate* mechanism from the rendered system
  prompt - `--system-prompt` is a full replace of the prompt itself, but
  doesn't touch this auto-attachment step, so decision 3's "keeping the
  prompt close to what a bare API harness would have sent" wasn't
  actually true for any run before this fix. Both existing baseline runs
  (`results/mcp-2026-09-25T06-32-18-639Z/`,
  `results/codegen-2026-09-25T08-46-56-590Z/`) carry this contamination -
  treat their exact token/cost numbers as measuring something slightly
  different from what the docs claim, and don't reuse them as 1-of-3 in
  the N=3 baseline set once that gets (re-)run on the fixed harness.
  - Two candidate fixes were tested directly against a real
    `--mcp-config`/`--strict-mcp-config` tool call (not assumed from
    `--help` text alone) and **both ruled out**: `claude -p --bare` does
    stop the attachment, but its help text says plainly "Anthropic auth
    is strictly `ANTHROPIC_API_KEY` or `apiKeyHelper`... OAuth and
    keychain are never read" - forcing metered API billing, which defeats
    decision 3's entire reason for existing. `--safe-mode` also stops the
    attachment, but a real test call showed it silently drops
    explicitly-configured `--mcp-config` servers too (no
    `permission_denials` entry at all - the model never even saw the
    tool, just described a fake call in prose) - would have broken the
    harness's actual mechanism, not just the contamination.
  - **The fix that works**: run `claude -p` from a `cwd` outside this
    repo entirely. CLAUDE.md auto-discovery walks up from cwd looking for
    the file; auto-memory is scoped by a project slug derived from cwd
    (`cwd.replace(/\//g, '-')`, the same formula the transcript path
    already uses) - an unrelated external cwd gets a fresh, empty memory
    space with nothing to attach. Confirmed with the same real
    `--mcp-config` tool-call test: relocated cwd, genuine
    `permission_denials` entry (a real attempted call, not hallucinated),
    zero `"instructions"` attachment in the resulting transcript.
    Implemented as `harness/src/lib/isolated-session.ts`
    (`isolatedCwd(runId)`, `bin(repoRoot, name)`) and wired into all three
    run scripts. The one catch: relocating cwd means `npx <bin>` can no
    longer resolve this repo's local `node_modules/.bin/` via its own
    cwd-relative lookup, so the MCP server `command`s switched from
    `npx tsx`/`npx playwright-mcp` to `bin()`'s absolute paths.
- **The saved auth session in `harness/.auth/state.json` can expire
  between when a test was generated and when you come back to run it
  later.** Hit while manually re-running both conditions' generated tests
  for `docs/quality-rubric.md` scoring, ~2 hours after the original runs:
  all 5 repeat runs failed identically at the first form field, timeout
  waiting for an element that was actually the *login page*, not the
  form - `storageState` had a stale, expired session cookie.
  `npm run seed` before scoring/re-running any older generated test fixed
  it immediately. Not a harness bug - OrangeHRM's session simply times
  out - but easy to misdiagnose as a test defect if you don't check the
  actual page snapshot in the failure output first. **Fixed properly**,
  not just noted: `seed()` is now exported from `seed.ts` and called
  unconditionally as the first step of `explore-mcp.ts`/`generate-mcp.ts`/
  `run-codegen.ts`, so freshness is no longer the operator's problem for a
  fresh run (still worth knowing if you manually re-run an *old*
  `results/<run-id>/tests/*.spec.ts` directly with `npx playwright test`,
  which doesn't go through any of those scripts).
- **`seed.ts`'s Leave Type creation silently no-op'd — logged success,
  created nothing.** Surfaced when a user recording the Codegen fixture hit
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

- [x] Ran both conditions once each against the confirmed flow (see the
      first-run entries above under Phase 3). **Not yet the N-repeats run
      this phase is really about** - the repeat-count decision is still
      open.
- [x] First aggregated write-up: `docs/results.md` - cost (dollar and raw
      token volume, which tell different stories), efficiency, and a
      qualitative quality read, side by side, with an explicit N=1 caveat
      section. To be revisited once repeat runs exist.
- [x] Sanity-checked against the inspiring post's ~4x (up to 10x) figure:
      see `docs/results.md` "How this compares to the inspiring post" -
      raw token volume showed a larger gap (~29x), dollar cost a smaller
      one (~7x), neither straightforwardly confirming or refuting the
      post given it doesn't disclose whether/how it accounted for prompt
      caching.
- [x] `harness/run-repeats.sh` (`npm run repeat:baseline` /
      `repeat:nudged`) + `docs/run-repeats.md`: the actual mechanism for
      producing the N-repeats-per-condition dataset - resets the app
      before *every* individual run (not just once per batch, see that
      doc for why this specific discipline matters), logs every `RUN_ID`
      to `results/repeat-run-log-<timestamp>.txt`, keeps going if one
      repeat fails rather than aborting the batch. Prompted by the user
      noticing this had no actual instructions anywhere, let alone one
      referenced from `README.md`.
- [ ] **Actually run it**: `npm run repeat:baseline` (6 runs, on the
      now-fixed harness - see the CLAUDE.md-contamination Gotcha, don't
      reuse the two existing runs, they predate the fix), and
      `npm run repeat:nudged` (6 more) if the baseline-vs-nudged
      comparison happens at the same time. Update `docs/results.md` from
      a single anecdote into an actual comparison with a real sample
      size.

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
