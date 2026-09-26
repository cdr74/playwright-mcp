#!/usr/bin/env bash
# Runs the healing pilot (CLAUDE.md decision 15): N repeats of every
# (break, condition) pair, with a full app reset before *every* run, like
# harness/run-repeats.sh does for generation. heal.ts applies the break and
# checks the starting spec really fails before spending any tokens.
#
# Must be run from a plain terminal, not from inside a Claude Code session
# (see harness/README.md).
#
# Usage:
#   harness/run-heal-repeats.sh [--breaks "a b"] [--condition mcp|artifacts|both] [--repeats N]
#
# Defaults: the pilot breaks (label-assign-button, dom-select), both
# conditions, 3 repeats. Logs every RUN_ID to results/heal-run-log-<ts>.txt.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BREAKS="label-assign-button dom-select"
CONDITION="both"
REPEATS=3
PRIMER="${PRIMER:-v3}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --breaks) BREAKS="$2"; shift 2 ;;
    --condition) CONDITION="$2"; shift 2 ;;
    --repeats) REPEATS="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--breaks \"a b\"] [--condition mcp|artifacts|both] [--repeats N]"
      exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done
case "$CONDITION" in
  mcp) CONDITIONS="mcp" ;;
  artifacts) CONDITIONS="artifacts" ;;
  both) CONDITIONS="mcp artifacts" ;;
  *) echo "Invalid --condition: $CONDITION" >&2; exit 1 ;;
esac
export PRIMER

LOG_FILE="results/heal-run-log-$(date -u +%Y%m%dT%H%M%SZ).txt"
echo "run_id repeat break condition primer" > "$LOG_FILE"
echo "==> Breaks: $BREAKS; conditions: $CONDITIONS; repeats: $REPEATS; primer: $PRIMER -> $LOG_FILE"

for i in $(seq 1 "$REPEATS"); do
  for brk in $BREAKS; do
    for cond in $CONDITIONS; do
      echo ""
      echo "========== Repeat $i/$REPEATS: $brk / $cond =========="
      npm run cleanup:app
      npm run setup:app
      out_log="$(mktemp)"
      if HEAL_BREAK="$brk" npm run "heal:$cond" 2>&1 | tee "$out_log"; then
        run_id="$(sed -n 's/^==> Done: \(.*\)/\1/p' "$out_log" | tail -1)"
      else
        run_id=""
      fi
      rm -f "$out_log"
      if [[ -z "$run_id" ]]; then
        echo "!! $brk / $cond repeat $i failed - continuing." >&2
        continue
      fi
      echo "$run_id $i $brk $cond $PRIMER" >> "$LOG_FILE"
    done
  done
done

echo ""
echo "==> All done. RUN_IDs logged to $LOG_FILE:"
cat "$LOG_FILE"
