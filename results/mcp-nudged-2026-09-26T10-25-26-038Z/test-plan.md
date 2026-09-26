# Test Plan: Add Employee via PIM and Assign Leave

## Goal
Verify that a new employee can be created through PIM, then have a leave
request assigned to them through the Leave module's admin "Assign Leave"
flow, and that the assignment is confirmed successful.

## Steps

1. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee`
   (PIM > Add Employee page). Since the session is already authenticated,
   this loads the "Add Employee" form directly.

2. Generate a unique employee name for this run, e.g. by appending a
   timestamp/random suffix, so re-runs don't collide with existing data.
   Example: firstName = `TestFirst<uniqueId>`, lastName = `TestLast<uniqueId>`.

3. Fill the textbox with accessible name **"First Name"** with the
   generated first name.

4. Fill the textbox with accessible name **"Last Name"** with the
   generated last name.
   (Leave "Middle Name" and "Employee Id" untouched — Employee Id is
   auto-populated, e.g. "0002".)

5. Click the **"Save"** button.

6. Wait for the page to navigate to the employee's Personal Details view
   (URL changes to `/web/index.php/pim/viewPersonalDetails/empNumber/<n>`
   and the page shows text "Personal Details"). This confirms the
   employee was created.

7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave`
   (Leave > Assign Leave — the administrative "assign leave to someone
   else" page, not "Apply").

8. Click/fill the textbox with placeholder **"Type for hints..."** under
   the "Employee Name*" label, and type the generated first name (e.g.
   `TestFirst<uniqueId>`).

9. Wait for the autocomplete suggestion listbox to appear, then click the
   option whose accessible name is `"<firstName> <lastName>"` (the exact
   full name of the newly created employee) to select it.

10. Click the "Leave Type*" custom dropdown (the div showing
    `"-- Select --"` next to the "Leave Type*" label) to open its option
    list.

11. Click the option **"Annual Leave"** from the opened listbox (this is
    the only leave type configured in this environment).

12. Click into the "From Date*" textbox (accessible name `"yyyy-mm-dd"`,
    the first one on the page) and type a future weekday date in
    `yyyy-mm-dd` format, e.g. `2026-10-05` (a Monday). Avoid Saturdays/
    Sundays since weekend-only requests are rejected.

13. Click into the "To Date*" textbox (accessible name `"yyyy-mm-dd"`,
    the second one on the page). Select any existing text first (e.g.
    Ctrl/Cmd+A) before typing, because this field may get auto-populated
    after the From Date is set and a plain type() can append rather than
    replace. Type the same date, e.g. `2026-10-05`, to make it a single
    day request. If a date-picker calendar popup opens as a side effect,
    dismiss it by clicking its **"Close"** link/button.

14. Click the **"Assign"** button.

15. Because the new employee has no leave balance yet, the form will
    first re-render showing "Balance not sufficient" under "Leave
    Balance" and reveal a "Duration" field (defaulting to "Full Day").
    Click the **"Assign"** button a second time to actually submit.

16. A confirmation dialog appears titled **"Confirm Leave Assignment"**
    with the text "Employee does not have sufficient leave balance for
    leave request. Click OK to confirm leave assignment." Click the
    **"Ok"** button in this dialog to proceed.

17. Verify success by waiting for the text **"Successfully Saved"** to
    become visible on the page (this is the toast/notification OrangeHRM
    shows after a successful save). Assert that this text appears — this
    is the reliable signal per this environment's notes, since the Leave
    List search can be unreliable for showing newly-created requests.

## Success criteria
- Employee creation step ends on a Personal Details page (URL contains
  `pim/viewPersonalDetails`), confirming employee creation.
- After completing the Assign Leave flow and confirming the low-balance
  dialog, the "Successfully Saved" message is shown, confirming the leave
  request was recorded.
