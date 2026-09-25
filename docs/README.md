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
- `run-mcp-condition.md` / `run-cli-condition.md` — the reproducible
  runbooks for each condition: every command plus the exact composed
  system/user prompts sent to Claude Code, so different people running
  them get comparable results. Must be resynced whenever
  `conditions/{mcp,cli}/*.md`, `docs/app-knowledge.md`, the flow spec, or
  (for the CLI one) the codegen fixture change — see each file's own
  header.
- `results.md` — the first aggregated write-up of what's been run so far
  (currently one run per condition — see its own caveats section).
  `TODO.md` Phase 4 tracks turning this into a fuller report once more
  repeats exist.
- `quality-rubric.md` (test-quality scoring criteria, `TODO.md` Phase 3) —
  not written yet.
