#!/usr/bin/env bash
# Zero-LLM "survival" check for the test-healing study (CLAUDE.md decision
# 15): does an already-generated spec still pass after an app update?
# For every (break, spec) pair: full app reset, seed, apply the break
# (app/break.sh), run the spec once. A reset per pair keeps every result
# independent of data left over by earlier specs (the first spike skipped
# this and got failures that were leftover data, not the break).
#
# Usage:
#   harness/survival-check.sh [--breaks "a b"] [--runs-from <log>...]
#
# Defaults: every break app/break.sh knows, and every spec whose run is
# listed in the primer-v3 batch logs (the headline runs). Pass one or more
# --runs-from <repeat-run-log> to choose other batches.
#
# Writes results/survival-<timestamp>.txt: one line per pair,
# "<break> <run_id> PASS|FAIL <first error line>".
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
set -a; [[ -f .env ]] && . ./.env; set +a

BREAKS="$(app/break.sh --list | tr '\n' ' ')"
LOGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --breaks) BREAKS="$2"; shift 2 ;;
    --runs-from) LOGS+=("$2"); shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done
if [[ ${#LOGS[@]} -eq 0 ]]; then
  # Batch logs from the primer column onward; keep only v3 runs.
  mapfile -t LOGS < <(grep -l " v3$" results/repeat-run-log-*.txt)
fi
mapfile -t RUNS < <(for log in "${LOGS[@]}"; do tail -n +2 "$log" | awk '$5 == "v3" {print $1}'; done | sort -u)

OUT="results/survival-$(date -u +%Y%m%dT%H%M%SZ).txt"
echo "# break run_id result first_error" > "$OUT"
echo "==> ${#RUNS[@]} specs x breaks: $BREAKS -> $OUT"

for brk in $BREAKS; do
  for rid in "${RUNS[@]}"; do
    spec="results/$rid/tests/add-employee-leave.spec.ts"
    npm run cleanup:app >/dev/null 2>&1
    npm run setup:app >/dev/null 2>&1
    npm run seed >/dev/null 2>&1
    app/break.sh "$brk" >/dev/null
    if out="$(npx playwright test "$spec" --workers=1 --reporter=line 2>&1)"; then
      line="$brk $rid PASS"
    else
      err="$(echo "$out" | grep -m1 -E 'waiting for|Error:' | sed 's/^ *//' | cut -c1-140)"
      line="$brk $rid FAIL $err"
    fi
    echo "$line" | tee -a "$OUT"
  done
done
echo "==> Done: $OUT"
