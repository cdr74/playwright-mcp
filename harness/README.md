# harness/

The measurement harness: a TypeScript program that calls the Anthropic
Messages API directly (via `@anthropic-ai/sdk`), drives either the MCP or
CLI condition's agent loop, and records exact token usage, tool-call
counts, timing, and the resulting artifact for each run.

Not implemented yet — see `TODO.md` Phase 3. Entry points will live in
`harness/src/`.
