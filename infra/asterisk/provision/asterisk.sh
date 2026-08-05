#!/usr/bin/env bash
# OpenTeleCRM — native Asterisk provisioning (no Docker, ADR-0001).
#
# Installs Asterisk via apt (if missing), deploys the config templates from
# infra/asterisk/ into /etc/asterisk/ (never clobbers existing live config),
# templates the ARI password into ari.conf, ensures the HTTP/ARI server is
# bound to loopback and the ARI/Stasis/PJSIP modules are enabled, restarts
# the native asterisk.service, and smoke-tests the ARI endpoint.
#
# Usage:
#   ARI_PASSWORD='<secret>' bash infra/asterisk/provision/asterisk.sh
#
# Env:
#   ARI_PASSWORD  (required) password for the 'opentelecrm' ARI user
#   ARI_USER      (optional, default: opentelecrm)
#   ARI_BIND      (optional, default: 127.0.0.1:8088) host:port the Asterisk
#                 HTTP server (which serves ARI) binds to. IPv4 only.
#                 NEVER 0.0.0.0 — see infra/asterisk/README.md security notes.
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "!! Refusing to run as root; use your user + sudo."
  exit 1
fi

: "${ARI_PASSWORD:?ARI_PASSWORD is required — e.g. ARI_PASSWORD='***' bash $0}"
ARI_USER="${ARI_USER:-opentelecrm}"
ARI_BIND="${ARI_BIND:-127.0.0.1:8088}"
ARI_HOST="${ARI_BIND%%:*}"
ARI_PORT="${ARI_BIND##*:}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "${SCRIPT_DIR}")"   # infra/asterisk/
ASTERISK_ETC="/etc/asterisk"

echo "==> OpenTeleCRM Asterisk provisioner"
echo "    ARI user: ${ARI_USER}   ARI bind: ${ARI_BIND}"

# --- 1. Install Asterisk if missing (native apt, Debian/Ubuntu) -----------
# NB: Debian 13 (trixie) has NO asterisk binary package — only sound files.
# On trixie, build from source first:
#   bash infra/asterisk/provision/build-asterisk-source.sh
# then re-run this script (the check below skips the apt install).
if ! command -v asterisk >/dev/null 2>&1 && [ ! -x /usr/sbin/asterisk ]; then
  echo "==> Installing asterisk + core sounds (apt)..."
  sudo apt-get install -y asterisk asterisk-core-sounds-en || {
    echo "!! apt has no asterisk package on this distro (Debian 13+)." >&2
    echo "   Build from source first: bash infra/asterisk/provision/build-asterisk-source.sh" >&2
    exit 1
  }
fi
# NOTE: there is no separate 'asterisk-ari' package — ARI ships as res_ari_*
# modules inside the 'asterisk' package; step 4 ensures they are loaded.

# --- 2. Deploy config templates (never clobber live config) ---------------
deploy_if_missing() {
  local src="$1" dst="$2"
  if [ -f "$dst" ]; then
    echo "    keep existing ${dst}"
  else
    echo "    deploy ${src} -> ${dst}"
    sudo install -m 0644 -o asterisk -g asterisk "$src" "$dst"
  fi
}
sudo mkdir -p "$ASTERISK_ETC"
deploy_if_missing "${TEMPLATE_DIR}/ari.conf"        "$ASTERISK_ETC/ari.conf"
deploy_if_missing "${TEMPLATE_DIR}/pjsip.conf"      "$ASTERISK_ETC/pjsip.conf"
deploy_if_missing "${TEMPLATE_DIR}/extensions.conf" "$ASTERISK_ETC/extensions.conf"

# --- 3. Template the ARI password into ari.conf (sed replace) -------------
# Escape sed replacement specials (& | \) so arbitrary passwords are safe.
PASS_ESC="$(printf '%s' "${ARI_PASSWORD}" | sed 's/[&|\\]/\\&/g')"
sudo sed -i "s|__ARI_PASSWORD__|${PASS_ESC}|g" "$ASTERISK_ETC/ari.conf"
echo "    ari.conf: placeholder replaced (user ${ARI_USER})"

# --- 4. Ensure HTTP/ARI server + modules ----------------------------------
# ensure_line: append "$2" to "$1" unless a matching non-commented line
# exists. Asterisk config parsing is last-wins, so appending is safe even if
# an earlier commented/active line exists.
ensure_line() {
  local file="$1" line="$2" re
  re="$(printf '%s' "$line" | sed 's/[.[\*^$()+?{|]/\\&/g')"
  if ! sudo grep -qE "^[[:space:]]*${re}[[:space:]]*$" "$file"; then
    echo "$line" | sudo tee -a "$file" >/dev/null
  fi
}

# ARI rides the Asterisk HTTP server (http.conf). Bind loopback only —
# never expose ARI on 0.0.0.0 (see README security posture).
if [ ! -f "$ASTERISK_ETC/http.conf" ]; then
  echo "    deploy http.conf (loopback bind ${ARI_BIND})"
  printf '[general]\nenabled = yes\nbindaddr = %s\nbindport = %s\n' \
    "${ARI_HOST}" "${ARI_PORT}" | sudo tee "$ASTERISK_ETC/http.conf" >/dev/null
else
  echo "    http.conf exists — ensuring enabled=yes, bindaddr=${ARI_HOST}, bindport=${ARI_PORT}"
  ensure_line "$ASTERISK_ETC/http.conf" "enabled = yes"
  ensure_line "$ASTERISK_ETC/http.conf" "bindaddr = ${ARI_HOST}"
  ensure_line "$ASTERISK_ETC/http.conf" "bindport = ${ARI_PORT}"
fi

# Explicit loads for the ARI + Stasis + PJSIP module set. Redundant when the
# distro modules.conf has autoload=yes, but documents the requirement and
# covers hosts where autoload was turned off (source builds ship autoload=no).
# ORDER MATTERS: res_ari needs res_websocket_client + res_ari_model first;
# res_ari_channels needs the res_stasis_* helpers.
for mod in res_http_websocket res_websocket_client res_ari_model res_ari \
  res_stasis res_stasis_answer res_stasis_playback res_stasis_recording \
  res_stasis_snoop res_ari_channels res_ari_endpoints res_ari_playbacks \
  res_ari_recordings res_ari_asterisk res_pjsip chan_pjsip; do
  ensure_line "$ASTERISK_ETC/modules.conf" "load => ${mod}.so"
done

# --- 5. Restart the native systemd service --------------------------------
echo "==> Restarting asterisk..."
sudo systemctl restart asterisk
sudo systemctl --no-pager --full status asterisk --lines=3 || true

# --- 6. Smoke test ARI ----------------------------------------------------
# Wait for the HTTP/ARI server to come up (retry up to ~30s), then require
# HTTP 200 on the info resource with basic auth.
TMP_INFO="$(mktemp)"
echo "==> Verifying ARI at http://${ARI_BIND}/ari/asterisk/info ..."
code=000
for _ in $(seq 1 15); do
  code="$(curl -s -o "$TMP_INFO" -w '%{http_code}' \
    -u "${ARI_USER}:${ARI_PASSWORD}" "http://${ARI_BIND}/ari/asterisk/info" || true)"
  [ "$code" = "200" ] && break
  sleep 2
done

if [ "$code" = "200" ]; then
  echo "==> ARI OK (HTTP 200). Asterisk info:"
  sed -E 's/^/    /' "$TMP_INFO" | head -n 20
  rm -f "$TMP_INFO"
  echo "==> Done. Point the API service (services/telephony ARI client) at:"
  echo "    ARI_URL     = http://${ARI_BIND}/ari"
  echo "    ARI_USER    = ${ARI_USER}"
  echo "    ARI_PASSWORD = <the ARI_PASSWORD you supplied>"
  echo "    Stasis app  = opentelecrm   (subscribed via ARI websocket)"
else
  echo "!! ARI check failed: HTTP ${code}." >&2
  echo "   Inspect: sudo journalctl -u asterisk -n 50" >&2
  echo "   Also:    sudo asterisk -rx 'module show like res_ari'" >&2
  rm -f "$TMP_INFO"
  exit 1
fi
