#!/usr/bin/env bash
# Brings up the target app stack (app/docker-compose.yml) and runs
# OrangeHRM's non-interactive CLI installer against it, using the
# checked-in app/cli_install_config.yaml. Idempotent: if it's already
# installed (Conf.php exists in the persisted volume), does nothing.
#
# Validated with Podman 5.7.0 / podman-compose 1.5.0 (rootless). Should
# work unchanged with Docker.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
APP_CONTAINER="ohrm-bench-app"
DB_CONTAINER="ohrm-bench-db"

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
echo "==> Bringing up $COMPOSE_FILE"
"${COMPOSE[@]}" up -d

echo "==> Waiting for the database to finish initializing..."
# The official mariadb entrypoint starts a temporary server for first-run
# init, shuts it down, then starts the real one - "ready for connections"
# appears twice in its logs. Waiting for just one occurrence (or a single
# successful `mysqladmin ping`) can catch that temporary window and then
# lose the connection moments later when it restarts.
for _ in $(seq 1 60); do
  READY_COUNT=$("$ENGINE" logs "$DB_CONTAINER" 2>&1 | grep -c "ready for connections" || true)
  if [ "${READY_COUNT:-0}" -ge 2 ]; then
    break
  fi
  sleep 2
done
if [ "${READY_COUNT:-0}" -lt 2 ]; then
  echo "==> Database did not report ready twice within the timeout - continuing anyway, but the install may fail." >&2
fi

if "$ENGINE" exec "$APP_CONTAINER" test -f /var/www/html/lib/confs/Conf.php >/dev/null 2>&1; then
  echo "==> Already installed (lib/confs/Conf.php exists) - skipping installer."
else
  echo "==> Running the OrangeHRM CLI installer..."
  "$ENGINE" cp "$SCRIPT_DIR/cli_install_config.yaml" "$APP_CONTAINER:/var/www/html/installer/cli_install_config.yaml"
  "$ENGINE" exec "$APP_CONTAINER" sh -c 'cd /var/www/html && php installer/cli_install.php'
fi

PORT="${OHRM_PORT:-8081}"
echo "==> Verifying login at http://localhost:${PORT}/ ..."
COOKIES="$(mktemp)"
trap 'rm -f "$COOKIES"' EXIT

TOKEN=$(curl -s -c "$COOKIES" "http://localhost:${PORT}/web/index.php/auth/login" \
  | grep -o ':token="&quot;[^&]*' | sed 's/:token="&quot;//')

STATUS=$(curl -s -c "$COOKIES" -b "$COOKIES" -o /dev/null -w '%{http_code}' \
  -X POST "http://localhost:${PORT}/web/index.php/auth/validate" \
  --data-urlencode "_token=$TOKEN" \
  --data-urlencode "username=Admin" \
  --data-urlencode "password=PwMcpBench#2026")

if [ "$STATUS" = "302" ]; then
  echo "==> Login OK. OrangeHRM is up at http://localhost:${PORT}/ (Admin / PwMcpBench#2026)"
else
  echo "==> Login check failed (HTTP $STATUS). The app may still be starting up - try again in a few seconds." >&2
  exit 1
fi
