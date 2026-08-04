# OpenTeleCRM — Asterisk 21 PBX scaffold (native, no Docker)

Asterisk-side configuration for the OpenTeleCRM telephony wave (P3 / A1.x).
The API service (`services/api`, NestJS) bridges to Asterisk over **ARI**
(Asterisk REST Interface); the ARI *client* lives in `services/telephony`
(separate scaffold). This directory is the **PBX-side config only** — what
runs on the Asterisk host.

**No Docker anywhere** (user directive, ADR-0001). Asterisk installs natively
via apt and runs under systemd.

## Architecture / API contract

```
services/api (NestJS)
   └─ services/telephony  (ARI client, HTTP basic auth)
        │  GET/POST/WS → http://127.0.0.1:8088/ari
        ▼
   Asterisk (native, systemd)
        ├─ ari.conf          → ARI user 'opentelecrm'
        ├─ modules.conf      → res_ari_*, res_stasis, chan_pjsip
        ├─ http.conf         → HTTP server on 127.0.0.1:8088 (serves ARI)
        ├─ pjsip.conf        → SIP trunk template + [from-crm] endpoint
        └─ extensions.conf   → dialplan; Dial(Stasis/opentelecrm) hands
                               channels to the API via Stasis events
```

The `services/telephony` ARI client targets **exactly** these values:

| What            | Value                              |
|-----------------|------------------------------------|
| ARI URL         | `http://127.0.0.1:8088/ari`        |
| ARI user        | `opentelecrm`                      |
| ARI password    | from env `ARI_PASSWORD` (never committed) |
| Stasis app      | `opentelecrm` (subscribed over the ARI websocket) |

When the dialplan hits `Dial(Stasis/opentelecrm)` the channel enters the
`opentelecrm` Stasis application and Asterisk streams Stasis events
(`StasisStart`, `ChannelStateChange`, `StasisEnd`, …) to the API, which maps
them to CRM events (call.ringing, call.answered, call.ended, recording.*).
The API can dial channels (`POST /ari/channels`), start/stop recordings
(`POST /ari/channels/{id}/record`), and control calls over ARI.

## Native install (Debian 13)

> Package note: there is **no separate `asterisk-ari` package**. ARI ships as
> the `res_ari*` modules *inside* the `asterisk` package; it is enabled via
> `modules.conf` (explicit `load =>` lines are added by the provision script).
>
> Version note: these templates target the **Asterisk 21 LTS** baseline.
> Debian 13 (trixie) ships a newer LTS (22.x) via apt — that is fine: the
> ARI/PJSIP/Stasis config syntax is stable across the 20–22 LTS lines and
> every file here is version-agnostic.

### 1. Install Asterisk

Either run the repo provisioner (installs Asterisk when
`WITH_TELEPHONY=1`):

```bash
WITH_TELEPHONY=1 bash scripts/provision/debian.sh
```

…or install directly:

```bash
sudo apt-get update
sudo apt-get install -y asterisk asterisk-core-sounds-en
```

The distro package enables `asterisk.service` automatically and creates the
`asterisk` system user.

### 2. Provision ARI + config (recommended)

```bash
ARI_PASSWORD='<generate-a-secret>' bash infra/asterisk/provision/asterisk.sh
```

This script (idempotent, never clobbers existing `/etc/asterisk` config):

1. installs `asterisk` if missing (apt);
2. deploys `ari.conf`, `pjsip.conf`, `extensions.conf` templates into
   `/etc/asterisk/` when absent;
3. sed-templates the `__ARI_PASSWORD__` placeholder in `ari.conf` from the
   `ARI_PASSWORD` env var;
4. ensures `http.conf` binds `127.0.0.1:8088` and `modules.conf` loads
   `res_ari`, `res_ari_channels`, `res_ari_endpoints`, `res_stasis`,
   `res_pjsip`, `chan_pjsip`;
5. restarts `asterisk.service`;
6. smoke-tests `curl -u opentelecrm:<pw> http://127.0.0.1:8088/ari/asterisk/info`
   and requires HTTP 200.

### 3. Manual smoke test

```bash
curl -u opentelecrm:'<your-password>' http://127.0.0.1:8088/ari/asterisk/info
# → 200 with JSON { "system": { "version": "21.x" ... }, "entities": [...] }
```

Useful checks:

```bash
sudo asterisk -rx 'core show uptime'
sudo asterisk -rx 'module show like res_ari'
sudo asterisk -rx 'http show status'
sudo asterisk -rx 'pjsip show endpoints'
journalctl -u asterisk -n 50          # if ARI does not answer
```

## Security posture (read this)

- **Bind ARI to loopback or a private network — never `0.0.0.0`.** ARI rides
  the Asterisk HTTP server configured in `/etc/asterisk/http.conf`
  (`bindaddr = 127.0.0.1`, `bindport = 8088`). The provision script enforces
  this by default (`ARI_BIND=127.0.0.1:8088`). Only widen to a private RFC1918
  address when the API runs on another host, and firewall it.
- **Credentials come from env, not the repo.** `ari.conf` holds the ARI
  password in cleartext (Asterisk requirement) — the committed template only
  has a placeholder. Real deployments template it from a secret store; keep
  the file `0644 asterisk:asterisk`.
- `allowed_origins = *` in `ari.conf` is for localhost browser tooling only
  (the API's ARI client is server-side and needs no CORS). Restrict it to
  your origin in production.
- **SIP is a different socket.** `pjsip.conf` binds `0.0.0.0:5060` because
  that is the PBX's listening socket — but do not expose it to the public
  internet; firewall it or place it on a private network.
- **TLS**: if ARI must leave the host, terminate TLS in front of it with the
  stack's reverse proxy (Caddy, ADR-0013) rather than exposing cleartext
  basic auth.

## Files

| Path | Purpose |
|------|---------|
| `ari.conf` | ARI enabled, `opentelecrm` user, `__ARI_PASSWORD__` placeholder |
| `pjsip.conf` | `transport-udp`, commented `[trunk-example]` endpoint/auth/aor, active `[from-crm]` endpoint |
| `extensions.conf` | `[from-crm]` (beep → answer → log) and `[from-pstn]` (welcome) contexts; Stasis hook-in comments |
| `systemd/opentelecrm-asterisk.service` | unit template for the separate-PBX-host pattern (distro already ships `asterisk.service`) |
| `provision/asterisk.sh` | native installer + ARI templating + module enablement + smoke test |

## systemd

On the standard single host the distro's own `asterisk.service` is what runs.
`systemd/opentelecrm-asterisk.service` is a template for a **dedicated PBX
host**: `User=asterisk`, `Restart=on-failure`, foreground (`-f`) process under
systemd. Install it only on that pattern:

```bash
sudo install -m 0644 infra/asterisk/systemd/opentelecrm-asterisk.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now opentelecrm-asterisk
```

## Current state / next steps

- [x] ARI + PJSIP + dialplan + provision scaffold
- [ ] `services/telephony` ARI client (Stasis app `opentelecrm` subscription, channel originate, recording control)
- [ ] Real SIP trunk credentials (replace `[trunk-example]` in `pjsip.conf`)
- [ ] Recording storage + retention policy (see RISKS.md — Android SIM-call recording notes)
