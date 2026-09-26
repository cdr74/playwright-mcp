# Test Plan: Add Employee via PIM, Assign Leave, Verify

1. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee` (PIM → Add Employee page).

2. Generate a unique first/last name for this run, e.g. using `Date.now()` or similar, so re-runs don't collide (for example `TestAuto<timestamp>` / `QATest<timestamp>`).

3. Fill the "First Name" textbox (accessible name `First Name`) with the generated first name.

4. Fill the "Last Name" textbox (accessible name `Last Name`) with the generated last name.
   - (Leave "Middle Name" and "Employee Id" untouched — Employee Id is auto-populated, e.g. `0002`, `0003`, etc.)

5. Click the "Save" button (accessible name `Save`).

6. Wait for navigation to the employee's Personal Details page (URL matches `/pim/viewPersonalDetails/empNumber/<n>`) and confirm the heading/text "Personal Details" is visible. This confirms the employee was created. Optionally capture the `empNumber` from the URL for later use, though it's not required for the rest of the flow since we re-select the employee by name.

7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave` (Leave → Assign Leave, the administrative assignment page — NOT "Apply").

8. Click/fill the "Employee Name*" input — accessible name `Type for hints...` — and type the generated first name (e.g. the same string used in step 3).

9. Wait for the autocomplete suggestion listbox option showing "`<first name> <last name>`" to appear, then click that option to select the employee.

10. Click the "Leave Type*" custom dropdown (the element showing text `-- Select --` next to the "Leave Type*" label). A listbox opens with options including `-- Select --` and `Annual Leave`.

11. Click the "Annual Leave" option to select it as the leave type.

12. Click the "From Date*" textbox (accessible name `yyyy-mm-dd`, the first one on the page) and type a future weekday date in `yyyy-mm-dd` format (e.g. compute a date roughly 2–3 weeks ahead and adjust forward if it lands on a Saturday(6) or Sunday(0), to guarantee a working day). Type it with the "slowly"/sequential-keys approach so the custom widget picks up the value (a plain single fill sometimes leaves stray characters or opens a date-picker overlay).
    - After typing, press `Escape` (or click "Close" in the date-picker popup if visible) to dismiss any calendar overlay before proceeding.

13. Click the "To Date*" textbox (accessible name `yyyy-mm-dd`, the second one on the page). Select all existing text (Ctrl/Cmd+A) and type the same date as the From Date, again typed sequentially, to avoid the field ending up with duplicated/concatenated text (observed issue: a plain `.fill()` after the picker auto-fills can result in the date being duplicated, e.g. `2026-10-122026-10-12`).
    - Press `Escape` to dismiss any calendar overlay.

14. Click the "Assign" button (accessible name `Assign`).

15. Because the new employee has no leave balance, a confirmation dialog appears: heading/paragraph text "Confirm Leave Assignment" with body text "Employee does not have sufficient leave balance for leave request. Click OK to confirm leave assignment." and buttons "Cancel" / "Ok". Click the "Ok" button (accessible name `Ok`) to proceed.

16. Verify success using the network response rather than relying on the Leave List search (which is known to be unreliable on this build): wait for the `POST` request to `**/api/v2/leave/employees/leave-requests` and assert its response status is `200` and the JSON body contains a `data` object with a numeric `id`, `leaveType.name` equal to `"Annual Leave"`, and `dateApplied` equal to the date used in steps 12–13. This is the reliable, deterministic signal that the leave request was recorded (confirmed by inspecting the actual network call during manual exploration: response body was `{"data":{"id":1,"leaveType":{"id":1,"name":"Annual Leave","deleted":false},"dateApplied":"2026-10-12"},"meta":{"empNumber":2},"rels":[]}`).
    - As a secondary/soft check, the Assign Leave form visibly resets (Employee Name, Leave Type, From/To Date fields go blank) after a successful assignment — this can be asserted as an additional signal but the network response is the primary assertion.

## Notes / gotchas observed during manual exploration
- Assigning leave to another employee must be done via **Leave → Assign Leave**, not **Apply** (Apply only applies leave for the logged-in user).
- Weekends are not working days; a leave request on a Saturday/Sunday only is rejected. The chosen date must be Mon–Fri.
- New employees start with 0.00 day leave balance, so the "insufficient balance" confirmation dialog will always appear for a freshly created employee — this must be handled by clicking "Ok".
- The date textboxes are custom widgets (not native `<input type="date">`); typing directly (character-by-character) into them works, but a single `.fill()` call can leave the calendar popup open and/or cause the "To Date" field to end up with duplicated text if a previous value/picker interaction wasn't cleared first. Select-all before typing into a field that may already have a stray value, and dismiss the calendar popup with `Escape` after each date is entered.
- The Leave List page's search is unreliable for confirming a just-created request, so the test should not depend on it; the API response after clicking "Assign"/"Ok" is the trustworthy verification point.
