# CLAUDE.md

Guidance for Claude Code sessions working in this repository.

## What this project is

A reproducible benchmark comparing **token cost, iteration efficiency, and
output quality** of using **Playwright MCP** vs a **Playwright Codegen-based
flow** for
AI-agent-driven test generation (and later, test healing). Full context is
in `README.md`; task tracking is in `TODO.md`.

Inspired by https://dreaming.press/posts/playwright-mcp-vs-cli-token-cost-browser-agents.html,
which cites external numbers (~114K tokens MCP vs ~27K CLI for a ~10-step
task) with **no disclosed methodology, test app, or harness**. This project
exists to actually build that harness, publish the methodology, and let
anyone reproduce or challenge the numbers.

## Collaboration model — read this before doing anything non-trivial

The user wants to be **closely involved in design decisions** and **less
involved in coding mechanics**. In practice:

- **Design decisions** — anything that changes the shape of the experiment —
  require the user's sign-off before implementation. This includes: the
  target app/flow, what counts as "the MCP condition" vs "the Codegen condition",
  what gets measured and how, prompt/system-message design for the agents
  under test, the quality rubric, model selection, and anything that would
  change how results should be interpreted.
- **Implementation mechanics** — writing the harness code, wiring up the
  Anthropic SDK, Playwright config, TypeScript plumbing, docker-compose
  files, etc. — do not need step-by-step approval once the design is agreed.
  Just build it, and summarize what you built.
- When genuinely unsure whether something is a design decision or an
  implementation detail, ask. Prefer `AskUserQuestion` with concrete options
  over open-ended "what do you think?" questions.
- Don't silently change an already-agreed design (e.g. swapping the target
  app, changing what "Codegen condition" means) — flag it and confirm first.

## Before every commit

Review **every** `.md` file in the repo (not just the ones touched by the
current change) and update anything stale — status lines, resolved
decisions, changed commands/paths, numbers that shifted — before creating
the commit. Do this unprompted, every time; it's a standing rule, not a
per-commit reminder. If a commit touches behavior, config, or a decision,
assume some `.md` file describes it and needs a pass.

## Current design decisions (confirmed with the user)

1. **Two conditions, deliberately asymmetric** (this is the point of the
   study, not a flaw to fix):
   - **MCP condition**: runs as two separate agent phases (own tool set,
     own token accounting each, both in `metrics.json`), implemented in
     `harness/src/explore-mcp.ts` / `harness/src/generate-mcp.ts`:
     **explore** (Playwright MCP tools + a `write_file` tool scoped to the
     run's output directory → writes `test-plan.md`, no code) then
     **generate** (same tools + a `run_playwright_test` tool that runs
     `npx playwright test <path>` and returns condensed pass/fail output →
     writes and iterates on the actual spec file). Splitting it this way
     mirrors how a tester actually works and keeps "explored well" and
     "produced a working test" separately measurable — this refines the
     original one-continuous-loop idea; the tool surface (browser + scoped
     file write + scoped test runner) is still MCP's defining shape vs the
     Codegen condition's file-only approach.
   - **Codegen condition** (named for `playwright codegen`, not "CLI" — see
     `README.md` "How the comparison works" for why): modeled on how a
     human actually uses Playwright's CLI tooling
     — `playwright codegen` first (a human/deterministic recording step,
     **zero LLM tokens**, checked into `fixtures/` so it's reproducible
     without a human re-recording it each run), then the agent takes over
     with only a scoped `write_file` + `run_playwright_test` tool (see
     decision 3) — no live browser visibility, and critically no raw shell
     (Claude Code's native `Bash` tool is a general shell, not scoped to
     `npx playwright test`, so the Codegen condition must NOT be given it,
     and never gets real command-line access despite starting from CLI
     output) — and turns the raw recording into a clean, asserted test,
     iterating on terse test-run output until green. Built
     (`harness/src/run-codegen.ts`, `npm run bench:codegen`) and has
     completed a first full run — see `TODO.md` and
     `docs/run-codegen-condition.md`. **Renamed from "CLI condition" to
     "Codegen condition"** after the original name was found to overclaim
     what's tested (README.md "How the comparison works" has the full
     reasoning) — this rename touched every file in the repo, tracked as
     a single commit, not a silent drift.
   - Both conditions receive the **identical natural-language task spec**
     (see `flows/`). That's the controlled variable. Tooling, and therefore
     workflow shape, is the independent variable — that asymmetry is exactly
     what's being measured.
2. **Metrics across three axes**, not just tokens:
   - **Cost**: input/output tokens, cache-write/cache-read tokens, and an
     implied list-price USD figure, per phase — all read straight off
     `claude -p --output-format json`'s own result object (see decision 3).
   - **Efficiency**: number of agent turns/tool calls (by tool name), wall-
     clock time, number of test-run iterations to reach green, and
     permission-denial count (>0 means the agent got blocked from
     something it tried — a real signal, not just noise).
   - **Quality**: a rubric applied to the resulting test file — selector
     robustness (role/testid vs brittle CSS/XPath), assertion
     meaningfulness, pass reliability across N repeat runs (flakiness), use
     of Playwright best practices (auto-waiting, no hard sleeps), line
     count, plus two added after real scoring passes - task/spec
     compliance and config/data separation (7 total). See
     `docs/quality-rubric.md` and `docs/results.md`
     for the first scores.
3. **Measurement harness: drives Claude Code (`claude -p`), not the
   Anthropic API directly** — changed from the original plan (billed
   against an existing Claude Code subscription instead of metered API
   usage, the same reasoning as registering an MCP server in
   Copilot/VS Code rather than paying per-token). This was a real pivot,
   not a refinement — the original direct-API harness
   (`agent-loop.ts`/`mcp-client.ts`/`fs-tools.ts`/`run-test-tool.ts`) was
   built, tested, and then deleted once this was confirmed to work with
   equal measurement fidelity. Mechanics, in
   `harness/src/lib/claude-runner.ts`:
   - Each phase is one `claude -p --output-format json` invocation with a
     fresh `--session-id` (a generated UUID) and **`--system-prompt`**
     (full replace, not `--append-system-prompt`) set to the phase prompt
     + `docs/app-knowledge.md` + the target app URL — this avoids Claude
     Code's own default identity/tool-guidance system prompt, keeping the
     prompt close to what a bare API harness would have sent.
   - `--tools` is an **explicit allow-list** per phase (proven empirically,
     not assumed - see below), never `default`. `--mcp-config` (inline
     JSON, always paired with `--strict-mcp-config` so no project/user
     `.mcp.json` leaks in) registers `playwright-mcp` (MCP condition only)
     and a small custom local MCP server,
     `harness/src/mcp-tools-server.ts`, exposing exactly `write_file` and
     `run_playwright_test` — both conditions get this one, scoped to the
     run's output directory with a path-traversal guard, same logic the
     retired direct-API harness used, just repackaged as real MCP tools
     instead of Anthropic tool executors. This is how the Codegen condition's
     "no raw shell" requirement (decision 1) stays true under Claude Code.
   - `--dangerously-skip-permissions` is required for unattended runs.
     Confirmed working when the `claude -p` process is spawned from a
     script (`child_process.execFile`) — but **cannot be validated by
     asking a Claude Code session to run it directly itself**: that
     session's own auto-mode classifier blocks spawning a permission-
     bypassed child as a safety guardrail, regardless of which specific
     bypass flag is used. Don't fight that block if you hit it again — it
     means "have the user run this in their own terminal," not "find a
     workaround."
   - The result JSON (`usage`, `total_cost_usd`, `num_turns`,
     `permission_denials`, `result`) has everything for `metrics.json`
     directly - no transcript parsing needed for those. Tool-call
     attribution does need the session transcript (copied into
     `results/raw/<run-id>/` for our own retention, from
     `~/.claude/projects/<cwd-with-/-as-->/<session-id>.jsonl` - MCP tools
     appear there as `mcp__<server-name>__<tool-name>`, individually
     countable).
   - Empirically proven before/while building this (see `TODO.md`
     Gotchas): `claude -p --output-format json`'s `usage` object has exact
     `input_tokens`/`output_tokens`/cache breakdown; `--mcp-config`
     genuinely registers and offers a server's tools (confirmed via a
     `permission_denials` entry naming the exact blocked tool call before
     permissions were fixed); the project-slug transcript path formula is
     `cwd.replace(/\//g, '-')`, confirmed against this repo's own path.
4. **v1 scope: test generation only.** Test healing (breaking a selector or
   page structure post-hoc and measuring the cost to fix it) is a deliberate
   phase 2, once generation is solid — see `TODO.md`.
5. **Target app: confirmed — self-hosted OrangeHRM 5.9** via
   `app/docker-compose.yml` + `app/install.sh` (works with Docker or
   Podman; validated end-to-end with Podman 5.7.0/podman-compose 1.5.0,
   rootless — full install, login, and idempotent re-run all confirmed from
   a clean state). The original plan (point at OrangeHRM's public demo) was
   dropped because that instance isn't reliably reachable as a self-serve
   target anymore. Do not switch the target app again without checking
   first. **Flow: confirmed** ("add employee → assign leave → verify",
   see `README.md` "Test bed") — may still be adjusted as the
   harness is built and exercised in practice; that's expected iteration,
   not a design change requiring re-confirmation.
6. **Reset between runs: full reinstall**, not DB snapshot/restore —
   `podman-compose down -v && ./app/install.sh` takes ~80s end-to-end
   (measured with images already cached locally), which is cheap enough
   next to an actual agent run. Revisit only if this becomes a measured
   bottleneck once the harness is running many repeats.
7. **v1 model: a single model, Claude Sonnet.** Broader model coverage
   (to see whether the MCP/Codegen gap is model-dependent) is explicitly
   deferred, not forgotten — see `TODO.md`.
8. **What results keep**: per run, `results/<run-id>/` holds only the
   generated test file + `metrics.json` (tokens, efficiency counts, quality
   scores) — see `results/README.md` for the exact shape. Full transcripts
   (including raw MCP accessibility-tree dumps) and any Playwright run
   artifacts (screenshots, videos, traces, HTML reports) go in
   `results/raw/`, which is gitignored, never committed. This is a firm
   rule, not a default to revisit per-run.
9. **License: MIT** (`LICENSE`). Copyright holder is currently set to the
   `cdr74` GitHub handle as a placeholder — trivial to swap for a full
   legal name later, not worth blocking on.
10. **Both conditions get a shared "tester knowledge" primer**
    (`docs/app-knowledge.md`), fed into their system prompts alongside the
    task spec. Rationale: a real tester wouldn't start from zero either;
    letting an agent rediscover basic app structure from scratch on every
    run would bias the comparison rather than measure it. The primer is
    gathered by actually exploring the running app, not guessed, and is
    also where known app-level quirks live (e.g. Leave List search
    unreliably surfacing a just-assigned leave request in this OrangeHRM
    build — confirmed via direct DB inspection to be a real app quirk, not
    a test-authoring bug).
11. **The seed step (`harness/src/seed.ts`) covers more than login**: it
    also does the one-time org setup a fresh OrangeHRM install needs
    before the Leave module works at all (Leave Period, one Leave Type)
    — deterministic, zero-LLM-token, same reasoning as #10: this is
    environment setup a tester wouldn't expect to have to do as part of
    testing a specific feature. Exported as a `seed()` function that
    `explore-mcp.ts`/`generate-mcp.ts`/`run-codegen.ts` each call
    unconditionally as their first move, not a manual prerequisite the
    operator has to remember — the saved session can expire between runs
    (confirmed for real, see `TODO.md` Gotchas) and re-seeding is cheap
    enough that checking staleness first isn't worth the extra code.
    Still runnable standalone (`npm run seed`). It saves an authenticated
    Playwright storage state (`harness/.auth/state.json`, gitignored) that
    both the MCP condition (via `playwright-mcp --storage-state`) and
    generated test files (via `playwright.config.ts`'s `use.storageState`)
    start from — neither condition, nor the generated tests themselves,
    should ever need to write a login step.

## Tech stack

- **Node.js + TypeScript**, npm (not pnpm/yarn — lowest-friction for
  "anyone can reproduce this").
- Setup is scripted: `npm install && npm run setup` brings up the target
  app (`app/install.sh`) and installs the Playwright browser binary
  (`npm run setup:tools`). `npm run verify:tools` smoke-checks the
  `playwright` / `playwright-mcp` binaries. `npm run cleanup:app` tears the
  app stack down. Don't reinvent these — extend them.
- **Requires the `claude` CLI installed and authenticated** (a Claude Code
  subscription, not an API key) — that's the whole point of decision 3. No
  `@anthropic-ai/sdk` dependency; the harness shells out to `claude -p`
  (`harness/src/lib/claude-runner.ts`).
- `@modelcontextprotocol/sdk` (official MCP TypeScript SDK) — used
  **server-side** now (`McpServer`/`StdioServerTransport` in
  `harness/src/mcp-tools-server.ts`), not as an API-facing client. `zod`
  is an explicit dependency for that server's tool input schemas (it's
  also a transitive dep of the SDK, pin it directly rather than rely on
  hoisting).
- `@playwright/test` + `@playwright/mcp` (the actual MCP server package) as
  dependencies — the harness spawns/drives these, it doesn't reimplement
  them.
- **`@playwright/test` is pinned to the exact alpha build
  `@playwright/mcp` depends on internally** (currently
  `1.64.0-alpha-1789764292000`, not a caret range). This isn't cosmetic:
  `@playwright/mcp` hard-pins an exact `playwright`/`playwright-core`
  version that's routinely ahead of `@playwright/test`'s latest stable
  release; if the two packages resolve to *different* copies of
  `playwright-core`, you get two failure modes at once — `npx playwright
  test` throws "Playwright Test did not expect test() to be called here /
  you have two different versions of @playwright/test" (a real module-
  singleton conflict, not a red herring), and even past that, a browser
  revision mismatch ("Executable doesn't exist at
  .../chromium_headless_shell-NNNN"). Both were hit and root-caused during
  harness development by inspecting `node_modules/.bin/playwright`'s
  symlink target and comparing installed versions with
  `require('.../package.json').version`. **When bumping `@playwright/mcp`,
  re-check what exact `playwright` version it now requires and re-pin
  `@playwright/test` to match** — don't just bump both independently.
- No frontend/UI planned for v1. Results are files (JSON/CSV) plus a
  written report in Markdown. A small results-viewer could be a nice-to-have
  later — don't build it unprompted.

## Repo conventions

- Never commit `.env` or API keys — `.env.example` documents required vars.
- Per-run results: `results/<run-id>/` (generated test file + `metrics.json`)
  is committed-eligible; `results/raw/` (transcripts, Playwright artifacts)
  is gitignored. See decision 8 above and `results/README.md`.
- Fixtures in `fixtures/` (codegen recordings) are checked in — they are the
  reproducibility anchor for the Codegen condition and should not silently
  change.
- Agent-facing tools that touch the filesystem or run commands
  (`harness/src/mcp-tools-server.ts`'s `write_file` / `run_playwright_test`)
  are scoped to a single run's output directory and path-traversal-checked
  (resolve + prefix check), not general-purpose. Keep that pattern for any
  new tool — never hand an agent Claude Code's native `Bash`/unscoped
  `Write` when a scoped custom MCP tool will do.
- This repo is public (`github.com/cdr74/playwright-mcp`). Don't put
  anything in it — including in commit history — that shouldn't be public.
