# App knowledge (fed to both conditions)

A real tester assigned to test OrangeHRM wouldn't start from zero — they'd
already know roughly how the app is laid out. Giving the agent the same
baseline is only fair, and also keeps exploration from burning tokens
rediscovering things like "where is the employee form" from scratch. This
doc is written into both conditions' prompts (see `conditions/mcp/` and
`conditions/codegen/`) verbatim.

Gathered by direct exploration of the running instance (Playwright script
against `app/install.sh`'s output) during harness development — not
guessed. See `TODO.md` for how the discoveries below shaped the flow.

## What OrangeHRM is

A standard HR management web app: employee records (PIM module), leave
management (Leave module), time tracking, recruitment, etc. It's a
Vue.js single-page app — all navigation is client-side after the initial
page load, so a locator/snapshot taken right after `goto()` on a deep link
may need a short settle before content appears.

## Navigation

Left sidebar, top-level items: **Admin, PIM, Leave, Time, Recruitment,
My Info, Performance, Dashboard, Directory, Maintenance, Claim, Buzz**.
Clicking a top-level item routes client-side; the Leave module additionally
has its own top sub-nav once inside it: **Apply, My Leave, Entitlements,
Reports, Configure, Leave List, Assign Leave**.

## PIM → Add Employee

`PIM` → `Add` button on the Employee List → form at
`web/index.php/pim/addEmployee`.

- Required fields: **First Name**, **Last Name** (plain text inputs, no
  `name` attribute — locate by placeholder text `First Name` / `Last Name`).
  Middle Name, employee photo upload, and an auto-generated Employee ID are
  optional/prefilled.
- **Save** creates the employee and redirects to
  `pim/viewPersonalDetails/empNumber/<N>`.

## Leave → Assign Leave (admin assigns leave on behalf of an employee)

This is the right screen for "assign leave to a specific employee" —
**not** `Leave → Apply`, which is self-service and only applies leave for
whichever user is currently logged in (`Admin`/`Bench Admin` in our seeded
account), not an arbitrary employee.

`web/index.php/leave/assignLeave` fields:

- **Employee Name** — autocomplete, type a few letters then click the
  matching `role="option"` (placeholder text is `Type for hints...`).
  Once an employee is selected, the input's value is rendered as
  **`"First  Last"` — two spaces**, where the (empty) middle name would
  go. Don't assert the selected value as `"First Last"` with one space.
- **Leave Type** — a custom dropdown (not a native `<select>`); click the
  closed control (shows `-- Select --` until chosen), then click the
  `role="option"` with the leave type name. **The `-- Select --`
  placeholder is itself rendered as one of the `role="option"` entries**
  in the open list — "click the first option" picks the placeholder, the
  form then fails validation with "Required", and nothing is saved.
- **Leave Balance** — read-only, updates once employee + leave type are
  both chosen.
- **From Date** / **To Date** — text inputs with placeholder `yyyy-mm-dd`
  that also open a date-picker popup. **Plain `.fill()` does not reliably
  work** on these — the picker's internal state gets out of sync and you'll
  see a "Should be a valid date in yyyy-mm-dd format" validation error.
  Click the field, select-all, then type the date character-by-character
  (e.g. Playwright's `pressSequentially`), then dismiss the popup (e.g.
  `Escape`).
  **Weekend dates are rejected**: the default work week has Saturday and
  Sunday off, and a leave request covering only non-working days fails
  server-side (`POST .../leave-requests` → 400, "Failed to Submit: No
  Working Days Selected") with no success toast. Pick a weekday — a
  fixed "today + N days" offset will land on a weekend some days of the
  week.
- **Assign** button submits.

**A brand-new employee has no leave entitlement/balance yet, and that's
OK** — submitting still works, it just raises a confirmation dialog
("Employee does not have sufficient leave balance... Click OK to confirm")
that needs an extra click before the assignment actually saves. No need to
set up a per-employee entitlement first.

## Leave → Leave List (verifying an assignment)

`web/index.php/leave/viewLeaveList` — filters by date range, status, leave
type, employee, sub-unit, then a **Search** button.

**Known quirk, confirmed by inspecting the database directly**: in this
build, a freshly-assigned leave request can fail to show up in this list's
search results (`No Records Found`) even though the row genuinely exists in
the database (`ohrm_leave` / `ohrm_leave_request` tables) and even when
filtered explicitly by that employee's name or by a date range that
brackets the assigned date. This was reproduced consistently, is not a
locator/timing bug in the exploration script, and its root cause wasn't
pinned down further (user role/permissions were confirmed correct — the
seeded `Admin` account does hold the `Admin` system role).

**Practical implication for the flow and its assertions**: don't treat "the
row shows up in Leave List search" as the only source of truth for a
passing test — it may fail for reasons that have nothing to do with the
test author's skill. Treat the **"Successfully Saved" confirmation toast**
immediately after clicking Assign as the primary success signal, and Leave
List as a secondary/best-effort check.

## Environment prerequisites (already handled — not part of the flow)

A completely fresh OrangeHRM install can't use the Leave module at all
until an admin has: (1) defined a **Leave Period** (`Leave` → first visit
auto-lands on `defineLeavePeriod`; defaults are pre-filled, just needs
**Save**), and (2) created at least one **Leave Type** (`Leave` →
`Configure` → `Leave Types` → `Add`, just a Name field). Both are one-time
organization setup, not something a "add an employee, assign them leave"
test flow should need to do itself — the same way a real tester would
expect these basics to already be configured. `harness/src/seed.ts` (the
"seed" step) does this once, deterministically, outside the agent's token
budget — see `TODO.md`.
