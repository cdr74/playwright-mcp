# Test Plan: Add Employee + Assign Leave (OrangeHRM)

Goal: create a new employee via PIM, assign them a leave request via the
Leave module's admin "Assign Leave" screen, and verify success.

1. **Generate unique test data** before navigating anywhere: build a
   first name and last name using a timestamp/random suffix, e.g.
   `firstName = "TestAuto" + Date.now()` and
   `lastName = "QAUser" + Date.now()` (or a shared suffix), so re-runs
   never collide with existing employees.

2. **Navigate** to `http://localhost:8081/web/index.php/pim/addEmployee`.
   (No login step — context is already authenticated.)

3. **Fill the Add Employee form**:
   - Click/fill the textbox with accessible name **"First Name"** →
     type the generated first name.
   - Click/fill the textbox with accessible name **"Last Name"** →
     type the generated last name.
   - Leave Middle Name, photo upload, and the auto-filled Employee Id
     textbox untouched.

4. **Click** the **"Save"** button (`button` with accessible name
   `Save`).

5. **Assert employee creation succeeded**: wait for the URL to change to
   match `**/pim/viewPersonalDetails/empNumber/**` (Playwright
   `page.waitForURL` or `expect(page).toHaveURL(/viewPersonalDetails\/empNumber\/\d+/)`).
   Optionally also assert the page shows a heading/text "Personal
   Details" to confirm the redirect landed on the right screen.

6. **Navigate** to
   `http://localhost:8081/web/index.php/leave/assignLeave`.

7. **Select the employee**:
   - Click the textbox with placeholder/accessible name
     **"Type for hints..."** (this is the "Employee Name*" field).
   - Type the generated first name (e.g. just the first name string is
     enough to trigger the autocomplete).
   - Wait for and click the `role="option"` whose accessible name is
     `"<firstName> <lastName>"` — note the app renders this with **two
     spaces** between first and last name (empty middle name slot), so
     match flexibly, e.g. with a regex like
     `new RegExp(firstName + '\\s+' + lastName)` rather than a literal
     single-space string.

8. **Select a Leave Type**:
   - Click the custom dropdown control currently showing
     **"-- Select --"** next to the "Leave Type*" label (it is a
     `div`-based control, not a native `<select>` — locate it as the
     clickable element containing the text `-- Select --` near the
     "Leave Type*" label, or more simply via the accessible role
     structure: it's the element right before the `Leave Balance`
     block).
   - In the list of `role="option"` items that appears, click the option
     with the actual leave type name (observed on this instance:
     **"Annual Leave"**) — explicitly avoid clicking the first option in
     the list, since `"-- Select --"` is itself re-rendered as the first
     option and picking it leaves the field blank/invalid.

9. **Fill From Date**:
   - Click the textbox with accessible name **"yyyy-mm-dd"** under
     "From Date*" (first occurrence of that placeholder on the page).
   - Select all existing text (`Control+A` / `Meta+A`) then type a
     future weekday date character-by-character (Playwright
     `pressSequentially`), e.g. compute "next Monday" (or any date that
     is verified not to fall on Saturday/Sunday) relative to the current
     date, formatted as `yyyy-mm-dd`. Do not use a fixed hardcoded
     calendar date — compute it at runtime relative to `new Date()` so
     the test doesn't rot, while explicitly skipping Saturday/Sunday.
   - Dismiss the date-picker popup by clicking the **"Close"** text link
     that appears inside the picker (observed selector: text `Close`
     inside the popup that opens under the From Date field). Do not
     rely on `Escape` alone — the picker in this app does not always
     close on Escape.

10. **Fill To Date** the same way as step 9, using the same textbox
    (second occurrence of accessible name **"yyyy-mm-dd"**) and the
    same date, so this is a single-day leave request. Click its
    **"Close"** link to dismiss its picker too.

11. **Click** the **"Assign"** button (`button` with accessible name
    `Assign`).

12. **Handle the insufficient-balance confirmation dialog**: a dialog
    titled **"Confirm Leave Assignment"** with body text "Employee does
    not have sufficient leave balance for leave request. Click OK to
    confirm leave assignment." appears (expected for a brand-new
    employee with no entitlement yet). Click its **"Ok"** button
    (`button` with accessible name `Ok`) to proceed. (If this dialog
    does not appear because the environment already has balance set up,
    that's fine too — treat it as optional/conditional.)

13. **Verify success (primary signal)**: assert that the leave-request
    API call succeeds — either by watching for the toast text
    **"Successfully Saved"** to become visible right after step 12 (use
    a `waitFor`/`expect(...).toBeVisible()` with a short timeout, since
    it can disappear quickly), OR by asserting on the network response:
    wait for the `POST` request matching
    `**/api/v2/leave/employees/leave-requests` and assert its response
    status is `200` (confirmed via direct inspection: the response body
    contains `data.id`, `data.leaveType.name`, and `data.dateApplied`
    matching the date submitted). Prefer asserting on this network
    response as the ground-truth check, since the toast is visually
    fleeting.

14. **Secondary/best-effort verification**: navigate to
    `http://localhost:8081/web/index.php/leave/viewLeaveList`, and
    optionally search filtered by the employee name and/or date range,
    then check whether a matching row appears. Do **not** fail the test
    if `"No Records Found"` is shown here — this is a known/reproduced
    quirk in this build where a freshly-assigned leave request can be
    absent from this particular search even though it was saved
    correctly (confirmed via direct DB inspection during exploration).
    This step should only add an informational check, not be the
    deciding pass/fail assertion.

## How I'd verify overall success

The test passes if:
- The employee is created (URL redirects to
  `pim/viewPersonalDetails/empNumber/<N>` after Save), AND
- After clicking Assign → Ok, the `POST .../leave-requests` network
  response returns HTTP 200 (this is the authoritative confirmation that
  the leave request was recorded, since the UI toast is fleeting and the
  Leave List search view is known to be unreliable for freshly-created
  rows in this build).
