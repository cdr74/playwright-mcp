# conditions/heal/

Prompts for the **test-healing** flow (`CLAUDE.md` decision 15), run by
`harness/src/heal.ts` (`npm run heal:mcp` / `npm run heal:artifacts`).

- The **`mcp`** condition uses Playwright's own healer agent
  instructions verbatim, read at run time from
  `node_modules/playwright/lib/agents/playwright-test-healer.agent.md`
  (so they follow the pinned Playwright version). No copy is kept here.
- `artifacts-prompt.md`: the **`artifacts`** condition's prompt. It's the
  same healer text with steps 1–3 adapted to "read the failure output and
  its page snapshot", because this condition has no browser or debugger.
  Everything else is word for word, including the `test.fixme()` escape
  hatch. Regenerate it by diffing against the healer file whenever
  Playwright is bumped.

Both get the target URL and the app-knowledge primer appended, and the
same task message. The full composed setup is in `docs/run-heal.md`.
