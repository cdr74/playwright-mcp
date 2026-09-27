# Test Plan: Add Employee and Assign Leave (OrangeHRM)

Precondition: browser context is already authenticated as admin against http://localhost:8081/.

1. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee` (PIM → Add Employee page).
2. Generate a unique first/last name for this run (e.g. append `Date.now()` or a random string to a fixed prefix, such as first name `TestQA` and last name `Auto<uniqueSuffix>`), so re-runs don't collide with existing employee data.
3. Fill the "First Name" textbox (accessible name "First Name") with the generated first name.
4. Fill the "Last Name" textbox (accessible name "Last Name") with the generated last name (leave "Middle Name" blank).
5. Click the "Save" button.
6. Wait for navigation to the employee's Personal Details page (URL changes to `.../pim/viewPersonalDetails/empNumber/<N>`, and "Personal Details" text becomes visible) — this confirms the employee was created. Optionally capture the empNumber from the URL for reference.
7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave` (Leave → Assign Leave page).
8. Click the "Employee Name*" field, which is a textbox with placeholder/accessible name "Type for hints...".
9. Type the first few characters of the generated full name (e.g. "TestQA Auto<uniqueSuffix>" or just enough to be unique) slowly into that textbox to trigger the autocomplete.
10. Wait for the autocomplete listbox to show an option matching the full generated name (e.g. option with accessible name "TestQA Auto<uniqueSuffix>"), then click that option to select the employee.
11. Click the "Leave Type*" custom dropdown (the div showing "-- Select --" next to the "Leave Type*" label).
12. From the opened listbox, click the option "Annual Leave" (the only leave type configured in this environment).
13. Click the "From Date*" textbox (placeholder "yyyy-mm-dd", first occurrence) and type a future weekday date in `yyyy-mm-dd` format (e.g. "2026-09-29", a Tuesday) using slow/sequential typing so the input registers correctly.
14. Press "Escape" to dismiss the date-picker popup that appears after typing.
15. Verify the "To Date*" textbox (placeholder "yyyy-mm-dd", second occurrence) auto-populates with the same date (single-day leave request), since the app defaults To Date to match From Date. Press "Escape" again if a date-picker popup appears.
16. Click the "Assign" button.
17. A confirmation dialog titled "Confirm Leave Assignment" appears (since the new employee has no leave balance yet), with body text "Employee does not have sufficient leave balance for leave request. Click OK to confirm leave assignment." Click the "Ok" button in this dialog to proceed.
18. Verify success: wait for and assert that a toast/snackbar appears containing the text "Success" and "Successfully Saved" (this is the reliable success signal per app behavior notes; the Assign Leave form also resets its fields as a secondary indicator).
19. (Optional additional verification) Confirm the underlying API call succeeded: the POST request to `/web/index.php/api/v2/leave/employees/leave-requests` should have returned HTTP 200 with a JSON body containing `data.leaveType.name === "Annual Leave"` and `meta.empNumber` equal to the employee number captured in step 6.

## Success criteria
The test passes if:
- The employee is created (Personal Details page loads for the new employee after Save).
- The Assign Leave form accepts the employee, leave type, and date without validation errors.
- After confirming the low-balance dialog, the "Successfully Saved" success toast is displayed.
