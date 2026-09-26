# Running the healing flow (runbook)

The test-healing study (`CLAUDE.md` decision 15): a spec that passed on
the previous app version fails after an app update, and an agent has to
fix it. This doc pins the inputs: commands, tools, prompts.

**Status:** harness built and the pilot chosen (below); no heal runs
exist yet.

**Pilot** (user decision 2026-09-26): breaks `label-assign-button` and
`dom-select`, starting spec `fixtures/heal/add-employee-leave.spec.ts`,
2 breaks × 2 conditions × 3 repeats.

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

Result of the first full check (`results/survival-20260926T135719Z.txt`,
12 primer-v3 specs): each update broke exactly the specs whose locators
depend on what changed, see `docs/results.md`.

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
| Tools actually offered | All 97 tools of the `playwright-test` server (planner, generator, full browser set), not just the 11 in the healer's definition; see the caveat below | as listed |
| Shell / built-in tools | none | none |
| Working directory of test runs | the run's output directory | same |

In real use, `npx playwright init-agents --loop=claude` installs the
healer as a Claude Code subagent with the built-in `Read`/`Edit`/`Write`
tools. We swap those for scoped equivalents (the repo convention);
`edit_file` is the scoped stand-in for `Edit`, and both conditions get it
(user decision 2026-09-26), so neither pays for whole-file rewrites.

### What "no shell" does and doesn't mean

The agent's own tools are scoped to the run's output directory, but a
test file is Node.js code, and both test runners execute whatever the
agent writes into one. So test code can read and write files anywhere,
as in any real project (seen in the first smoke run, where the non-MCP
agent wrote a throwaway test that dumped the page's HTML to a file).
Accepted and documented (user decision 2026-09-26). Test runs start
in the run's output directory, so relative writes stay inside the run,
and the runner records every extra file left there as `leftoverFiles`
in `metrics.json`.

### Caveat: the healer's tool list

Playwright's healer definition lists 11 tools, and installed as a Claude
Code subagent it only gets those. Here it sees all 97 tools of its MCP
server, because `claude -p --tools` can't restrict MCP-server tools
(`CLAUDE.md` decision 3). It therefore pays for more tool definitions in
context, and can do more (the smoke run used `browser_click` and
`browser_resume`, which aren't on its list). Kept that way by decision;
read the MCP condition's cost as an upper bound for the healer as
installed.

## 4. The pilot batch

```bash
npm run repeat:heal       # pilot breaks x both conditions x 3 repeats, reset before every run
harness/run-heal-repeats.sh --breaks "dom-select" --condition artifacts --repeats 1   # a subset
```

Logs every `RUN_ID` to `results/heal-run-log-<timestamp>.txt`.

## 5. Scoring

Healed specs are scored with [`heal-rubric.md`](heal-rubric.md)
(integrity, from `heal.diff`) plus pass rate over 5 re-runs, with the
break re-applied after every reset.
