# app/

Self-hosted target app: **OrangeHRM 5.9**, run via `docker-compose.yml`.
Fully installed and login-verified under **Podman** (`podman-compose`
1.5.0 / `podman` 5.7.0, rootless) during scaffolding, from a completely
clean volume state, twice in a row (idempotency check).

## Why self-hosted instead of the public demo

The previously-assumed free public demo
(`opensource-demo.orangehrmlive.com`) turned out not to be reliably usable
as a benchmark target — it's not consistently reachable as a self-serve
instance anymore. Self-hosting a pinned version is strictly better for this
project anyway: no third-party uptime dependency, no shared state polluted
by other visitors, and an exact version pinned so results don't silently
drift if the vendor changes the app.

## Quick start

```bash
set -a && source ../.env && set +a   # or just export the OHRM_* vars yourself
./install.sh
```

This brings the stack up (via `podman-compose` or `docker compose`,
auto-detected) and runs OrangeHRM's **non-interactive CLI installer**
against it — no manual web wizard click-through needed. It's idempotent:
safe to re-run, it detects an already-installed instance and skips
straight to the login check.

When it succeeds you'll see:

```
==> Login OK. OrangeHRM is up at http://localhost:8081/ (Admin / PwMcpBench#2026)
```

## How the install works

`orangehrm/orangehrm` doesn't accept DB credentials via environment
variables — normally you'd complete a web installer wizard by hand. It
turns out the image also ships a **non-interactive CLI installer**
(`installer/cli_install.php`, driven by a YAML config) that the official
docs mark deprecated in favor of `installer/console install:on-new-database`
but which still works fine and is much easier to script than driving a Vue
SPA wizard blind.

`install.sh`:

1. `<compose> up -d` — starts `db` (MariaDB 10.4) and `app`
   (`orangehrm/orangehrm:5.9`).
2. Waits for MariaDB to be truly ready. Its official entrypoint starts a
   *temporary* server for first-run init, shuts it down, then starts the
   real one — "ready for connections" appears twice in its logs. The
   script waits for the second occurrence; a naive single ping check races
   this and intermittently fails the install with a connection-refused
   error mid-migration (hit this during testing).
3. If `/var/www/html/lib/confs/Conf.php` doesn't exist yet (i.e. not
   installed), copies the checked-in `cli_install_config.yaml` into the
   container and runs `php installer/cli_install.php`. The installer
   deletes that copy from the container after running (it contains
   plaintext DB credentials) — the source file in this repo is untouched.
4. Verifies the install by actually logging in: fetches the CSRF token
   from the login page, `POST`s to `/web/index.php/auth/validate`, and
   checks for the expected `302` redirect to `/dashboard/index`.

`cli_install_config.yaml` is checked in (not a secret — this is a
throwaway local benchmarking instance) specifically so the install is
**byte-for-byte reproducible**: same org name, same admin credentials
(`Admin` / `PwMcpBench#2026`), every time, for anyone.

Installed state persists in the `ohrm-db-data` / `ohrm-app-confs` named
volumes across `up`/`down`. To wipe and start over:

```bash
./cleanup.sh   # or: npm run cleanup:app
./install.sh   # or: npm run setup:app
```

A full `cleanup.sh` + `install.sh` cycle takes about **80 seconds**
end-to-end (measured with images already cached locally) — that's the
confirmed reset strategy between benchmark repeats, see `README.md` "Test
bed" and `TODO.md`.

## After installing: seed it

`install.sh` only gets OrangeHRM itself running - it doesn't configure the
Leave module (needs a one-time Leave Period + Leave Type, see
`docs/app-knowledge.md`) or produce the authenticated session the harness
conditions use. Run `npm run seed` (from the repo root) after
`install.sh`/`cleanup.sh` cycles - see `harness/README.md`.

## Open items

None currently blocking either condition — see `TODO.md` for what's next.
