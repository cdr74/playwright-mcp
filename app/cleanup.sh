#!/usr/bin/env bash
# Tears down the target app stack (app/docker-compose.yml): stops and
# removes the app + db containers and their volumes, so the next
# app/install.sh starts from a byte-identical clean state.
#
# Does NOT touch pulled images (re-pulling is the slow part) - pass
# --images to also remove those if you want a full wipe.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

if command -v podman-compose >/dev/null 2>&1 && command -v podman >/dev/null 2>&1; then
  ENGINE="podman"
  COMPOSE=(podman-compose -f "$COMPOSE_FILE")
elif command -v docker >/dev/null 2>&1; then
  ENGINE="docker"
  COMPOSE=(docker compose -f "$COMPOSE_FILE")
else
  echo "Neither podman-compose+podman nor docker was found on PATH." >&2
  exit 1
fi

echo "==> Using $ENGINE"
echo "==> Stopping and removing containers + volumes"
"${COMPOSE[@]}" down -v

if [ "${1:-}" = "--images" ]; then
  echo "==> Removing pulled images (orangehrm/orangehrm, mariadb)"
  "$ENGINE" rmi -f docker.io/orangehrm/orangehrm:5.9 docker.io/library/mariadb:10.4 2>/dev/null || true
fi

echo "==> Clean. Run app/install.sh to bring it back up."
