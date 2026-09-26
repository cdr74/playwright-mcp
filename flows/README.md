# flows/

Natural-language task specs, one per benchmarked flow. Each spec is given
**verbatim and identically** to both the MCP and Codegen conditions — it's the
controlled variable in the experiment. Both conditions additionally get
`docs/app-knowledge/` (shared app context) in their system prompt - see
`README.md` "How the comparison works" (app-knowledge primer) for why.

- `01-add-employee-leave-request.md` — v1 flow: add an employee, assign
  them leave, verify it.

