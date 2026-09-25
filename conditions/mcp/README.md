# conditions/mcp/

Prompts for the **MCP condition**, run as two phases by
`harness/src/explore-mcp.ts` and `harness/src/generate-mcp.ts`:

- `explore-prompt.md` — phase 1: browser tools (Playwright MCP) + a
  scoped `write_file` tool. Explores the live app, writes `test-plan.md`.
  No code written in this phase.
- `generate-prompt.md` — phase 2: same tools + a scoped
  `run_playwright_test` tool. Turns the test plan into a real spec file
  and iterates on it until it passes (or gives up honestly).

Both are combined at runtime with the shared `docs/app-knowledge/`
primer and the target app's URL (from `TARGET_APP_URL`) as the system
prompt, passed to Claude Code via `--system-prompt` (a full replace, not
an append - keeps Claude Code's own default system prompt out of it).
Checked in as plain files (not embedded in code) so the exact prompt used
for any run is reviewable/diffable and prompt changes are a deliberate,
visible edit. See `docs/run-mcp-condition.md` for the exact, reproducible
commands and composed prompts, and `docs/results.md` for the numbers.
