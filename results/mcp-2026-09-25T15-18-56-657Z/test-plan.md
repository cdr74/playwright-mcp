# Test Plan: Add Employee via PIM + Assign Leave via Leave module

Precondition: browser context is already authenticated. Leave Period and at
least one Leave Type ("Annual Leave") already exist (handled by seed step).

1. Generate unique test data up front: a timestamp-based suffix (e.g.
   `Date.now()`), then build `firstName = "TestQA" + suffix"` and
   `lastName = "AutoGen" + suffix"` (or similar), so re-runs never collide
   with existing employees. Also compute a future weekday date in
   `yyyy-mm-dd` format for the leave request (see step 10 note on avoiding
   weekends).

2. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee`.
   (This is the "Add Employee" form, reachable via the `PIM` sidebar link
   then the `Add` button on the Employee List — navigating directly to the
   URL is equivalent and faster.)

3. Fill the field with placeholder text `First Name` (an `input`, no
   `name`/`id` attribute — locate via
   `page.locator('input[placeholder="First Name"]')` or
   `getByRole('textbox', { name: 'First Name' })`) with the generated
   `firstName`.

4. Fill the field with placeholder text `Last Name`
   (`input[placeholder="Last Name"]`) with the generated `lastName`.
   (Leave Middle Name, photo upload, and the auto-generated Employee Id
   field untouched — they're optional.)

5. Click the `Save` button (`getByRole('button', { name: 'Save' })`).

6. Verify employee creation succeeded: wait for the URL to change to match
   `**/pim/viewPersonalDetails/empNumber/*` (confirmed observed redirect:
   `web/index.php/pim/viewPersonalDetails/empNumber/2`). This is the first
   assertion point.

7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave`
   (the "Assign Leave" admin flow — not `Leave → Apply`, which only
   applies leave for the logged-in user).

8. Click the Employee Name autocomplete field (placeholder
   `Type for hints...`, `input[placeholder="Type for hints..."]`) and type
   the `firstName` generated in step 1 (e.g. via `.fill()` — confirmed this
   triggers the autocomplete listbox to appear).

9. Wait for and click the matching option: `getByRole('option', { name:
   \`${firstName} ${lastName}\` })` — confirmed the option text is exactly
   `"<firstName> <lastName>"` with a single space in the *option* label
   (the input's value after selection renders as `"<firstName>  <lastName>"`
   with two spaces, but the option itself has one space — don't assert
   the option name with two spaces, only assert the post-selection input
   value that way if needed).

10. Click the Leave Type control (the element showing text `-- Select --`,
    e.g. `page.getByText('-- Select --').first()` scoped to the Leave Type
    section, or a locator keyed off the `Leave Type*` label's sibling).
    This opens a listbox where option index 0 is itself another
    `-- Select --` (the placeholder) — do **not** pick that one. Click the
    real option `getByRole('option', { name: 'Annual Leave' })` (confirmed
    present as a leave type in this environment).

11. Fill From Date: click the first `yyyy-mm-dd` textbox
    (`getByRole('textbox', { name: 'yyyy-mm-dd' }).first()`), press
    `Control+A` (or `Meta+A`) to select existing content, then type the
    future weekday date character-by-character (Playwright
    `pressSequentially`, i.e. `slowly: true`), then press `Escape` to
    dismiss the date-picker popup. Confirmed working with date
    `2026-09-28` (a Monday) — pick a date that is a Mon–Fri weekday
    relative to whenever the test runs, since weekend dates are rejected
    server-side.

12. Fill To Date the same way: click the second `yyyy-mm-dd` textbox
    (`getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(1)`), select-all,
    type the **same** date (single-day leave request), press `Escape`.

13. Click the `Assign` button (`getByRole('button', { name: 'Assign' })`).

14. Expect a confirmation dialog to appear (confirmed): a `dialog` with
    text `Confirm Leave Assignment` / "Employee does not have sufficient
    leave balance for leave request. Click OK to confirm leave
    assignment." — this is expected and fine for a brand-new employee with
    no entitlement yet. Click its `Ok` button
    (`getByRole('button', { name: 'Ok' })`).

15. **Primary success assertion**: wait for and assert the toast that
    appears after confirming. Confirmed observed toast contains a heading
    paragraph with text `Success` and a body paragraph with text
    `Successfully Saved` (e.g. assert
    `page.getByText('Successfully Saved')` becomes visible, or check for
    text `Success` via `expect(page.getByText('Success')).toBeVisible()`).
    This toast is the reliable signal that the leave request was recorded
    — per known app behavior, the Leave List search can fail to show a
    freshly-created row even though it was saved, so it should only be a
    secondary check.

16. Optional secondary check (best-effort, not required to pass): navigate
    to `http://localhost:8081/web/index.php/leave/viewLeaveList`, and
    either leave default filters or set the Employee Name filter to the
    generated employee, then click `Search`
    (`getByRole('button', { name: 'Search' })`). If a row appears, it's a
    nice-to-have extra confirmation; if `No Records Found` appears instead
    (confirmed this can legitimately happen even for a successfully-saved
    request), the test should not fail on this alone — rely on step 15's
    toast as the actual pass/fail criterion.

## Summary of how success is verified
- Employee creation: URL navigates to `pim/viewPersonalDetails/empNumber/<N>`
  after clicking Save.
- Leave assignment: the "Success" / "Successfully Saved" toast appears
  after clicking `Ok` on the balance-confirmation dialog following the
  `Assign` click.
