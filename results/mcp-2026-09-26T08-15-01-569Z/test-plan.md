# Test Plan: Add Employee + Assign Leave (OrangeHRM)

1. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee` (PIM → Add Employee page).
2. Generate a unique name suffix (e.g. current timestamp) and build a first name like `TestQA` and a last name like `Auto<timestamp>` so re-runs don't collide with existing data. Keep the full name (`"First Last"`) in a variable for later use.
3. Fill the "First Name" textbox (`getByRole('textbox', { name: 'First Name' })`) with the generated first name.
4. Fill the "Last Name" textbox (`getByRole('textbox', { name: 'Last Name' })`) with the generated last name. (Leave "Middle Name" and Employee Id untouched — Employee Id auto-populates.)
5. Click the "Save" button (`getByRole('button', { name: 'Save' })`).
6. Wait for the page to navigate to a URL matching `/pim/viewPersonalDetails/empNumber/` (or wait for the "Personal Details" heading/text to appear) — this confirms the employee was created successfully. This is the checkpoint for step 1.
7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave` (Leave → Assign Leave page — the administrative assignment flow, not "Apply").
8. Click/fill the "Employee Name*" autocomplete textbox (`getByRole('textbox', { name: 'Type for hints...' })`) and type the full name from step 2 (typing, not a single `.fill()` with no follow-up, since it must trigger the autocomplete network call).
9. Wait for the suggestion listbox option showing the full "First Last" name (`getByRole('option', { name: <fullName> })`) to appear, then click it to select the employee.
10. Click the "Leave Type*" custom dropdown (the div showing `-- Select --` next to the "Leave Type*" label) to open its option list.
11. Click the "Annual Leave" option (`getByRole('option', { name: 'Annual Leave' })`) from the opened listbox.
12. Click the "From Date*" textbox (`getByRole('textbox', { name: 'yyyy-mm-dd' }).first()`), then type a future weekday date in `yyyy-mm-dd` format (e.g. `2026-10-05`, a Monday — must not be a Saturday/Sunday). Press `Escape` afterward to dismiss the date-picker popup that opens on focus/typing.
13. Click the "To Date*" textbox (`getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(1)`), select all existing text (`Control+A` / `Meta+A`) to avoid the value being appended rather than replaced, then type the same date as step 12. Press `Escape` to dismiss the picker.
14. Click the "Assign" button (`getByRole('button', { name: 'Assign' })`).
15. A confirmation dialog titled "Confirm Leave Assignment" appears (new employees have no leave balance, so OrangeHRM warns "Employee does not have sufficient leave balance..."). Click its "Ok" button (`getByRole('button', { name: 'Ok' })`) to confirm.
16. Wait for the text "Successfully Saved" to become visible on the page (the toast notification). This is the reliable signal that the leave request was recorded (per app notes, the Leave List search itself is unreliable, so do not rely on it).
17. **Verify success**: assert that the "Successfully Saved" text/element is visible (e.g. `await expect(page.getByText('Successfully Saved')).toBeVisible()`), and optionally also assert that after step 6 the URL matched the personal-details pattern for the newly created employee, confirming both the employee-creation and leave-assignment steps succeeded.
