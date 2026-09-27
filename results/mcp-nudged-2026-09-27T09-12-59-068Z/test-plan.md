# Test Plan: Add Employee via PIM + Assign Leave via Leave Module

## Goal
Create a new employee with a unique name in PIM, assign them a single-day
future leave request via the Leave module's admin "Assign Leave" flow, and
verify the request was recorded successfully.

## Steps

1. **Navigate** to `http://localhost:8081/web/index.php/pim/addEmployee`
   (the app is already authenticated, no login required).

2. **Generate unique names** before filling the form, e.g.
   `TestFirst<uniqueSuffix>` and `TestLast<uniqueSuffix>` (suffix built from
   `Date.now()` or similar) so re-runs don't collide with existing data.

3. **Fill** the "First Name" textbox (`getByRole('textbox', { name: 'First Name' })`)
   with the generated first name.

4. **Fill** the "Last Name" textbox (`getByRole('textbox', { name: 'Last Name' })`)
   with the generated last name.
   (Leave "Middle Name", "Employee Id", and "Create Login Details" checkbox
   untouched - not required for this flow.)

5. **Click** the "Save" button (`getByRole('button', { name: 'Save' })`).

6. **Wait** for navigation to the employee's Personal Details page (URL
   changes to `.../pim/viewPersonalDetails/empNumber/<N>`) and for the
   heading showing `"<FirstName> <LastName>"` to become visible - this
   confirms the employee was created. (Also confirmed: the "Personal
   Details" panel's "Employee Full Name*" First Name/Last Name textboxes
   are pre-filled with the values just entered.)

7. **Navigate** to `http://localhost:8081/web/index.php/leave/assignLeave`
   (Leave module's "Assign Leave" admin page).

8. **Fill** the "Employee Name*" autocomplete textbox
   (`getByRole('textbox', { name: 'Type for hints...' })`) by typing the
   generated first name (e.g. `TestFirst<suffix>`).

9. **Wait** for the suggestion listbox option showing
   `"<FirstName> <LastName>"` to appear, then **click** it
   (`getByRole('option', { name: '<FirstName> <LastName>' })`). This fills
   the employee name field and reveals the Leave Type dropdown options.

10. **Click** the "Leave Type*" custom dropdown (the div showing
    `"-- Select --"` next to the "Leave Type*" label) to open its option
    list.

11. **Click** the `"Annual Leave"` option
    (`getByRole('option', { name: 'Annual Leave' })`) - this is the only
    leave type configured in this environment.

12. **Type** a future weekday date in `yyyy-mm-dd` format (e.g.
    `2026-09-29`, a Tuesday) into the "From Date*" textbox
    (first `getByRole('textbox', { name: 'yyyy-mm-dd' })`). Typing
    character-by-character (`pressSequentially`/`slowly: true`) is required
    - a plain `fill` on the To Date field was observed to sometimes
    concatenate with pre-existing text and trigger a
    "Should be a valid date in yyyy-mm-dd format" validation error.

13. **Type** the same date into the "To Date*" textbox (second
    `getByRole('textbox', { name: 'yyyy-mm-dd' })`) to make it a single-day
    request. If a date-picker calendar popup opens, click its "Close" link
    to dismiss it before proceeding.

14. **Click** the "Assign" button (`getByRole('button', { name: 'Assign' })`).

15. Because the new employee has no leave balance, the app first shows an
    inline "Balance not sufficient" message under "Leave Balance" instead of
    submitting. **Click** "Assign" a second time to actually trigger the
    confirmation flow.

16. A dialog appears with heading "Confirm Leave Assignment" and text
    "Employee does not have sufficient leave balance for leave request.
    Click OK to confirm leave assignment." **Click** the "Ok" button
    (`getByRole('button', { name: 'Ok' })`) inside this dialog to confirm.

17. **Verify success** using the reliable signal specified in the app
    notes rather than the Leave List search (which is known to be
    unreliable):
    - Wait for a "Success" toast/notification to appear on the page
      (e.g. `page.getByText('Success')` becomes visible), AND/OR
    - Assert that the POST request to
      `**/api/v2/leave/employees/leave-requests` (triggered by the second
      "Assign" click) resolves with HTTP status 200, and that its JSON
      response body contains `data.leaveType.name === "Annual Leave"` and
      `data.dateApplied === "<the from-date used>"`.
    - Additionally assert the Assign Leave form has reset back to its
      empty state (Employee Name textbox and date fields cleared, Leave
      Type back to "-- Select --"), which is the UI's own confirmation
      that the assignment completed and the form is ready for a new entry.

## Notes / gotchas confirmed while exploring
- Employee/date fields are custom widgets: employee name is an
  autocomplete (type + pick suggestion), leave type is a custom dropdown
  (click to open, click option), dates are text inputs that must be typed
  in `yyyy-mm-dd` format rather than set via `fill`/value assignment.
- The app enforces weekday-only leave (weekends are rejected with "No
  Working Days Selected"), so the chosen date must be a Monday-Friday date
  in the future relative to "today".
- New employees always have 0.00 Day(s) balance, so the "Balance not
  sufficient" inline warning plus a follow-up confirmation dialog
  ("Confirm Leave Assignment" / "Ok" button) is expected and must be
  handled by clicking Assign twice (first shows the warning, second opens
  the confirm dialog) then clicking "Ok".
