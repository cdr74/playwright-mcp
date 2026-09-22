# conditions/cli/

Config and prompts for the **CLI condition** (not built yet — `TODO.md`
Phase 3). Will reuse `harness/src/lib/claude-runner.ts` +
`harness/src/mcp-tools-server.ts` (the same `write_file` /
`run_playwright_test` tools the MCP condition uses), driven via Claude
Code exactly like the MCP condition — just with `playwright-mcp` **not**
registered, and Claude Code's native `Bash` explicitly excluded from
`--tools` (it's a general shell, not scoped to `npx playwright test` —
see `CLAUDE.md` decision 1). No live browser visibility.

It starts from a checked-in `fixtures/` codegen recording (embedded
directly in the prompt, the same way the MCP condition's `generate` phase
gets its test plan — no read tool needed) and a `flows/` task spec, and
iterates on terse `run_playwright_test` output until the test is clean
and green.

`system-prompt.md` (to be written) is the exact system prompt used,
checked in so the run is reproducible.
