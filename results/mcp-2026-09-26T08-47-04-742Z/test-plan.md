# Test Plan: Add Employee + Assign Leave (OrangeHRM)

1. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee` (PIM → Add Employee page). The browser session is already authenticated, so this loads directly into the "Add Employee" form.

2. Generate a unique first/last name for this run (e.g. append `Date.now()` or a random string), such as `Test<unique>` / `Auto<unique>`, so re-runs don't collide with existing employee data.

3. Fill the "First Name" textbox (accessible name "First Name") with the generated first name.

4. Fill the "Last Name" textbox (accessible name "Last Name") with the generated last name. (Leave "Middle Name" and the auto-populated "Employee Id" field untouched.)

5. Click the "Save" button.

6. Wait for/assert the page navigates to a URL matching `/pim/viewPersonalDetails/empNumber/<n>` and that the "Personal Details" heading/section becomes visible — this confirms the employee was created successfully. Capture the empNumber or just rely on the name for the next step.

7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave` (Leave → Assign Leave page).

8. Click the "Employee Name*" autocomplete textbox (placeholder/accessible name "Type for hints...") and type the generated first name (e.g. `Test<unique>`).

9. Wait for the autocomplete suggestion listbox to show an option whose accessible name is `"<firstName> <lastName>"` (e.g. "Test<unique> Auto<unique>"), then click that option to select the employee.

10. Click the "Leave Type*" custom dropdown (the div showing "-- Select --" next to the "Leave Type*" label). Wait for the listbox with options to appear, then click the "Annual Leave" option.

11. Click the "From Date*" textbox (placeholder "yyyy-mm-dd", the first one on the page) and type a future weekday date in `yyyy-mm-dd` format, typed character-by-character (e.g. use `slowly`/`pressSequentially`) — e.g. `2026-09-28` (a Monday). Note: typing opens a date-picker popup; it does not need to be explicitly closed before continuing, but the popup for the "From Date" should be dismissed (e.g. by clicking its "Close" link) before interacting with the "To Date" field to avoid an intercepted click.

12. Click the "To Date*" textbox (the second "yyyy-mm-dd" textbox). Since this field auto-fills once "From Date" is set to a valid weekday, first select all existing text (Ctrl+A) and then type the same date (`2026-09-28`) character-by-character to overwrite it cleanly (avoids the field ending up with duplicated/concatenated date text). Close the resulting date-picker popup via its "Close" link.

13. Verify a "Duration" field with value "Full Day" appears — this confirms a valid single working day was selected (a weekend date would instead produce a "No Working Days Selected" error and no Duration field).

14. Click the "Assign" button.

15. A confirmation dialog titled "Confirm Leave Assignment" appears (because the new employee has no leave balance), with text "Employee does not have sufficient leave balance for leave request. Click OK to confirm leave assignment." Click the "Ok" button in this dialog.

16. Verify success: wait for a toast/message containing the text "Successfully Saved" to become visible. This is the reliable success signal per app notes (the Leave List search is unreliable on this build, so do not rely on searching the list as the primary check).

17. As a final/secondary assertion, confirm the Assign Leave form has reset to its empty state (Employee Name field cleared back to placeholder "Type for hints...", Leave Type back to "-- Select --"), which additionally indicates the submission completed and the page returned to a fresh assign-leave form.

## Success criteria
The test passes if all of the following hold:
- Employee creation redirects to a `viewPersonalDetails` URL (employee was created).
- The newly created employee's name is selectable from the Assign Leave autocomplete.
- After filling Leave Type "Annual Leave", a future weekday date, and confirming the insufficient-balance dialog, a "Successfully Saved" message is shown.
