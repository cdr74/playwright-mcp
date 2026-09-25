# conditions/cli/

Prompt and runner for the **CLI condition**, run as a single phase by
`harness/src/run-cli.ts` (`npm run bench:cli`). Reuses
`harness/src/lib/claude-runner.ts` + `harness/src/mcp-tools-server.ts`
(the same `write_file` / `run_playwright_test` tools the MCP condition
uses), driven via Claude Code exactly like the MCP condition — just with
`playwright-mcp` **not** registered, and Claude Code's native `Bash`
excluded from `--tools` (it's a general shell, not scoped to
`npx playwright test` — see `CLAUDE.md` decision 1). No live browser
visibility.

It starts from a checked-in `fixtures/` codegen recording (embedded
directly in the prompt — no read tool needed) and a `flows/` task spec,
and iterates on terse `run_playwright_test` output until the test is
clean and green.

`system-prompt.md` is the exact system prompt used, checked in so the run
is reproducible; combined at runtime with `docs/app-knowledge.md` and the
target URL, same pattern as `conditions/mcp/`.

Runnable now: `fixtures/01-add-employee-leave-request.codegen.ts` is
recorded (see `fixtures/README.md` for the exact steps taken and two
documented deviations from the flow spec) — `npm run bench:cli` end to
end hasn't happened yet, see `TODO.md`.
