# conditions/mcp/

Config and system prompt for the **MCP condition**: the agent gets
Playwright MCP tools (`browser_navigate`, `browser_snapshot`,
`browser_click`, etc.) plus a file-write tool, and explores the live target
app autonomously from a `flows/` task spec to author the final test file.

`system-prompt.md` (to be written, `TODO.md` Phase 3) is the exact system
prompt used, checked in so the run is reproducible.
