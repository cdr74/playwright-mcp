# CLAUDE.md

Guidance for Claude Code sessions working in this repository.

## What this project is

A reproducible benchmark comparing **token cost, iteration efficiency, and
output quality** of using **Playwright MCP** vs **Playwright CLI** for
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
  target app/flow, what counts as "the MCP condition" vs "the CLI condition",
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
  app, changing what "CLI condition" means) — flag it and confirm first.

## Current design decisions (confirmed with the user)

1. **Two conditions, deliberately asymmetric** (this is the point of the
   study, not a flaw to fix):
   - **MCP condition**: the agent is given Playwright MCP tools
     (`browser_navigate`, `browser_snapshot`, `browser_click`, etc.) plus a
     file-write tool. It explores the live target app autonomously from a
     natural-language task spec and authors the final `*.spec.ts` file
     itself, in one continuous agentic loop.
   - **CLI condition**: modeled on how a human actually uses Playwright's
     CLI — `playwright codegen` first (a human/deterministic recording step,
     **zero LLM tokens**, checked into `fixtures/` so it's reproducible
     without a human re-recording it each run), then the agent takes over
     with only file read/write + shell (`npx playwright test`) tools — no
     live browser visibility — and turns the raw recording into a clean,
     asserted test, iterating on terse test-run output until green.
   - Both conditions receive the **identical natural-language task spec**
     (see `flows/`). That's the controlled variable. Tooling, and therefore
     workflow shape, is the independent variable — that asymmetry is exactly
     what's being measured.
2. **Metrics across three axes**, not just tokens:
   - **Cost**: input/output tokens (exact, from Anthropic API `usage`),
     broken down by phase where possible (exploration vs authoring vs
     healing).
   - **Efficiency**: number of agent turns/tool calls, wall-clock time,
     number of test-run iterations to reach green.
   - **Quality**: a rubric applied to the resulting test file — selector
     robustness (role/testid vs brittle CSS/XPath), assertion
     meaningfulness, pass reliability across N repeat runs (flakiness), use
     of Playwright best practices (auto-waiting, no hard sleeps), line
     count. See `docs/quality-rubric.md` (to be written — see `TODO.md`).
3. **Measurement harness**: a Node/TypeScript script calling the Anthropic
   Messages API **directly** (not via the Claude Code CLI), so exact
   `usage.input_tokens` / `usage.output_tokens` are read straight off every
   API response. No log-scraping.
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
   first. **Flow: confirmed** ("add employee → apply leave → verify leave
   list", see `README.md` "Test bed") — may still be adjusted as the
   harness is built and exercised in practice; that's expected iteration,
   not a design change requiring re-confirmation.
6. **Reset between runs: full reinstall**, not DB snapshot/restore —
   `podman-compose down -v && ./app/install.sh` takes ~80s end-to-end
   (measured with images already cached locally), which is cheap enough
   next to an actual agent run. Revisit only if this becomes a measured
   bottleneck once the harness is running many repeats.
7. **v1 model: a single model, Claude Sonnet.** Broader model coverage
   (to see whether the MCP/CLI gap is model-dependent) is explicitly
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

## Tech stack

- **Node.js + TypeScript**, npm (not pnpm/yarn — lowest-friction for
  "anyone can reproduce this").
- Setup is scripted: `npm install && npm run setup` brings up the target
  app (`app/install.sh`) and installs the Playwright browser binary
  (`npm run setup:tools`). `npm run verify:tools` smoke-checks the
  `playwright` / `playwright-mcp` binaries. `npm run cleanup:app` tears the
  app stack down. Don't reinvent these — extend them.
- `@anthropic-ai/sdk` for the direct API harness.
- `@playwright/test` + `@playwright/mcp` (the actual MCP server package) as
  dependencies — the harness spawns/drives these, it doesn't reimplement
  them.
- No frontend/UI planned for v1. Results are files (JSON/CSV) plus a
  written report in Markdown. A small results-viewer could be a nice-to-have
  later — don't build it unprompted.

## Repo conventions

- Never commit `.env` or API keys — `.env.example` documents required vars.
- Per-run results: `results/<run-id>/` (generated test file + `metrics.json`)
  is committed-eligible; `results/raw/` (transcripts, Playwright artifacts)
  is gitignored. See decision 8 above and `results/README.md`.
- Fixtures in `fixtures/` (codegen recordings) are checked in — they are the
  reproducibility anchor for the CLI condition and should not silently
  change.
- This repo is public (`github.com/cdr74/playwright-mcp`). Don't put
  anything in it — including in commit history — that shouldn't be public.
