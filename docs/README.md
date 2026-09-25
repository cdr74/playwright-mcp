# docs/

Longer-form write-ups that don't belong in the top-level `README.md`:

- `app-knowledge.md` — the "tester knowledge" primer fed to both
  conditions' prompts: app navigation structure, exact fields/selectors
  for the flow's screens, and known app-level quirks. Gathered by actually
  exploring the running app, not guessed. See `README.md` "The tester
  knowledge assumption" for why this is fed in rather than left for the
  agent to discover.
- `verify-setup.md` — step-by-step manual check that the app + Playwright
  + Playwright MCP setup actually works, before building anything on top
  of it.
- `run-mcp-condition.md` — the reproducible runbook for the MCP condition:
  every command plus the exact composed system/user prompts sent to Claude
  Code for each phase, so different people running it get comparable
  results. Must be resynced whenever `conditions/mcp/*.md`,
  `docs/app-knowledge.md`, or the flow spec change — see that file's own
  header.
- `quality-rubric.md` (test-quality scoring criteria, `TODO.md` Phase 3)
  and eventual results write-ups (`TODO.md` Phase 4) — not written yet.
