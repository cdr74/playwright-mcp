# Testing best practices

Practice-level guidance, not the scoring rubric itself — this is what an
agent gets told; `docs/quality-rubric.md` is what an agent gets scored
against afterward. The two are kept deliberately close (each item below
maps to one rubric criterion) so scoring never penalizes an agent for
something it was never told mattered.

**Wired in, opt-in, symmetric.** Set `NUDGE_QUALITY=1` (or use the
`*:nudged` npm scripts: `explore:mcp:nudged` + `generate:mcp:nudged` for
the MCP condition, `bench:codegen:nudged` for Codegen) and this file gets
appended to the system prompt of whichever phase actually writes
Playwright code - `generate-mcp.ts` and `run-codegen.ts`, not
`explore-mcp.ts`, since that phase only writes a prose test plan and this
guidance is entirely about code craftsmanship. Applied identically to
both conditions' code-writing phase, the same symmetry
`docs/app-knowledge/` already relies on (`CLAUDE.md` decision 1).
`explore-mcp.ts` still needs `NUDGE_QUALITY` set too, purely to mint a
`RUN_ID` with the matching `mcp-nudged-` prefix that `generate-mcp.ts`
later reuses - `generate-mcp.ts` warns loudly if the two ever disagree.

Baseline (no flag) vs. nudged results haven't been compared yet - see
`TODO.md` for that still-open piece of the baseline-vs-nudged decision.

---

When writing the test, follow these practices:

**Use accessible, role-based locators.** `getByRole`, `getByLabel`,
`getByTestId`, `getByPlaceholder` with a real accessible name - not CSS
classes, XPath, or `nth-child` chains. If the app genuinely has no
accessible way to reach an element, that's worth a comment explaining why
you fell back to something else, not a silent CSS selector.

**Assert as you go, not just at the end.** After each meaningful step,
verify the specific outcome that step was supposed to produce - a
successful navigation, a value that should have taken effect, a dialog
that should have appeared - before moving on to the next step. A test
that only asserts once, at the very end, turns every failure into "step 7
of 7 failed," which tells a maintainer nothing about which of the
preceding six steps actually broke. Fail at the step that's actually
wrong, not several steps later.

**Leave real diagnostic context on failure.** When something might
legitimately not happen (a confirmation dialog that only appears
sometimes, a secondary check that's known to be unreliable), log *why*
you're treating it as non-fatal, specifically, not just silently
swallowing it. A future maintainer reading a failure should be able to
tell what happened without re-running the test themselves.

**Don't hardcode what the run configuration already provides.** The
target application's base URL is already configured
(`playwright.config.ts`'s `baseURL`) - navigate with relative paths
(`page.goto('/web/index.php/...')`) or by clicking through the UI, not by
re-embedding the full absolute URL in every navigation call. The same
goes for anything else already supplied to you (the authenticated session,
credentials) - if it's already handled, don't re-derive or re-enter it.

**Generate the data the task asks you to generate - all of it.** If asked
for a unique, generated value, generate it; don't leave one field as a
literal value carried over from whatever example or recording you started
from and only generate the other. A value that looks unique enough to
pass once can still collide or degrade in selectivity the more times the
test is actually run.

**Factor out real repetition, don't invent structure for a one-off.** If
the same non-trivial interaction (e.g. a specific date-picker workaround)
happens more than once, pull it into a named helper function with a
comment explaining *why* it's needed, not just what it does. Don't split
a genuinely linear, one-shot test into abstractions it doesn't need
either - a single well-organized test function is often the right amount
of structure for a single flow.

**No hard sleeps.** Rely on Playwright's auto-waiting and explicit
`waitFor`/`expect(...).toBeVisible({ timeout })` for anything that
appears asynchronously. `waitForTimeout` is a last resort, and if you do
reach for it, say why in a comment.
