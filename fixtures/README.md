# fixtures/

Checked-in `playwright codegen` recordings that seed the CLI condition.

Each fixture is produced **once, deterministically, with zero LLM tokens**
by a human running `npx playwright codegen <target-url>` and performing the
matching flow from `flows/` by hand. This models the fact that a CLI user
starts from their own recording, the same way an MCP-driven agent gets to
look at the live page.

For reproducibility, this file must document, per fixture, the exact
click-by-click steps taken during recording, the Playwright version used,
and the date recorded — so anyone can re-record it if the target app
changes. See `TODO.md` Phase 2.
