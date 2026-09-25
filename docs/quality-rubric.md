# Quality rubric

Scoring criteria for the resulting test file each condition produces.
Applied manually for now (per-run, by reading the file and — where
possible — actually running it) — see `TODO.md` Phase 3 "Quality scorer"
for the eventual automated/LLM-judge pass.

Five of the six criteria below are `CLAUDE.md` decision 2's original list.
**Criterion 6 (task/spec compliance) is a new addition**, not part of the
original agreed axis list — flagging that explicitly per this repo's
collaboration model. It earned its place empirically: scoring the first
two real runs (`docs/results.md`) surfaced a case where an incomplete
implementation of the flow spec's "unique, generated first *and* last
name" requirement directly caused measurable flakiness (criterion 3),
and none of the original five criteria had a natural place to capture
that root cause on its own terms. Revert this to five if that reasoning
doesn't hold up under more data.

Each criterion scores **0-4**. Total **/24** (5 original criteria /20 if
you want the number CLAUDE.md decision 2 originally implied).

## 1. Selector robustness

Role/label/testid-based locators vs brittle CSS/XPath.

- **4** — Exclusively `getByRole`/`getByLabel`/`getByTestId`/
  `getByPlaceholder`-with-accessible-semantics. No CSS selectors, no
  XPath, no `nth-child` chains.
- **3** — Predominantly role-based, with one or two justified exceptions
  (e.g. a CSS class locator for a genuinely non-semantic element, with a
  comment explaining why).
- **2** — A real mix of role-based and CSS/XPath locators, unjustified.
- **1** — Mostly CSS/XPath with a few role-based locators.
- **0** — Exclusively brittle CSS/XPath/positional locators.

## 2. Assertion meaningfulness

Does the test actually verify the outcomes the flow spec cares about, not
just "nothing threw"?

- **4** — Every step the flow spec asks to be verified has a real
  `expect()` tied to that specific outcome; the primary success signal is
  asserted correctly per `docs/app-knowledge.md` guidance (toast, not
  Leave List search); secondary/best-effort checks are present and
  informative without being treated as failure conditions.
- **3** — Primary success signal asserted correctly; secondary
  verification present but shallow (fires the check, doesn't inspect the
  result).
- **2** — Some steps only implicitly verified (relies on a later action
  throwing if an earlier one silently failed).
- **1** — Minimal assertions; mostly relies on the test runner's own
  errors rather than explicit checks.
- **0** — No meaningful assertions.

## 3. Pass reliability (flakiness) — measured, not guessed

Run the test **5 times in a row** (`--repeat-each=5 --workers=1`, serial
so app-state effects are attributable) against a live, freshly-seeded app,
and score the actual pass count:

- **4** — 5/5 passed.
- **3** — 4/5 passed.
- **2** — 3/5 passed.
- **1** — 1-2/5 passed.
- **0** — 0/5 passed.

Re-seed (`npm run seed`) immediately before measuring this — the saved
auth session can expire between when a test was generated and when you
come back to score it (see `TODO.md` Gotchas).

## 4. Playwright best practices

- **4** — No hard sleeps (`waitForTimeout`) anywhere in the final test;
  relies on auto-waiting / explicit `waitFor`/`expect(...).toBeVisible()`;
  sensible, not-excessive timeouts; no leftover debug code.
- **3** — One minor, explained deviation (e.g. a single justified
  explicit wait for a known async quirk).
- **2** — A couple of hard sleeps or redundant waits.
- **1** — Frequent hard sleeps or manual polling loops in place of
  auto-waiting.
- **0** — Relies primarily on fixed sleeps throughout.

## 5. Line count / structure

Not "shorter wins" — flag both bloat and unreadable compression.

- **4** — Concise and single-purpose; every line earns its place; any
  helper extraction improves readability without over-engineering a
  one-off test.
- **3** — Reasonable length, minor redundancy (e.g. one duplicated
  check).
- **2** — Noticeably verbose, or conversely cryptically terse in a way
  that hurts readability.
- **1** — Significant duplicated logic that should be factored out, or
  overly compressed logic.
- **0** — Excessive bloat or unreadable density.

## 6. Task/spec compliance *(added, see note above)*

Does the test actually implement what `flows/*.md` asked for, literally —
not just "a reasonable-looking test of roughly the right shape"?

- **4** — Fully implements every explicit requirement in the flow spec
  (e.g. "unique, generated first *and* last name" means both fields are
  actually generated, not one hardcoded).
- **3** — Meets the spirit of every requirement with one cosmetic gap.
- **2** — One substantive literal requirement not fully met (e.g. only
  one of two required fields is actually generated) — flag it even if the
  test still passes, since it can degrade over repeated runs in ways a
  single pass won't show.
- **1** — Multiple requirements not fully met.
- **0** — Materially diverges from the flow spec.
