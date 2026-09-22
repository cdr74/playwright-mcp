# conditions/cli/

Config and system prompt for the **CLI condition**: the agent gets file
read/write plus a shell tool scoped to `npx playwright test` — no live
browser visibility. It starts from a checked-in `fixtures/` codegen
recording and a `flows/` task spec, and iterates on terse test-run output
until the test is clean and green.

`system-prompt.md` (to be written, `TODO.md` Phase 3) is the exact system
prompt used, checked in so the run is reproducible.
