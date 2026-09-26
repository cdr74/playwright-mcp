# Test Plan: Add Employee and Assign Leave

1. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee` (PIM → Add Employee page). The browser session is already authenticated.

2. Generate a unique first and last name for this run (e.g. append `Date.now()` or a random string), such as `First<unique>` / `Last<unique>`, so re-runs don't collide with existing employee data.

3. Fill the "First Name" textbox (accessible name "First Name") with the generated first name.

4. Fill the "Last Name" textbox (accessible name "Last Name") with the generated last name. (Leave "Middle Name" and the auto-populated "Employee Id" field untouched.)

5. Click the "Save" button.

6. Wait for navigation to a URL matching `**/pim/viewPersonalDetails/empNumber/*` — this confirms the employee record was created (the empNumber in the URL is assigned by the server).

7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave` (Leave → Assign Leave page).

8. Click the "Employee Name*" autocomplete textbox (placeholder/accessible name "Type for hints...") and type the generated first name (e.g. the same unique first name used above).

9. Wait for the suggestions listbox to appear and click the option whose accessible name is `"<firstName> <lastName>"` (exact full name generated in step 2) to select the newly created employee.

10. Click the "Leave Type*" dropdown (the custom widget showing "-- Select --"), wait for the listbox with options to appear, and click the "Annual Leave" option.

11. Click the "From Date*" textbox (accessible name "yyyy-mm-dd", first occurrence) and type a future weekday date in `yyyy-mm-dd` format (e.g. next Monday, computed relative to today so the test stays valid over time — avoid Saturday/Sunday since weekends have "No Working Days Selected").

12. Click the "To Date*" textbox (accessible name "yyyy-mm-dd", second occurrence). Before typing, clear any existing value (select all + delete, since a plain fill can append to an existing value here) then type the same future weekday date, making it a single-day request.

13. Dismiss the date-picker popover if it remains open by clicking its "Close" link, so it doesn't intercept the next click.

14. Click the "Assign" button.

15. Because the new employee has no leave balance yet, a confirmation dialog titled "Confirm Leave Assignment" appears with the text "Employee does not have sufficient leave balance for leave request. Click OK to confirm leave assignment." Click the "Ok" button in that dialog.

16. Assert success by waiting for the toast text "Successfully Saved" to become visible on the page. This is the reliable signal per app notes (the Leave List search/filter can be unreliable, so do not rely on finding the row there).

17. As an additional/backup assertion, verify that the POST request to `**/api/v2/leave/employees/leave-requests` (fired when clicking "Ok") completed with a 200 status — this can be captured via a `page.waitForResponse()` around the click on "Ok", asserting `response.ok()` is true.

18. End of test: both the "Successfully Saved" toast and the 200 response from the leave-requests POST confirm the leave request was recorded for the newly created employee.
