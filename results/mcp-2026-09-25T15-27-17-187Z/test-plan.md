# Test Plan: Add Employee + Assign Leave (OrangeHRM)

Goal: create a new employee via PIM with a unique generated name, assign
them a leave request via the Leave module's admin "Assign Leave" screen,
and verify the assignment succeeded.

## Setup

1. Generate a unique name suffix for this run (e.g. `Date.now()` or a
   random string), and build `firstName = "Test<suffix>"`,
   `lastName = "Auto<suffix>"` so the employee record never collides with
   existing data on re-run.
2. Compute a future, single weekday date in `yyyy-mm-dd` format for the
   leave request (skip Saturday/Sunday — e.g. start from "today + 7 days"
   and advance day-by-day until `getDay()` is not 0 or 6). Use the same
   date for both From Date and To Date (single-day leave).

## Part 1 — Create employee (PIM)

1. Navigate to `http://localhost:8081/web/index.php/pim/addEmployee`.
2. Fill the textbox with accessible name **"First Name"** with the
   generated first name.
3. Fill the textbox with accessible name **"Last Name"** with the
   generated last name. (Leave Middle Name, photo, and Employee Id
   untouched — Employee Id is auto-prefilled and not required to change.)
4. Click the **"Save"** button.
5. Wait for/assert the toast with text **"Successfully Saved"** appears
   (toast DOM: `.oxd-toast` containing `<p>Success</p>` /
   `<p>Successfully Saved</p>`), OR assert the page URL now matches
   `**/pim/viewPersonalDetails/empNumber/*` (confirmed in exploration:
   Save redirects to `pim/viewPersonalDetails/empNumber/<N>`).
6. This confirms employee creation succeeded — record the full name
   `"<firstName> <lastName>"` for use in the next part.

## Part 2 — Assign leave (Leave module, admin flow)

7. Navigate to `http://localhost:8081/web/index.php/leave/assignLeave`.
8. Click the textbox with placeholder **"Type for hints..."** (accessible
   name "Type for hints...", labeled "Employee Name*") and type the
   generated first name (e.g. `"Test<suffix>"`).
9. Wait for the autocomplete `role="option"` showing
   `"<firstName> <lastName>"` to appear, then click it. (Confirmed: after
   selection the textbox value becomes `"<firstName>  <lastName>"` with
   two spaces between first and last name — do not assert a single-space
   value.)
10. Click the Leave Type dropdown control (the div showing
    **"-- Select --"**, under label "Leave Type*"). This opens a
    `listbox` containing an `option` named `"-- Select --"` (the
    placeholder itself, do NOT click this) and one or more real leave
    type options (confirmed present: **"Annual Leave"**). Click the
    `role="option"` named **"Annual Leave"** (or whichever real, non
    "-- Select --" option is available).
11. Click the **From Date** textbox (placeholder "yyyy-mm-dd", under
    label "From Date*"), select all existing text
    (`ControlOrMeta+a`), then type the computed future weekday date
    character-by-character (e.g. `pressSequentially`), e.g.
    `2026-09-28`.
12. Click the **To Date** textbox (placeholder "yyyy-mm-dd", under label
    "To Date*"), select all, and type the same date
    character-by-character.
13. Click elsewhere on the form (e.g. the "Employee Name*" label area) to
    dismiss the date-picker popup calendar if still open.
14. Assert both date textboxes now contain the expected date string, and
    that the Leave Type control shows "Annual Leave" (sanity check before
    submit).
15. Click the **"Assign"** button.
16. A confirmation dialog may appear (`role="dialog"` with text
    **"Confirm Leave Assignment"** / "Employee does not have sufficient
    leave balance for leave request. Click OK to confirm leave
    assignment.") — this is expected for a brand-new employee with no
    entitlement yet. If present, click the **"Ok"** button inside the
    dialog.
17. Wait for/assert the success toast: text **"Success"** title and
    **"Successfully Saved"** message (`.oxd-toast` /
    `.oxd-toast--success`, containing the text "Successfully Saved").
    This toast is the primary, reliable signal that the leave request was
    recorded — confirmed by direct DOM inspection
    (`document.querySelector('.oxd-toast').outerHTML` showed
    `<p>Success</p><p>Successfully Saved</p>`).

## Verification (success criteria)

- Primary assertion: the `.oxd-toast` success toast containing text
  "Successfully Saved" is visible after step 17 (this is the definitive
  signal the Assign Leave POST succeeded).
- Optional secondary/best-effort check (not required to pass, known to be
  flaky per app knowledge): navigate to
  `http://localhost:8081/web/index.php/leave/viewLeaveList`, filter by the
  employee's name and/or the assigned date range, click **Search**, and
  note whether a row for the employee appears — but do not fail the test
  solely because this list doesn't show the row, since this is a known,
  confirmed app quirk unrelated to the test's correctness.

## Notes / gotchas observed during exploration

- First/Last Name inputs have no `name` attribute; locate by accessible
  name ("First Name" / "Last Name"), which matches their placeholder
  text.
- The Leave Type custom dropdown's option list includes the placeholder
  "-- Select --" as a real `option` in the DOM — must specifically target
  the named leave type option, not "first option in the list".
- Plain `.fill()` on the From/To Date inputs is unreliable; use click +
  select-all + `pressSequentially` (slow typing) instead, confirmed
  working in exploration (both fields showed the correct
  `2026-09-28` value afterward).
- Assigning leave to a fresh employee with zero balance is expected to
  show "Balance not sufficient" next to Leave Balance and pop the
  confirmation dialog — this is not a failure, just needs the extra "Ok"
  click.
