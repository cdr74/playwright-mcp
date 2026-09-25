# Manual setup verification

Everything below is automated (`npm install && npm run setup`), and was
scripted-and-verified once already during scaffolding. This doc is for
**you** to independently confirm it actually works on your machine — five
minutes, no code required. Sections 1-4 cover the environment (done and
built on top of already); section 5 covers the MCP condition harness built
on top of it - it needs the `claude` CLI (installed, authenticated) and,
critically, **must be run from a plain terminal, not from inside another
Claude Code session** - see that section for why.

## 1. The target app

```bash
npm run setup:app     # or: app/install.sh
```

Then open **http://localhost:8081/** in a real browser and log in:

- Username: `Admin`
- Password: `PwMcpBench#2026`

You should land on the OrangeHRM dashboard. Poke around PIM → Employee
List and Leave → Assign Leave to get a feel for the flow we'll be
scripting against (see `README.md` "Test bed"; note it's "Assign Leave",
not the self-service "Apply" screen - see `docs/app-knowledge.md` for why).

## 2. Playwright CLI

```bash
npm run setup:tools   # downloads the Chromium browser binary, ~300MB first time
npx playwright --version
```

Then try codegen against the running app — this opens a real, visible
browser window and records a Playwright script from your clicks as you go:

```bash
npx playwright codegen http://localhost:8081
```

Log in and click around a little, then close the window. You should see a
generated script printed/saved. This is exactly the mechanism the CLI
condition's seed fixtures (`fixtures/`) will be recorded with later.

## 3. Playwright MCP

```bash
npx playwright-mcp --version
npx playwright-mcp --headless --port 8931
```

You should see:

```
Listening on http://localhost:8931
Put this in your client config:
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/mcp"
    }
  }
}
```

Ctrl-C to stop it. If you want to actually drive it, add that config block
to an MCP client (e.g. Claude Code's `.mcp.json`) and try a `browser_navigate`
to `http://localhost:8081` — confirms the tool the MCP condition will use
end-to-end, not just that the binary launches.

## 4. Cleanup

```bash
npm run cleanup:app   # or: app/cleanup.sh
```

Stops and removes the app + db containers and their volumes. Confirm
`http://localhost:8081/` stops responding, then bring it back with
`npm run setup:app` to confirm the whole cycle is repeatable.

## 5. The MCP condition harness

No API key needed - the harness drives the `claude` CLI (your existing
Claude Code subscription), not the Anthropic API directly. You do need
`claude` installed and authenticated (`claude auth login`).

See `docs/run-mcp-condition.md` for the exact, reproducible step-by-step
(including the literal prompts sent to Claude Code for each phase) - the
commands below are the short version.

**Run this from a plain terminal, not from inside a Claude Code session.**
The scripts need `--dangerously-skip-permissions` for unattended tool use,
and a Claude Code session's own auto-mode classifier blocks it from
spawning a *nested* permission-bypassed session - confirmed while building
this (see `TODO.md` Gotchas). It's not blocked when run as a plain
script/process, just when a Claude Code session tries to command it
directly.

```bash
npm run seed           # login + one-time Leave module setup, saves harness/.auth/state.json
npm run explore:mcp    # prints a RUN_ID when done
RUN_ID=<id> npm run generate:mcp
```

Check `results/<run-id>/test-plan.md` and
`results/<run-id>/tests/add-employee-leave.spec.ts` were produced and make
sense, and `results/<run-id>/metrics.json` has plausible-looking token
counts and cost. `results/raw/<run-id>/*-transcript.jsonl` has the full
detail if something looks off.

---

If sections 1-4 work, the environment phase is solid. Section 5's harness
has now completed one full end-to-end run of both phases (see `TODO.md`
Phase 3 and `docs/run-mcp-condition.md`) - the numbers looked plausible and
the produced test passed reproducibly.
