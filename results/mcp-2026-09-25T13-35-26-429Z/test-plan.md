# Test Plan: Add Employee via PIM, then Assign Leave via Leave module

Goal: create a new employee with a unique name, assign them a single-day
future leave request via the admin "Assign Leave" screen, and verify the
assignment succeeded.

1. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee`
   (already-authenticated session; no login step needed). Wait for the
   "Add Employee" heading to be visible.

2. Generate a unique first/last name for this run (e.g. append
   `Date.now()` or a random suffix to fixed strings, such as
   `Testeragent` / `Autoqa<timestamp>`), and store both strings in
   variables for later reuse (employee full name and last-name suffix are
   needed to find the employee in the Leave module's autocomplete).

3. Fill the textbox with accessible name **"First Name"** with the
   generated first name.

4. Fill the textbox with accessible name **"Last Name"** with the
   generated last name.
   (Middle Name, photo upload, and Employee Id are left as-is/optional.)

5. Click the **"Save"** button.

6. Assert the page URL changes to match
   `/pim/viewPersonalDetails/empNumber/\d+/` (regex), confirming the
   employee record was created and the app redirected to the new
   employee's personal details page. This is the assertion for step 1
   (employee creation).

7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave`.
   Wait for the "Assign Leave" heading to be visible.

8. Click the textbox with placeholder **"Type for hints..."** (labelled
   "Employee Name*") and type the generated first name (e.g.
   `Testeragent`) into it.

9. Wait for a `role=option` matching the full generated name (e.g.
   `"Testeragent Autoqa<timestamp>"`) to appear in the autocomplete
   listbox, then click it. Assert the employee-name textbox now contains
   the full generated name (confirms correct employee selected).

10. Click the Leave Type dropdown control (the closed custom-dropdown
    `div` showing text **"-- Select --"**, immediately below the
    "Leave Type*" label). Wait for the `role=listbox` with leave-type
    `role=option`s to appear, then click on whichever real leave type
    option is present (e.g. `"Annual Leave"` — first non-"-- Select --"
    option in the listbox), so the test doesn't hard-depend on a specific
    seeded leave type name beyond what's actually configured.

11. Click the "From Date*" textbox (placeholder `yyyy-mm-dd`), press
    `Control+A` (select-all) to clear any existing text, then type a
    future date in `yyyy-mm-dd` format character-by-character (Playwright
    `pressSequentially`) — e.g. a date ~3 weeks from today. Press
    `Escape` to dismiss the date-picker popup afterward.

12. Click the "To Date*" textbox (placeholder `yyyy-mm-dd`, the second one
    on the page), press `Control+A` to select-all, then type the **same**
    date character-by-character (single-day leave request). Press
    `Escape` to dismiss the popup afterward.

13. Assert both date textboxes' values equal the intended date string
    (guards against the known duplication bug where a plain `.fill()`
    without a prior select-all leaves stale characters, e.g.
    `"2026-10-152026-10-15"`).

14. Click the **"Assign"** button.

15. A confirmation dialog appears ("Confirm Leave Assignment" — "Employee
    does not have sufficient leave balance for leave request. Click OK to
    confirm leave assignment.") because the brand-new employee has no
    entitlement yet. Click the **"Ok"** button in this dialog to proceed.
    (Wrap this in a conditional/soft wait since a dialog only appears when
    the balance is insufficient — an employee with sufficient balance
    would skip straight to success.)

16. Verify success: wait for and assert that a success toast is visible
    containing the text **"Successfully Saved"** (the toast shows a
    "Success" title paragraph and a "Successfully Saved" body paragraph).
    Treat this toast as the primary/authoritative success signal for the
    leave assignment, per known app behavior (a freshly-assigned leave
    request can fail to appear in Leave List search results even though
    it was saved correctly, so Leave List is not used as the sole
    verification here).

17. (Optional secondary/best-effort check, not required to pass): navigate
    to `http://localhost:8081/web/index.php/leave/viewLeaveList`, filter
    by the generated employee name and/or the assigned date range, click
    **Search**, and note whether a matching row appears — but do not fail
    the test if it doesn't, since this list is known to be unreliable for
    freshly-assigned requests in this build.

## Final success criteria for the test
The test passes if and only if:
- Step 6's URL assertion (`pim/viewPersonalDetails/empNumber/<N>`) passes, AND
- Step 16's assertion that the "Successfully Saved" toast became visible
  after clicking Assign (and confirming the balance dialog if shown)
  passes.
