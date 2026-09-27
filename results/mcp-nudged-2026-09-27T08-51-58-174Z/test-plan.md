# Test Plan: Add Employee via PIM + Assign Leave via Leave Module

Base URL: http://localhost:8081/
Assumes the browser context is already authenticated as admin.

## Setup
- Generate a unique employee name once per test run, e.g. first name
  `TestQA` + last name `Playwright` + a timestamp/random suffix (so
  first name = `TestQA`, last name = `Playwright<uniqueSuffix>`), so the
  test can be re-run without colliding with existing employees.
- Compute a future weekday date (skip Saturday/Sunday) in `yyyy-mm-dd`
  format, e.g. take tomorrow's date and roll forward until
  `date.getDay()` is not 0 (Sunday) or 6 (Saturday).

## Steps

1. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee`.
2. Fill the textbox with accessible name **"First Name"** with the
   generated first name (e.g. `TestQA`).
3. Fill the textbox with accessible name **"Last Name"** with the
   generated unique last name (e.g. `Playwright<uniqueSuffix>`).
   (Leave "Middle Name" and "Employee Id" as default.)
4. Click the button named **"Save"**.
5. Wait for navigation to a URL matching
   `/pim/viewPersonalDetails/empNumber/`, and for the page to show a
   **"Personal Details"** heading/label. This confirms the employee was
   created.

6. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave`
   (the Leave module's "Assign Leave" screen — this is the admin
   assignment flow, distinct from "Apply").
7. Click the textbox with placeholder **"Type for hints..."** under the
   "Employee Name*" label, and type the full name
   `TestQA Playwright<uniqueSuffix>`.
8. Wait for the autocomplete `listbox`/`option` showing the matching
   full employee name to appear, then click that option to select the
   employee.
9. Click the "Leave Type*" custom dropdown (the element showing
   `"-- Select --"` next to the "Leave Type*" label) to open it, then
   click the option **"Annual Leave"** from the resulting listbox.
10. Click the "From Date*" textbox (placeholder `"yyyy-mm-dd"`), press
    `Ctrl+A`/`Cmd+A` to select any pre-filled text, then type the
    computed future weekday date (e.g. `2026-09-28`) using slow/
    sequential typing so the date-picker widget registers it correctly.
11. Click the "To Date*" textbox (the second `"yyyy-mm-dd"` textbox),
    press `Ctrl+A`/`Cmd+A` to clear any auto-filled value (the widget
    tends to copy the From Date into it, and typing without clearing
    first will append and produce an invalid duplicated string like
    `2026-09-282026-09-28`), then type the same date.
12. Click the button named **"Assign"**.
13. A confirmation dialog titled **"Confirm Leave Assignment"** appears
    (because a newly created employee has 0.00 day leave balance),
    with body text "Employee does not have sufficient leave balance for
    leave request. Click OK to confirm leave assignment." Click the
    button named **"Ok"** to confirm.

14. **Verify success:** wait for a toast/alert element (class
    `oxd-toast`, text content includes "Success" and
    "Successfully Saved") to become visible, and assert its text
    contains "Successfully Saved". This is the reliable signal that the
    leave request was recorded (confirmed during exploration: the
    corresponding `POST
    /web/index.php/api/v2/leave/employees/leave-requests` network
    request returns `200 OK` with a response body containing a new
    `data.id`, `data.leaveType.name === "Annual Leave"`, and
    `data.dateApplied` equal to the date that was submitted, and
    `meta.empNumber` equal to the new employee's employee number).

## Notes observed during manual exploration
- The Employee Name, Leave Type, and Date fields are all custom
  widgets, not native HTML `<select>`/inputs with simple `fill()`
  semantics — clicking the resulting option/listbox item is required
  after typing/opening.
- After a successful "Assign", the form resets (Employee Name, Leave
  Type, and both dates clear back to empty/"-- Select --"), which is a
  secondary indicator of success but the toast text is the primary
  assertion.
- Weekends are rejected ("No Working Days Selected"), so the chosen
  date must be a Monday–Friday.
- New employees start with 0.00 day leave balance, so the "Confirm
  Leave Assignment" dialog and its "Ok" button are always expected in
  this flow and must be handled.
