# Quality rubric

Scoring criteria for the resulting test file each condition produces.
Applied manually for now (per-run, by reading the file and — where
possible — actually running it) — see `TODO.md` Phase 3 "Quality scorer"
for the eventual automated/LLM-judge pass.

Five of the seven criteria below are `CLAUDE.md` decision 2's original
list. **Criteria 6 and 7 are additions**, not part of the original agreed
axis list — flagging that explicitly per this repo's collaboration model:

- **Criterion 6 (task/spec compliance)** earned its place empirically:
  scoring the first two real runs (`docs/results.md`) surfaced a case
  where an incomplete implementation of the flow spec's "unique, generated
  first *and* last name" requirement directly caused measurable flakiness
  (criterion 3), and none of the original five criteria had a natural
  place to capture that root cause on its own terms.
- **Criterion 7 (config/data separation)** came from user-proposed
  criteria for larger test suites. Also has concrete evidence already:
  MCP's first-run test hardcodes the full absolute URL
  (`page.goto('http://localhost:8081/web/index.php/pim/addEmployee')`)
  while CLI's correctly uses a relative path
  (`page.goto('/web/index.php/dashboard/index')`) that respects
  `playwright.config.ts`'s `baseURL` — same config available to both,
  one test ignores it. Criterion 2 was also revised (not just extended)
  to fold in two more of those proposed practices — fail-fast checkpoint
  assertions and failure-diagnostic logging — rather than adding two more
  standalone criteria, since both are really about *how* a test asserts,
  not a separate axis.
- Not added: reusable functions **across a suite** — v1 scope is one flow
  → one generated file per run, not a suite (`CLAUDE.md` decision 4), so
  cross-file reuse isn't assessable yet. Criterion 5 already covers
  within-file structure. Revisit if the project grows to multiple flows.

Revert any of this if the reasoning doesn't hold up under more data.

Each criterion scores **0-4**. Total **/28** (5 original criteria /20 if
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

Does the test verify the outcomes the flow spec cares about **as it goes**
(fail fast, at the step that actually broke), not just at the very end —
and when it does fail, does it leave a maintainer enough to diagnose
without re-running?

- **4** — Every step the flow spec asks to be verified has a real
  `expect()` tied to that specific outcome, placed right after that step
  (not deferred to one giant assertion at the end) so a failure points at
  its actual cause; the primary success signal is asserted correctly per
  `docs/app-knowledge.md` guidance (toast, not Leave List search);
  secondary/best-effort checks are present and informative without being
  treated as failure conditions; failure paths leave real diagnostic
  context (a custom assertion message, a `console.log` at a meaningful
  branch point) rather than a bare Playwright timeout trace.
- **3** — Primary success signal asserted correctly at the right point;
  secondary verification present but shallow (fires the check, doesn't
  inspect the result); no real diagnostic logging beyond default output.
- **2** — Verification is end-loaded (e.g. one assertion at the very end
  covers what several intermediate checkpoints should have caught
  individually) — a failure early in the flow surfaces as a confusing
  failure late in the flow instead.
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

## 7. Config/data separation *(added, see note above)*

Does the test rely on config/fixtures the harness already provides, or
does it re-embed values that belong outside the test body?

- **4** — No hardcoded URLs, credentials, or environment specifics
  anywhere — navigation uses relative paths against `playwright.config.ts`'s
  `baseURL`; nothing re-derives a value (e.g. the target host) that's
  already available via config. Generated/varying test data (names,
  dates) is computed in the test, not copy-pasted literal values from
  whatever the agent happened to observe during exploration or the
  codegen recording it started from.
- **3** — One minor hardcoded value with low blast radius (e.g. a literal
  date format string) but no hardcoded environment/connection details.
- **2** — One substantive hardcoded value that duplicates what config
  already provides (e.g. the full absolute base URL baked into every
  `page.goto()` call) — works today, breaks silently the moment the
  config value it duplicates changes.
- **1** — Multiple hardcoded environment/connection values, or literal
  data values carried over from source material (a recording, an
  exploration snapshot) without being generalized.
- **0** — Credentials or environment-specific values hardcoded throughout,
  or the test would need manual editing to run against a different
  environment despite the harness already supporting that via config.
