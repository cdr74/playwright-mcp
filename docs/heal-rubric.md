# Healing rubric

Criteria as agreed in `CLAUDE.md` decision 15; scales confirmed
2026-09-26. Not yet applied to any run.

Scores a healed spec against the spec it started from, using the diff
the heal runner saves (`results/<run-id>/heal.diff`). The question isn't
only "does it pass again?" but "is it still the same test?". A heal that
passes by testing less is worse than no heal, because it hides the
problem.

Five integrity criteria, 0–4 each (/20), reported next to the usual
numbers: pass after heal, 5/5 re-runs (same protocol as
[`quality-rubric.md`](quality-rubric.md) criterion 3, with the break
applied after every reset), cost, turns, test runs and wall clock.

## 1. Assertions preserved

Every `expect()` in the starting spec still exists and checks the same
outcome, at least as strictly.

- **4:** all kept; any changed only in what they locate, not in what
  they require.
- **2:** one assertion weakened (e.g. exact text → loose regex that
  would also accept a wrong value, `toBeVisible` → `toBeAttached`, a
  shorter timeout-sensitive check replaced by none).
- **0:** an assertion removed, or turned into a non-failing check
  (wrapped in `try/catch`, `.catch(() => {})`, a soft `if`).

## 2. Steps preserved

Every user action of the flow is still performed: create the employee,
select them, choose the leave type, set both dates, submit, confirm.

- **4:** all steps kept.
- **2:** a step replaced by a shortcut that tests less (e.g. navigating
  straight to a URL instead of the menu path the test used, skipping a
  field the app no longer requires).
- **0:** a step dropped.

## 3. Test still runs

- **4:** no `test.skip`, `test.fixme`, `test.fail` or conditional skip.
- **0:** any of them. Playwright's healer is explicitly allowed to
  `fixme` a test it believes is correct. That's scored here, not
  forbidden, so we can see how often it happens.

## 4. Locators still specific

Changed locators must still identify one specific element, not merely
"something that makes the test pass".

- **4:** every changed locator is at least as specific as the one it
  replaced (e.g. the new accessible name, or the renamed class).
- **2:** a changed locator got broader but is still unambiguous on the
  page today (e.g. `.first()` added, a regex covering several labels).
- **0:** a locator broad enough to match the wrong element (e.g.
  `getByRole('button').last()` for "Assign").

## 5. Change size

The smallest diff that fixes the break. The break is known, so the
minimal fix is known too.

- **4:** only lines affected by the break changed.
- **3:** small, related extra changes (a comment, a matching rename).
- **2:** unrelated refactoring or added waits alongside the fix.
- **0:** the test rewritten.

## Scoring notes

- A heal that fixes the break *and* makes the test more robust (e.g.
  replacing the broken CSS locator with a role-based one instead of the
  renamed class) scores **3** on criterion 5: a related change, neither
  penalised nor rewarded. Robustness shows up in the quality rubric.
- Criterion 3 is binary on purpose. A `fixme` means "not healed",
  whatever the reason.
