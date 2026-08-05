#!/usr/bin/env bash
# OpenTeleCRM — Asterisk build-from-source (Debian 13 has no asterisk binary
# package; the distro ships only sound files). Builds the current Asterisk 21
# LTS natively (no Docker, ADR-0001) and installs it. Then run
# infra/asterisk/provision/asterisk.sh to deploy configs + enable ARI.
#
# Usage: bash infra/asterisk/provision/build-asterisk-source.sh
# Env:   ASTERISK_VERSION (default: 21-current → latest 21 LTS)
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "!! Refusing to run as root; use your user + sudo."
  exit 1
fi

ASTERISK_VERSION="${ASTERISK_VERSION:-21-current}"
BUILD_DIR="${ASTERISK_BUILD_DIR:-$HOME/.cache/opentelecrm-asterisk-build}"
JOBS="$(nproc)"

echo "==> Asterisk ${ASTERISK_VERSION} build-from-source (native, ADR-0001)"
echo "    build dir: ${BUILD_DIR}   jobs: ${JOBS}"

# --- 1. Build deps (native apt) -------------------------------------------
echo "==> Installing build dependencies (apt)..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  build-essential pkg-config \
  libssl-dev libxml2-dev libncurses5-dev uuid-dev libjansson-dev \
  libsqlite3-dev libedit-dev libsrtp2-dev libspeex-dev libspeexdsp-dev \
  libopus-dev libvorbis-dev libcodec2-dev \
  >/dev/null 2>&1 || sudo apt-get install -y -qq \
  build-essential pkg-config \
  libssl-dev libxml2-dev libncurses-dev uuid-dev libjansson-dev \
  libsqlite3-dev libedit-dev libsrtp2-dev libspeex-dev libspeexdsp-dev \
  libopus-dev libvorbis-dev

# --- 2. Download + extract ------------------------------------------------
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"
if [ ! -f "asterisk-${ASTERISK_VERSION}.tar.gz" ]; then
  echo "==> Downloading asterisk-${ASTERISK_VERSION}.tar.gz ..."
  curl -fsSL -o "asterisk-${ASTERISK_VERSION}.tar.gz" \
    "https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-${ASTERISK_VERSION}.tar.gz"
fi
SRC_DIR="$(tar -tzf "asterisk-${ASTERISK_VERSION}.tar.gz" | head -1 | cut -d/ -f1)"
if [ ! -d "$SRC_DIR" ]; then
  echo "==> Extracting..."
  tar -xzf "asterisk-${ASTERISK_VERSION}.tar.gz"
fi
cd "$SRC_DIR"

# --- 3. Configure (bundled pjproject — no separate pjsip build) -----------
if [ ! -f "config.status" ]; then
  echo "==> configure --with-pjproject-bundled ..."
  ./configure --with-pjproject-bundled --without-gui --disable-xmldoc >/tmp/asterisk-configure.log 2>&1 || {
    echo "!! configure failed — tail of log:"
    tail -40 /tmp/asterisk-configure.log
    exit 1
  }
fi

# --- 4. Build + install ----------------------------------------------------
echo "==> make -j${JOBS} (this is the long step)..."
make -j"$JOBS" >/tmp/asterisk-make.log 2>&1 || {
  echo "!! make failed — tail of log:"
  tail -40 /tmp/asterisk-make.log
  exit 1
}
echo "==> make install ..."
sudo make install >/tmp/asterisk-make-install.log 2>&1
echo "==> Installing basic sound prompts (beep/welcome) ..."
sudo make basic-pbx >/tmp/asterisk-basic-pbx.log 2>&1 || true

echo "==> Build complete."
asterisk -V
echo "==> Next: bash infra/asterisk/provision/asterisk.sh (deploys ARI configs)"
