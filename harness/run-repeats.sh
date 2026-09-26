#!/usr/bin/env bash
# Runs N repeats of one or both conditions, resetting the target app to a
# clean, known state (app/cleanup.sh + app/install.sh) before *every*
# individual run - not just once per repeat, and not just once at the
# start. This matters for real: the Codegen condition's first-run
# flakiness bug (docs/test-bed-evolution.md appendix) was directly caused by
# accumulated app state (employees left over from prior runs making the
# next run's autocomplete search less selective) - resetting between
# every run is how repeats stay independent measurements instead of a
# slow-motion repeat of that exact bug.
#
# Must be run from a plain terminal, not from inside a Claude Code
# session - it drives `claude -p --dangerously-skip-permissions` under
# the hood via the npm scripts it calls (see harness/README.md "A known
# limitation of testing this from inside Claude Code").
#
# Usage:
#   harness/run-repeats.sh [--condition mcp|codegen|both] [--repeats N] [--nudged] [--primer v1|v2|v3]
#
# Defaults: --condition both --repeats 3 (the confirmed count, see
# CLAUDE.md decision 12). --nudged runs the baseline-vs-nudged variant
# (docs/testing-best-practices.md appended - see TODO.md) instead of the
# unguided baseline. --primer picks the app-knowledge primer version
# (docs/app-knowledge/<version>.md, default v3 - an explicit experimental
# variable, CLAUDE.md decision 14); it's recorded in every run's
# metrics.json and in this script's RUN_ID log.
#
# See docs/run-repeats.md for the full writeup.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

CONDITION="both"
REPEATS=3
SUFFIX=""
PRIMER="${PRIMER:-v3}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --condition) CONDITION="$2"; shift 2 ;;
    --repeats) REPEATS="$2"; shift 2 ;;
    --nudged) SUFFIX=":nudged"; shift ;;
    --primer) PRIMER="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--condition mcp|codegen|both] [--repeats N] [--nudged] [--primer v1|v2|v3]"
      exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ "$CONDITION" != "mcp" && "$CONDITION" != "codegen" && "$CONDITION" != "both" ]]; then
  echo "Invalid --condition: $CONDITION (must be mcp, codegen, or both)" >&2
  exit 1
fi

if [[ ! -f "docs/app-knowledge/$PRIMER.md" ]]; then
  echo "Unknown --primer: $PRIMER (no docs/app-knowledge/$PRIMER.md)" >&2
  exit 1
fi
export PRIMER

LOG_FILE="results/repeat-run-log-$(date -u +%Y%m%dT%H%M%SZ).txt"
echo "run_id repeat condition variant primer" > "$LOG_FILE"
echo "==> Logging RUN_IDs to $LOG_FILE"
echo "==> Condition: $CONDITION, repeats: $REPEATS, variant: ${SUFFIX:+nudged}${SUFFIX:-baseline}, primer: $PRIMER"

reset_app() {
  echo "==> Resetting app to a clean, known state"
  npm run cleanup:app
  npm run setup:app
}

# Both explore-mcp.ts and run-codegen.ts print "==> Done: <run-id>" on
# success (see harness/src/{explore-mcp,run-codegen}.ts) - this is the
# one place that log line format is relied on outside those files
# themselves, so keep them in sync if either changes.
extract_run_id() {
  sed -n 's/^==> Done: \(.*\)/\1/p' "$1" | tail -1
}

run_mcp() {
  local i="$1"
  reset_app
  echo "==> [$i/$REPEATS] MCP condition${SUFFIX:+ (nudged)}"
  local explore_log; explore_log="$(mktemp)"
  npm run "explore:mcp${SUFFIX}" 2>&1 | tee "$explore_log"
  local run_id; run_id="$(extract_run_id "$explore_log")"
  rm -f "$explore_log"
  if [[ -z "$run_id" ]]; then
    echo "!! Could not parse a RUN_ID from explore:mcp${SUFFIX}'s output - skipping generate for this repeat." >&2
    return 1
  fi
  echo "$run_id $i mcp ${SUFFIX:+nudged}${SUFFIX:-baseline} $PRIMER" >> "$LOG_FILE"
  RUN_ID="$run_id" npm run "generate:mcp${SUFFIX}"
}

run_codegen() {
  local i="$1"
  reset_app
  echo "==> [$i/$REPEATS] Codegen condition${SUFFIX:+ (nudged)}"
  local out_log; out_log="$(mktemp)"
  npm run "bench:codegen${SUFFIX}" 2>&1 | tee "$out_log"
  local run_id; run_id="$(extract_run_id "$out_log")"
  rm -f "$out_log"
  if [[ -z "$run_id" ]]; then
    echo "!! Could not parse a RUN_ID from bench:codegen${SUFFIX}'s output (run failed or was killed)." >&2
    return 1
  fi
  echo "$run_id $i codegen ${SUFFIX:+nudged}${SUFFIX:-baseline} $PRIMER" >> "$LOG_FILE"
}

for i in $(seq 1 "$REPEATS"); do
  echo ""
  echo "========== Repeat $i/$REPEATS =========="
  if [[ "$CONDITION" == "mcp" || "$CONDITION" == "both" ]]; then
    run_mcp "$i" || echo "!! MCP repeat $i failed - continuing with remaining repeats." >&2
  fi
  if [[ "$CONDITION" == "codegen" || "$CONDITION" == "both" ]]; then
    run_codegen "$i" || echo "!! Codegen repeat $i failed - continuing with remaining repeats." >&2
  fi
done

echo ""
echo "==> All repeats done. RUN_IDs logged to $LOG_FILE:"
cat "$LOG_FILE"
