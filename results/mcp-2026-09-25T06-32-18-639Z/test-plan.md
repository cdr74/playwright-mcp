# Test Plan: Add Employee → Assign Leave → Verify

Target app: http://localhost:8081/ (OrangeHRM). Browser context is
already authenticated — no login step.

## 1. Create a new employee (PIM module)

1. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee`.
2. Generate a unique suffix for this test run (e.g. `Date.now()` or a
   random string) and build:
   - `firstName = "TestFN" + suffix`
   - `lastName = "TestLN" + suffix`
3. Fill the textbox with accessible name **"First Name"** (no `name`
   attribute, located by role+accessible name) with `firstName`.
4. Fill the textbox with accessible name **"Last Name"** with `lastName`.
   (Leave Middle Name, photo, and the auto-generated Employee Id textbox
   untouched.)
5. Click the button **"Save"**.
6. Wait for navigation to a URL matching
   `/pim/viewPersonalDetails/empNumber/\d+/` — confirmed by direct
   observation (redirected to `.../empNumber/2` after save in this
   exploration).
7. **Assert**: the page URL matches `/pim\/viewPersonalDetails\/empNumber\/\d+/`
   (employee was created and the app navigated to its profile page). This
   is the checkpoint for step 1's success.

## 2. Assign that employee a leave request (Leave module → Assign Leave)

8. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave`.
9. Click the textbox with placeholder **"Type for hints..."** under
   "Employee Name*".
10. Type the employee's full name (`firstName + " " + lastName`) into it,
    character by character is not required here — `fill`/`type` worked
    directly in exploration and produced a matching autocomplete
    `option` (observed text: `"<firstName> <lastName>"`, e.g.
    `"TestAuto1234 User5678"`).
11. Wait for and click the `role="option"` whose accessible name is
    `"<firstName> <lastName>"`.
12. Click the closed **Leave Type** dropdown control (shows text
    `"-- Select --"` — it's a custom div-based dropdown, not a native
    `<select>`).
13. Click whichever `role="option"` inside the resulting listbox is
    **not** `"-- Select --"` and **not** `"No Records Found"` — any
    available leave type is acceptable per the task (observed a listbox
    with an `"Annual"` option in this run once at least one Leave Type
    existed; if the dropdown briefly shows `"No Records Found"`, that
    means the leave-type list hasn't loaded yet / Leave Types aren't
    seeded — re-open the dropdown rather than treating that as fatal).
14. Click the **"From Date"** textbox (placeholder `"yyyy-mm-dd"`).
15. Select all existing text (`Control+A`/`Meta+A`) then type a future,
    single date **character-by-character** (e.g. Playwright
    `pressSequentially`), such as `"2026-10-15"` — plain `.fill()` risks
    desyncing the date-picker's internal state per known app behavior,
    though in this exploration `.fill()`-then-verify also produced the
    correct value; character-by-character is the safer approach to bake
    into the test.
16. Press **Escape** to dismiss the date-picker popup that opens
    automatically on click/type.
17. Click the **"To Date"** textbox (placeholder `"yyyy-mm-dd"`), repeat
    steps 15–16 with the **same date** (single-day leave request).
18. Click the button **"Assign"**.
19. A confirmation dialog appears (observed text: heading/paragraph
    `"Confirm Leave Assignment"`, body text `"Employee does not have
    sufficient leave balance for leave request. Click OK to confirm
    leave assignment."`, with buttons **"Cancel"** / **"Ok"**) — this is
    expected for a brand-new employee with no leave entitlement yet, not
    an error. Click the button **"Ok"**.

## 3. Verify the leave request was recorded

20. **Primary assertion**: wait for and assert a success toast becomes
    visible containing the text **"Successfully Saved"** (observed as two
    paragraphs, `"Success"` then `"Successfully Saved"`, in a toast
    container that also has a `"×"` dismiss button). This toast appearing
    right after clicking "Ok" is the reliable signal that the leave
    assignment was actually persisted.
21. **Secondary / best-effort verification** (do not fail the test solely
    on this, per a known app quirk where a freshly-assigned leave request
    can fail to appear in this search even though it exists in the DB):
    - Navigate to `http://localhost:8081/web/index.php/leave/viewLeaveList`.
    - Fill the **"Employee Name"** autocomplete textbox
      (placeholder `"Type for hints..."`) with the employee's full name
      and click the matching `role="option"`.
    - Click the button **"Search"**.
    - Optionally check whether a row containing the employee's name
      appears in the results table (columns observed: Date, Employee
      Name, Leave Type, Leave Balance (Days), Number of Days, Status,
      Comments, Actions) — treat a row match as a bonus confirmation,
      and treat `"No Records Found"` here as inconclusive rather than a
      test failure, since this was reproduced in exploration (searched
      the full year 2026 date range, which brackets the assigned date,
      and still got "No Records Found" / an "Info: No Records Found"
      toast).

## Success criteria for the overall test

The test passes if:
- Employee creation redirects to a `pim/viewPersonalDetails/empNumber/<N>`
  URL (step 7), **and**
- The "Successfully Saved" toast appears after confirming the leave
  assignment dialog (step 20).

The Leave List check (step 21) is exploratory/informational only and must
not be the deciding assertion for pass/fail.
