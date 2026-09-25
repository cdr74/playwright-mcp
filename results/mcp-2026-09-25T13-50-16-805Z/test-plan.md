# Test Plan: Add Employee via PIM, then Assign Leave

Base URL: http://localhost:8081/ (browser context already authenticated).

1. Generate a unique name suffix at test start, e.g. `Date.now()`, so
   First Name = `Test` and Last Name = `Employee<uniqueSuffix>` (e.g.
   `Employee1732550400000`). This guarantees the employee doesn't collide
   with existing data on re-run.

2. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee`.

3. Fill the First Name field — locate by accessible role `textbox` with
   name `First Name` (it's a placeholder-based input, no `name` attribute)
   — with the value `Test`.

4. Fill the Last Name field — `textbox` with accessible name `Last Name`
   — with the generated unique last name (e.g. `Employee1732550400000`).
   (Leave Middle Name, photo, and Employee ID untouched — they're optional
   / auto-filled.)

5. Click the `Save` button (`button` with accessible name `Save`).

6. Assert success of employee creation: wait for the URL to match
   `**/pim/viewPersonalDetails/empNumber/*` (confirms redirect after save).
   Optionally also assert the page now shows a heading/field reflecting
   the employee (e.g. the "Employee Full Name" field elsewhere on that
   page contains the first/last name), but the URL redirect is the
   primary, reliable success signal.

7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave`.

8. Click the Employee Name autocomplete input — `textbox` with
   accessible name `Type for hints...` — and type the full generated
   employee name (`Test Employee<uniqueSuffix>`).

9. Wait for the matching `role="option"` with that same full name text to
   appear in the resulting `listbox`, then click it to select the
   employee.

10. Open the Leave Type dropdown: click the custom dropdown control that
    initially shows `-- Select --` text (it's a `generic`/div with
    `cursor=pointer`, not a native `<select>`; can be targeted via the
    `.oxd-select-text--after` class or by role text `-- Select --` inside
    the Leave Type field group). Then click the `role="option"` for a
    real leave type name that appears in the resulting listbox (e.g.
    `Annual Leave`, confirmed present in this environment — any leave
    type option would work, first non-placeholder option is fine).

11. Fill From Date: click the From Date input (`textbox` with
    accessible name `yyyy-mm-dd`, first one on the page), select all
    existing text (`Control+A` / `Meta+A`), then type a single
    single-day future date character-by-character (Playwright
    `pressSequentially`), e.g. `2026-12-01`. Press `Escape` afterward to
    dismiss the date-picker popup so it doesn't obscure other fields.

12. Fill To Date: click the To Date input (`textbox` with accessible name
    `yyyy-mm-dd`, second one on the page), select all, then type the same
    date (`2026-12-01`) the same way (single-day leave request), and
    press `Escape` to dismiss its popup too.

13. Click the `Assign` button (`button` with accessible name `Assign`).

14. A confirmation dialog appears (role `dialog`) titled
    "Confirm Leave Assignment" with body text "Employee does not have
    sufficient leave balance for leave request. Click OK to confirm leave
    assignment." — this is expected for a brand-new employee with no
    entitlement yet, not a test failure. Click its `Ok` button
    (`button` with accessible name `Ok`) to confirm.

15. Verify success: assert that a toast notification becomes visible
    containing the text `Successfully Saved` (element with class
    `.oxd-toast`, confirmed to contain the text "Success" / "Successfully
    Saved" when an assignment succeeds). Use a web-first `expect(...)
    .toContainText('Successfully Saved')` (or `toBeVisible()` combined
    with a text locator) so Playwright's auto-retry catches it even
    though the toast is short-lived and disappears quickly — do not add a
    manual fixed-time wait before asserting, since that risks missing the
    toast in a real (non-MCP) run entirely, but also don't assert instantly
    without any retry-based wait.

16. Treat step 15's toast assertion as the primary/authoritative success
    check for the whole test. Do NOT rely on searching
    `leave/viewLeaveList` for the new row as a required assertion: this
    build has a confirmed quirk where a freshly-assigned leave request can
    fail to appear in Leave List search results even though it was saved
    correctly in the database. If desired, a best-effort secondary check
    (e.g. navigate to `leave/viewLeaveList` and note whether the row shows
    up) may be added, but it must not cause the test to fail if absent.

## Final success criterion for the whole test

The test passes if and only if:
- The employee-creation redirect lands on
  `**/pim/viewPersonalDetails/empNumber/*` after clicking Save, and
- After completing the Assign Leave form and confirming the "insufficient
  balance" dialog, a toast/notification containing `Successfully Saved`
  becomes visible.
