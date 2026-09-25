# Test Plan: Add Employee + Assign Leave (OrangeHRM)

Precondition: browser context is already authenticated; a Leave Period and
at least one Leave Type ("Annual Leave") already exist (seeded).

1. Generate a unique employee name for this run, e.g. first name
   `TestAuto` + a timestamp/random suffix, last name `Zeta` + the same
   suffix (so re-running the test never collides with existing employee
   records).

2. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee`.

3. Fill the textbox with accessible name/placeholder `First Name` with the
   generated first name.

4. Fill the textbox with accessible name/placeholder `Last Name` with the
   generated last name.

5. Click the `Save` button.

6. Assert success of employee creation: wait for the URL to match
   `**/pim/viewPersonalDetails/empNumber/*` (the redirect target after
   saving), confirming the employee record was created. Optionally also
   assert the page now shows a "Personal Details" heading/text.

7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave`.

8. Click the textbox with placeholder `Type for hints...` (Employee Name
   field) and type the generated full name (e.g. `TestAuto<suffix>
   Zeta<suffix>`), enough characters for the app to look up a match.

9. Wait for a `role=option` element containing the generated full name to
   appear in the resulting listbox, then click it to select the employee.

10. Click the closed Leave Type dropdown control (the element showing
    `-- Select --` text, not a native `<select>`).

11. Wait for the listbox of leave-type options to appear, then click the
    `role=option` named `Annual Leave` (or, more generally, the first
    option that isn't `-- Select --`, to stay agnostic of which leave
    types are configured).

12. Click the `From Date` textbox (placeholder `yyyy-mm-dd`), select all
    existing text (Ctrl/Cmd+A), then type a future date character-by-
    character (e.g. Playwright `pressSequentially`) such as
    `2026-10-15`. Press `Escape` to dismiss the date-picker popup.

13. Click the `To Date` textbox (placeholder `yyyy-mm-dd`) — it should
    auto-fill to the same date as From Date for a single-day leave request
    once From Date is set; if not already equal, repeat the select-all +
    type-character-by-character + `Escape` steps with the same date to
    keep it a single-day request.

14. Click the `Assign` button.

15. A confirmation dialog titled "Confirm Leave Assignment" appears
    (because the brand-new employee has no leave balance yet), with text
    "Employee does not have sufficient leave balance for leave request.
    Click OK to confirm leave assignment." Click the `Ok` button in this
    dialog to proceed. (Only handle this dialog if it appears — guard with
    a short wait/try so the test still works if a future run has a
    balance and skips the dialog.)

16. Verify success primarily via the underlying network response: wait
    for the `POST` request to
    `**/api/v2/leave/employees/leave-requests` and assert its response
    status is `200`/ok. This was confirmed to be the actual save call
    triggered by clicking Assign.

17. As a secondary UI-level check, wait briefly for the Assign Leave form
    to reset (the Employee Name field becomes empty and Leave Type
    reverts to `-- Select --`), which only happens after a successful
    save — assert the Employee Name textbox value is empty afterward.

18. (Best-effort only, not required for pass/fail) Optionally navigate to
    `http://localhost:8081/web/index.php/leave/viewLeaveList`, filter by
    the generated employee name, click `Search`, and log/soft-check
    whether the row appears — per known app behavior this can legitimately
    show "No Records Found" even for a successfully saved request, so do
    not fail the test solely on this check.

**Primary success criteria for the test's final assertion:** the
`POST /api/v2/leave/employees/leave-requests` network response has an ok
status (2xx), confirming the leave assignment was recorded — this is more
reliable than relying on a toast that can disappear before it's queried,
or on the Leave List search which is known to be flaky in this build.
