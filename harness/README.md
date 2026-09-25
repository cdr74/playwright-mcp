# harness/

The measurement harness: drives **Claude Code** (`claude -p`, non-
interactive) as the agent for each phase, rather than the Anthropic API
directly — billed against an existing Claude Code subscription instead of
metered API usage. Needs the `claude` CLI installed and authenticated
(`claude auth login`); no `ANTHROPIC_API_KEY` required. See `CLAUDE.md`
decision 3 for the full reasoning and mechanics.

## Layout

- `src/seed.ts` (`npm run seed`) — logs in once, does one-time OrangeHRM
  Leave module setup, saves an authenticated storage state to `.auth/`
  (gitignored). Both conditions and generated test files start from this.
- `src/lib/claude-runner.ts` — spawns `claude -p --output-format json` for
  one phase, parses its JSON result (tokens, cost, turns, permission
  denials) directly, and extracts tool-call counts from that session's own
  transcript file afterward.
- `src/mcp-tools-server.ts` — a small local MCP server (not a client)
  exposing `write_file` and `run_playwright_test`, both scoped to a single
  run's output directory with a path-traversal guard. Registered via
  `--mcp-config` for every phase of both conditions — never give an agent
  Claude Code's native, unscoped `Write`/`Bash` instead.
- `src/lib/mcp-tool-names.ts` — the curated playwright-mcp browser toolset
  actually offered to the MCP condition (not all ~25 - see the file for
  what's excluded and why).
- `src/lib/metrics.ts`, `src/lib/run-id.ts` — per-run `metrics.json`
  bookkeeping and run-id generation.
- `src/explore-mcp.ts` (`npm run explore:mcp`) / `src/generate-mcp.ts`
  (`npm run generate:mcp`) — the MCP condition's two phases. See
  `conditions/mcp/` for the exact prompts and `README.md` "How the
  comparison works" for why it's split this way.
- `src/run-cli.ts` (`npm run bench:cli`) — the CLI condition's single
  phase. Reuses `claude-runner.ts` + `mcp-tools-server.ts`, without
  `playwright-mcp` registered and with Claude Code's native `Bash`
  excluded from `--tools` (see `CLAUDE.md` decision 1). Not runnable yet:
  needs `fixtures/01-add-employee-leave-request.codegen.ts`, which hasn't
  been recorded (`TODO.md` Phase 2) — see `fixtures/README.md`.

Run `npm run seed` once per fresh app install before either condition.

## A known limitation of testing this from inside Claude Code

If you're driving this repo from a Claude Code session yourself (as
opposed to a plain terminal), that session cannot fully validate
`explore-mcp.ts`/`generate-mcp.ts` end to end on its own: Claude Code's
own auto-mode classifier blocks a session from spawning a
permission-bypassed *nested* session, which these scripts need
(`--dangerously-skip-permissions`, required for unattended tool use). Run
them from a plain terminal instead - see `TODO.md` Gotchas for what was
confirmed vs. not before hitting this.
