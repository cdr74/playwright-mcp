# fixtures/

Checked-in `playwright codegen` recordings that seed the Codegen condition.

Each fixture is produced **once, deterministically, with zero LLM tokens**
by a human running `npx playwright codegen <target-url>` and performing the
matching flow from `flows/` by hand. This models the fact that a CLI user
starts from their own recording, the same way an MCP-driven agent gets to
look at the live page.

For reproducibility, this file must document, per fixture, the exact
click-by-click steps taken during recording, the Playwright version used,
and the date recorded — so anyone can re-record it if the target app
changes. See `TODO.md` Phase 2.

## Fixture: `01-add-employee-leave-request.codegen.ts` — recorded

**How to record it:**

```bash
npm run setup:app && npm run seed   # fresh, known app state first
npx playwright codegen http://localhost:8081
```

Log in as `Admin` / `PwMcpBench#2026` (yes, record the login too — codegen
doesn't know about the harness's saved auth state; that's fine, it's raw
material, not the final test), then perform the same flow
`flows/01-add-employee-leave-request.md` describes:

1. **PIM → Add** (Employee List) → fill **First Name** / **Last Name**
   with anything (e.g. `CodegenFN` / `CodegenLN` — the agent will
   generalize this into a unique generated name later, don't worry about
   collisions) → **Save**.
2. **Leave → Assign Leave** (not **Apply** — see `docs/app-knowledge.md`
   for why that distinction matters) → type the employee's name into
   **Employee Name** and click the matching autocomplete option → open
   the **Leave Type** dropdown and pick any option → click **From Date**
   and **To Date** and enter the same near-future date in each (the
   date-picker popup may make this fiddly to record cleanly — that's
   expected, it's exactly the kind of brittle interaction the Codegen
   condition's agent has to clean up) → **Assign** → click **Ok** on the
   confirmation dialog (expected for a zero-balance employee).
3. Optionally also record checking **Leave → Leave List** for the new
   entry, matching the flow spec's verification step — but per the known
   quirk in `docs/app-knowledge.md`, don't worry if it doesn't show up.

Close the codegen window when done. Save the generated script, unedited,
to `fixtures/01-add-employee-leave-request.codegen.ts`, then fill in below.

- **Recorded by:** Christian Raess
- **Date:** 2026-09-25
- **Playwright version:** `1.64.0-alpha-1789764292000`
- **Deviations from the steps above:**
  - Recorded a **two-day range** (From `22` / To `23` of the current
    month) rather than the same single date in both fields. Confirmed in
    the DB this still produces a real, valid assignment (two `SCHEDULED`
    `ohrm_leave` rows), so the fixture is usable as-is — but it means the
    Codegen condition's agent has to actually narrow this to a single-day
    request itself to match `flows/01-add-employee-leave-request.md`
    ("any single-day date"), not just parameterize the recorded dates.
  - Also recorded enabling **login details** for the new employee (the
    `.oxd-switch-input` toggle, a generated username, and two password
    fields) while exploring the Add Employee form — out of scope for the
    flow spec, which only asks to create the employee. Left in
    deliberately as realistic raw-recording noise; the agent is expected
    to drop it, not carry it into the final test.
  - The recorded Leave Type dropdown interaction looks odd on inspection
    (`getByText('-- Select --')` clicked three times, no visible click on
    a specific option text) — codegen's own recording quirk with this
    custom div-based dropdown, not a failed selection: confirmed in the DB
    that `leave_type_id` on both saved rows correctly points at "Annual
    Leave", the only leave type that exists. Left unedited; if the
    Codegen condition's agent can't make sense of this sequence when
    cleaning the recording up, that difficulty is itself a real,
    comparable data point (see `README.md` "How the comparison works" —
    Codegen's `-- Select --`
    handling for this same custom dropdown was a documented hurdle for the
    MCP condition too, in `docs/app-knowledge.md`).
