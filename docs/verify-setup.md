# Manual setup verification

Everything below is automated (`npm install && npm run setup`), and was
scripted-and-verified once already during scaffolding. This doc is for
**you** to independently confirm it actually works on your machine before
we build anything on top of it — five minutes, no code required.

## 1. The target app

```bash
npm run setup:app     # or: app/install.sh
```

Then open **http://localhost:8081/** in a real browser and log in:

- Username: `Admin`
- Password: `PwMcpBench#2026`

You should land on the OrangeHRM dashboard. Poke around PIM → Employee
List and Leave → Apply to get a feel for the flow we'll be scripting
against (see `README.md` "Test bed").

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

---

If all four sections work, this phase is done and ready to commit.
