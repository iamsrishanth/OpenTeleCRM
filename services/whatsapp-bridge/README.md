# OpenTeleCRM WhatsApp Bridge (deploy-anywhere)

A self-contained WhatsApp Web bridge (Baileys 7.0.0-rc.9) exposing a tiny
HTTP API. It owns its OWN Baileys session and its OWN inbound message queue —
no dependency on Hermes or any other host service. Deploy it on any Linux box
with Node 18+ (native, no Docker — ADR-0001).

## API

| Method | Path | Body | Response |
|---|---|---|---|
| GET | /health | — | `{ status: connected\|disconnected\|connecting, registered, number, uptime }` |
| POST | /send | `{ chatId, message, replyTo? }` | `{ success, messageId, messageIds }` (long text chunked at 4096) |
| GET | /messages | — | drains the inbound queue (normalized messages) |
| POST | /typing | `{ chatId }` | `{ success }` |

`chatId` is a WhatsApp JID: `<number>@s.whatsapp.net` (DM) — groups are v1
out of scope. `/messages` is a single-consumer drain: exactly one client
should poll it (the CRM's `bridge` driver does).

## Deploy anywhere

```bash
# 1. Get the code (or copy this folder to the target host)
git clone <repo> && cd services/whatsapp-bridge
# standalone without the monorepo: copy this folder, then:
npm install          # or: pnpm install

# 2. Configure (env or .env file via your service manager)
export PORT=3000
export SESSION_DIR=/var/lib/opentelecrm-whatsapp/session

# 3. Pair the number (pairing code preferred):
PAIR_ONLY=true WHATSAPP_PAIRING_CODE=918465067156 npx tsx src/bridge.ts
#    → prints a pairing code; enter it in WhatsApp on the phone
#    → Settings → Linked devices → Link with phone number
#    Credentials persist to SESSION_DIR; the bridge reuses them on boot.
#    QR fallback: omit WHATSAPP_PAIRING_CODE — scan the printed QR.

# 4. Run the bridge (it reconnects + self-heals on logout)
node dist/bridge.js        # after: npx tsc -p tsconfig.json
```

## systemd (Debian/Ubuntu)

`infra/whatsapp-bridge/opentelecrm-whatsapp-bridge.service` installs as a
system unit:

```bash
sudo install -m 0644 infra/whatsapp-bridge/opentelecrm-whatsapp-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now opentelecrm-whatsapp-bridge
journalctl -u opentelecrm-whatsapp-bridge -f
```

## Env reference

| Var | Default | Meaning |
|---|---|---|
| PORT | 3098 | HTTP port (bind 0.0.0.0). 3098 avoids the Hermes gateway bridge's 3000 on this host |
| SESSION_DIR | .data/bridge-session | Baileys file-backed session dir |
| WHATSAPP_PAIRING_CODE | (empty) | phone to pair via code (no +); empty = QR |
| WAIT_FOR_LINK | true | hold for the link on boot |
| PAIR_ONLY | false | exit after pairing instead of serving |
| ALLOWED_USERS | (empty = all) | comma-separated numbers allowed for inbound |
| MAX_QUEUE | 1000 | inbound queue cap |

## Connecting the CRM (OpenTeleCRM)

Set the API's `WHATSAPP_DRIVER=bridge` + `WHATSAPP_BRIDGE_URL=http://<host>:3000`
and the `bridge` provider driver sends outbound + polls inbound for chat sync.
See `services/whatsapp/src/providers/bridge.provider.ts`.

## Notes

- Baileys is an unofficial WhatsApp Web client — use a dedicated number and
  prefer the official Cloud API for anything production-facing. smba/business
  numbers may reject FRESH waweb registration (401 Connection Failure); an
  established session keeps working.
- The bridge reconnects automatically (515 restarts after pairing are normal)
  and clears + re-pairs on logout.
