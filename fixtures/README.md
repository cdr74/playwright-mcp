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

## Fixture: `01-add-employee-leave-request.codegen.ts` — not recorded yet

This is the one thing currently blocking `npm run bench:cli`
(`harness/src/run-cli.ts` reads it and fails with a clear error until it
exists). It has to be recorded by a human driving a real headed browser —
codegen listens to actual browser interaction, and a hand-written
"equivalent" script would defeat the point (the CLI condition is supposed
to start from genuinely raw, unpolished codegen output, brittle selectors
and all, not clean code).

**How to record it:**

```bash
npm run setup:app && npm run seed   # fresh, known app state first
npx playwright codegen http://localhost:8081
```

Log in as `Admin` / `PwMcpBench#2026` (yes, record the login too — codegen
doesn't know about the harness's saved auth state; that's fine, it's raw
material, not the final test), then perform the same flow
`flows/01-add-employee-leave-request.md` describes:

1. **PIM → Add** (Employee List) → fill **First Name** / **Last Name**
   with anything (e.g. `CodegenFN` / `CodegenLN` — the agent will
   generalize this into a unique generated name later, don't worry about
   collisions) → **Save**.
2. **Leave → Assign Leave** (not **Apply** — see `docs/app-knowledge.md`
   for why that distinction matters) → type the employee's name into
   **Employee Name** and click the matching autocomplete option → open
   the **Leave Type** dropdown and pick any option → click **From Date**
   and **To Date** and enter the same near-future date in each (the
   date-picker popup may make this fiddly to record cleanly — that's
   expected, it's exactly the kind of brittle interaction the CLI
   condition's agent has to clean up) → **Assign** → click **Ok** on the
   confirmation dialog (expected for a zero-balance employee).
3. Optionally also record checking **Leave → Leave List** for the new
   entry, matching the flow spec's verification step — but per the known
   quirk in `docs/app-knowledge.md`, don't worry if it doesn't show up.

Close the codegen window when done. Save the generated script, unedited,
to `fixtures/01-add-employee-leave-request.codegen.ts`, then fill in below:

- **Recorded by:**
- **Date:**
- **Playwright version:** (`npx playwright --version`)
- **Deviations from the steps above, if any:**
