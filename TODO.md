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
- [x] **[DECISION]** Flow: "add employee → apply leave → verify leave list"
      confirmed as the v1 flow — may still be adjusted as the harness comes
      together, that's expected iteration and doesn't need re-confirming.
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
      deterministic even at temperature 0) — still open.

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
- [ ] Write `flows/01-add-employee-leave-request.md`: the exact
      natural-language task spec given verbatim to both conditions.
- [ ] Record the CLI condition's seed fixture: run
      `npx playwright codegen <target-url>`, perform the flow by hand,
      save the raw output to `fixtures/01-add-employee-leave-request.codegen.ts`.
      Document the exact click-by-click steps in `fixtures/README.md` so
      anyone can re-record it if the app changes.

## Phase 3 — Harness

- [ ] `harness/`: Anthropic API wrapper using `@anthropic-ai/sdk`, reading
      `usage.input_tokens` / `usage.output_tokens` off every response.
- [ ] MCP condition runner: spawns `@playwright/mcp`, wires its tools into
      the agent loop; writes the generated spec file + `metrics.json` to
      `results/<run-id>/`, full raw transcript (incl. MCP snapshots) to
      `results/raw/<run-id>/`.
- [ ] CLI condition runner: gives the agent file read/write + a sandboxed
      shell tool scoped to `npx playwright test` (and nothing broader);
      same `results/<run-id>/` vs `results/raw/<run-id>/` split.
- [ ] `metrics.json` shape (see `results/README.md`): tokens by phase,
      tool-call/turn count, wall-clock time, iterations-to-green.
- [ ] `docs/quality-rubric.md`: define the quality checks (selector
      robustness, assertion quality, best-practices adherence,
      flakiness-across-N-runs) and how they're scored — manual checklist
      first, consider an automated/LLM-judge pass later.
- [ ] Quality scorer: runs the rubric against a produced spec file.

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
