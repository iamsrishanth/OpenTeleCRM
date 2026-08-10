# OpenTeleCRM — run on Linux OR macOS

The web UI + API stack is pure Node/TypeScript + PostgreSQL with zero native
modules, so the same code runs on Linux and macOS. The only platform-specific
pieces are (a) how the OS supervises the servers at boot, and (b) how you
provision system packages. Everything else is shared.

## Architecture: one portable launcher, two supervisors

```
infra/launchers/launch-api.sh   ← portable bash (Linux + macOS), used by BOTH:
infra/launchers/launch-web.sh     ├── Linux: infra/systemd/opentelecrm-{api,web}.service
                                  └── macOS: infra/macos/com.opentelecrm.{api,web}.plist
```

The launchers resolve `node` dynamically (Homebrew → nvm → PATH), source
`.env`, and exec the server without a `--watch` flag — so systemd/launchd can
restart them cleanly. They work identically on both platforms (the API
launcher was boot-tested on Linux with a `PORT_OVERRIDE` scratch port).

## Linux (systemd) — what's installed on this workstation

```bash
sudo cp infra/systemd/opentelecrm-api.service infra/systemd/opentelecrm-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now opentelecrm-api opentelecrm-web
```

- API on :3005 (prefix /autoupdate/v2), web on :3007 (0.0.0.0)
- `Restart=always`, `Wants/After network-online + postgresql`
- Logs: `journalctl -u opentelecrm-api -f`

## macOS (launchd) — same launchers, plist supervisors

```bash
# 1. Provision system deps (brew)
bash infra/macos/provision-brew.sh

# 2. Point the plists at your repo path
sed -i '' 's|/PATH/TO/OpenTeleCRM|/Users/you/code/OpenTeleCRM|g' \
  infra/macos/com.opentelecrm.api.plist infra/macos/com.opentelecrm.web.plist

# 3. Install as LaunchAgents (user-level, starts at login)
mkdir -p ~/Library/LaunchAgents
cp infra/macos/com.opentelecrm.api.plist infra/macos/com.opentelecrm.web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.opentelecrm.api.plist
launchctl load ~/Library/LaunchAgents/com.opentelecrm.web.plist
```

- `RunAtLoad` + `KeepAlive` (restart on crash) — mirrors the systemd units
- Logs: `/tmp/opentelecrm-api.out.log` / `.err.log` (edit the plist to move them)

## What's already portable (verified)

| Piece | Status | Notes |
|-------|--------|-------|
| apps/web (Next.js) | ✅ portable | zero native deps; `allowedDevOrigins` are hostnames, not OS-specific |
| services/api (NestJS/Fastify) | ✅ portable | zero native deps; tsx resolved from pnpm store by the launcher |
| PostgreSQL 17 + Drizzle RLS | ✅ portable | brew `postgresql@17` on mac; same SQL/RLS |
| API-base derivation (getApiBase) | ✅ portable | window.location logic is OS-agnostic |
| Cloudflare tunnel (cloudflared) | ✅ portable | `brew install cloudflared` on mac; ingress config lives in CF dashboard, not the host |
| Tailscale | ✅ portable | GUI app on mac |
| WhatsApp bridge (Baileys) | ✅ portable | pure JS |
| Telephony (Asterisk ARI) | ⚠️ Linux-only | Asterisk doesn't build on macOS — use `TELEPHONY_DRIVER=mock` on mac |

## Known Linux-isms in the repo (not blockers, for awareness)

- `scripts/provision/debian.sh` — apt-based; macOS uses `infra/macos/provision-brew.sh` instead.
- `scripts/db/init.sh` — uses `sudo -u postgres` (Debian layout). On macOS Homebrew
  Postgres, the login user is the superuser and there is no `postgres` OS user —
  `infra/macos/provision-brew.sh` creates the role/database directly via `psql`.
- `services/api/dev.sh` + `dev-debug.sh` — hardcode this workstation's nvm path;
  the portable `infra/launchers/launch-api.sh` is the cross-platform replacement.
- `scripts/tunnel.py` — the `systemctl` connector check is Linux-only; the CF API
  part (DNS + ingress) is platform-neutral and is what actually matters.
