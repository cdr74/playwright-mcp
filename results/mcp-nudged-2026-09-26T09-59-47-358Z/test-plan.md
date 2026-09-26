# Test Plan: Add Employee + Assign Leave (OrangeHRM)

1. Generate a unique identifier for this run (e.g. a timestamp string) and
   build `firstName = "TestQA"` and `lastName = "Auto" + uniqueId` so the
   test can be re-run without colliding with existing employee records.

2. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee`
   (Add Employee page inside the PIM module).

3. Fill the **First Name** textbox (accessible name "First Name") with
   the generated first name.

4. Fill the **Last Name** textbox (accessible name "Last Name") with the
   generated last name. (Leave Middle Name and Employee Id at their
   defaults.)

5. Click the **Save** button (accessible name "Save").

6. Wait for/assert that the page navigates to a URL matching
   `**/pim/viewPersonalDetails/empNumber/**` and that the text
   "Personal Details" is visible — this confirms the employee was created
   and the app redirected to their profile.

7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave`
   (Leave module's "Assign Leave" administrative page — not "Apply").

8. Click the **Employee Name*** autocomplete textbox (accessible name
   "Type for hints...") and type the full generated name
   (`"TestQA Auto" + uniqueId`).

9. Wait for the suggestion listbox to appear and click the option whose
   accessible name matches the full generated name (role `option`,
   name equal to the typed full name) to select the employee.

10. Click the **Leave Type*** custom dropdown (the generic element next
    to the "Leave Type*" label, showing placeholder text "-- Select --")
    to open its option list.

11. Click the **"Annual Leave"** option (role `option`, name "Annual
    Leave") from the opened list — this is the only leave type
    configured in this environment.

12. Click the **From Date*** textbox (accessible name "yyyy-mm-dd", the
    first of the two date fields) and type a future weekday date in
    `yyyy-mm-dd` format (e.g. `2026-10-05`, a Monday — confirmed not a
    weekend). Then close the date-picker popup by clicking its "Close"
    link/button so it doesn't obscure the next field.

13. Click the **To Date*** textbox (accessible name "yyyy-mm-dd", the
    second date field) and type the same date (`2026-10-05`) to make it
    a single-day request. Close the date-picker popup the same way.

14. (Optional/observed) Note that the "Leave Balance" panel will show
    "Balance not sufficient" since the new employee has no entitlement
    yet — this is expected and does not block assignment.

15. Click the **Assign** button (accessible name "Assign").

16. A confirmation dialog appears titled "Confirm Leave Assignment" with
    body text "Employee does not have sufficient leave balance for leave
    request. Click OK to confirm leave assignment." Click its **Ok**
    button (accessible name "Ok") to proceed.

17. Assert that the text **"Successfully Saved"** becomes visible on the
    page shortly after confirming — this is the reliable signal that the
    leave request was recorded (per app notes, the Leave List search
    itself is flaky, so this toast is the success check to use).

## Success verification
The test passes if, after step 17, the "Successfully Saved" message is
visible on the page. This confirms both that the employee (with the
unique generated name) was created via PIM and that a single-day, future,
weekday Annual Leave request was successfully assigned to them via the
Leave → Assign Leave administrative flow.
