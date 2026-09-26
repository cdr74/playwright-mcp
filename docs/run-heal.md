# Running the healing flow (runbook)

The test-healing study (`CLAUDE.md` decision 15): a spec that passed on
the previous app version fails after an app update, and an agent has to
fix it. This doc pins the inputs: commands, tools, prompts.

**Status:** harness built; the starting spec and the pilot breaks are
still to be chosen (`TODO.md` Phase 5), so no heal runs exist yet.

## 0. Prerequisites

Same as generation: `claude` CLI installed and authenticated, `.env`
populated, and **run from a plain terminal, not from inside a Claude
Code session** (see `harness/README.md`).

## 1. App updates ("breaks")

`app/break.sh <name>` (or `npm run break:app -- <name>`) applies one
change to the running app. `app/break.sh --list` shows them:

| Break | Kind | What changes |
|---|---|---|
| `label-assign-button` | label | The Assign Leave submit button reads "Submit" instead of "Assign" |
| `label-employee-hint` | label | The employee field's placeholder reads "Start typing a name..." instead of "Type for hints..." |
| `dom-select` | DOM | CSS classes `oxd-select-*` become `oxd-dropdown-*` (the custom dropdowns) |
| `dom-autocomplete` | DOM | CSS classes `oxd-autocomplete-*` become `oxd-typeahead-*` (the employee autocomplete) |

Labels change through OrangeHRM's own translation tables; DOM classes
change consistently in the compiled JS and CSS, like a UI-library
upgrade. Behaviour and styling stay the same (checked with a browser
probe). A normal reset (`npm run cleanup:app && npm run setup:app`)
undoes every break.

## 2. Survival check (no LLM)

```bash
npm run survival                     # every break x every primer-v3 spec
harness/survival-check.sh --breaks "dom-select" --runs-from results/repeat-run-log-<ts>.txt
```

For every (break, spec) pair: full reset, seed, break, one run. Writes
`results/survival-<timestamp>.txt`. Answers "which already-generated
specs would a given app update break?" at zero token cost.

## 3. One heal run

```bash
HEAL_BREAK=<break> npm run heal:mcp          # Playwright's healer
HEAL_BREAK=<break> npm run heal:artifacts    # test output + error-context only
```

Reset the app first (`npm run cleanup:app && npm run setup:app`), as for
generation. What the runner (`harness/src/heal.ts`) does:

1. Seeds, then applies the break.
2. Copies the starting spec (`HEAL_SPEC`, default
   `fixtures/heal/add-employee-leave.spec.ts`) to
   `results/<run-id>/tests/`, and writes a per-run Playwright config
   (same settings as `playwright.config.ts`, absolute paths).
3. **Runs the spec once and aborts if it still passes** (nothing to
   heal, no tokens spent).
4. Starts one `claude -p` phase (model `claude-sonnet-5`, isolated cwd,
   as for generation).
5. Saves the healed spec, `heal.diff` (against the starting spec) and
   `metrics.json` with a `heal` block: break, starting spec, the
   pre-heal failure check and the tool list.

### The two conditions

| | `mcp` | `artifacts` |
|---|---|---|
| System prompt | Playwright's healer agent instructions, **verbatim** from `node_modules/playwright/lib/agents/playwright-test-healer.agent.md` | The same text with steps 1–3 adapted: no `test_run`/`test_debug`/browser, instead "read the failure output and its page snapshot" (`conditions/heal/artifacts-prompt.md`) |
| + appended to both | `Target application base URL: …` and `## App knowledge` + the primer (v3), unchanged after the break | same |
| Task message | "This test passed on the previous release of the app and fails after today's app update. Fix it. The test is `tests/add-employee-leave.spec.ts` in your output directory." | same |
| Test runner | Playwright's `playwright-test` MCP server (`playwright run-test-mcp-server --headless -c <per-run config>`): `test_run`, `test_debug`, `test_list`, and browser tools while a test is paused | Our `run_playwright_test` (same per-run config); on failure it appends each failed test's `error-context.md` page snapshot |
| File tools | Scoped `read_file`, `write_file`, `edit_file` (find-and-replace patch) | same |
| Shell / built-in tools | none | none |

In real use, `npx playwright init-agents --loop=claude` installs the
healer as a Claude Code subagent with the built-in `Read`/`Edit`/`Write`
tools. We swap those for scoped equivalents (the repo convention);
`edit_file` is the scoped stand-in for `Edit`, and both conditions get it
(user decision 2026-09-26), so neither pays for whole-file rewrites.

## 4. Scoring

Healed specs are scored with [`heal-rubric.md`](heal-rubric.md)
(integrity, from `heal.diff`) plus pass rate over 5 re-runs, with the
break re-applied after every reset.
