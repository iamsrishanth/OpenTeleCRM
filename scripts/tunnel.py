#!/usr/bin/env python3
"""OpenTeleCRM tunnel mode switcher.

Reads the Cloudflare token + tunnel domain from the repo-root .env
(gitignored — secrets never ship in code) and:

  on  — 1) ensures the tunnel hostname exists on Cloudflare (DNS CNAME +
         ingress rule) via CLOUDFLARE_API_TOKEN, 2) ensures the cloudflared
         connector runs with CLOUDFLARE_TUNNEL_TOKEN when provided, 3) writes
         apps/web/.env.local (NEXT_PUBLIC_API_ACCESS=tunnel +
         NEXT_PUBLIC_API_TUNNEL_BASE) and sets PUBLIC_BASE_URL in .env.
  off — removes apps/web/.env.local and restores .env from .env.tunnel.bak.

Everything configurable comes from .env — no hardcoded hostnames, tokens, or
account IDs in this file or anywhere in the repository.

Usage: python3 scripts/tunnel.py on|off
"""

import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENV_PATH = REPO / ".env"
WEB_ENV_LOCAL = REPO / "apps" / "web" / ".env.local"
BACKUP_PATH = REPO / ".env.tunnel.bak"


# ---------------------------------------------------------------------------
# env helpers
# ---------------------------------------------------------------------------

def load_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def write_env(path: Path, env: dict, header: str | None = None) -> None:
    lines = []
    if header:
        lines.append(header)
    for key in env:
        lines.append(f"{key}={env[key]}")
    path.write_text("\n".join(lines) + "\n")


def set_env_value(path: Path, key: str, value: str) -> None:
    """Set or replace KEY=value in an env file, preserving everything else."""
    if not path.exists():
        path.write_text(f"{key}={value}\n")
        return
    lines = path.read_text().splitlines()
    found = False
    out = []
    for line in lines:
        if re.match(rf"^{re.escape(key)}\s*=", line):
            out.append(f"{key}={value}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"{key}={value}")
    path.write_text("\n".join(out) + "\n")


def domain_from_base(base: str) -> str:
    m = re.match(r"https?://([^/]+)", base)
    if not m:
        sys.exit(f"ERROR: TUNNEL_BASE_URL is not a URL: {base!r}")
    return m.group(1)


# ---------------------------------------------------------------------------
# Cloudflare API (token from .env only)
# ---------------------------------------------------------------------------

def cf(method: str, url: str, token: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("Content-Type", "application/json")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode()[:300]
        except Exception:
            detail = str(e)
        return {"success": False, "errors": [{"message": f"HTTP {e.code}: {detail}"}]}


def require(env: dict, key: str, hint: str) -> str:
    val = env.get(key, "").strip()
    if not val:
        sys.exit(f"ERROR: add {key} to .env — {hint}")
    return val


def find_zone_id(token: str, hostname: str) -> str:
    domain = hostname.split(".", 1)[1]  # strip the subdomain: host.zone -> zone
    r = cf("GET", f"https://api.cloudflare.com/client/v4/zones?name={domain}", token)
    zones = (r.get("result") or []) if r.get("success") else []
    if not zones:
        sys.exit(f"ERROR: could not find Cloudflare zone for {domain} — check the token scope")
    return zones[0]["id"]


def ensure_dns_cname(token: str, zone_id: str, hostname: str, tunnel_id: str) -> None:
    r = cf(
        "GET",
        f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records?name={hostname}",
        token,
    )
    records = (r.get("result") or []) if r.get("success") else []
    if any(rec.get("type") == "CNAME" for rec in records):
        print(f"cloudflare: DNS CNAME already present for {hostname}")
        return
    r = cf(
        "POST",
        f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records",
        token,
        {
            "type": "CNAME",
            "name": hostname,
            "content": f"{tunnel_id}.cfargotunnel.com",
            "proxied": True,
            "ttl": 1,
        },
    )
    if r.get("success"):
        print(f"cloudflare: DNS CNAME created for {hostname} -> {tunnel_id}.cfargotunnel.com")
    else:
        sys.exit(f"ERROR: DNS CNAME create failed: {r.get('errors')}")


def ensure_ingress(token: str, account_id: str, tunnel_id: str, hostname: str, local_port: str = "3005") -> None:
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        f"/cfd_tunnel/{tunnel_id}/configurations"
    )
    r = cf("GET", url, token)
    if not r.get("success"):
        sys.exit(f"ERROR: could not read tunnel config: {r.get('errors')}")
    config = r.get("result", {}).get("config", {})
    ingress = config.get("ingress", [])
    service = f"http://localhost:{local_port}"

    # Repoint if the hostname exists but targets a different local port.
    for entry in ingress:
        if entry.get("hostname") == hostname:
            if entry.get("service") == service:
                print(f"cloudflare: ingress rule already present for {hostname} -> {service}")
            else:
                entry["service"] = service
                payload = {"config": {"ingress": ingress, "warp-routing": config.get("warp-routing", {"enabled": False})}}
                r = cf("PUT", url, token, payload)
                if r.get("success"):
                    print(f"cloudflare: ingress rule REPOINTED {hostname} -> {service}")
                else:
                    sys.exit(f"ERROR: ingress PUT (repoint) failed: {r.get('errors')}")
            return

    # Insert BEFORE the catch-all http_status:404 rule — rules are matched in order.
    new_ingress = [{"service": service, "hostname": hostname}]
    for entry in ingress:
        if entry.get("service") == "http_status:404":
            new_ingress.append(entry)
        else:
            new_ingress.append(entry)
    if not any(e.get("service") == "http_status:404" for e in new_ingress):
        new_ingress.append({"service": "http_status:404"})
    payload = {"config": {"ingress": new_ingress, "warp-routing": config.get("warp-routing", {"enabled": False})}}
    r = cf("PUT", url, token, payload)
    if r.get("success"):
        print(f"cloudflare: ingress rule added for {hostname} -> {service}")
    else:
        sys.exit(f"ERROR: ingress PUT failed: {r.get('errors')}")


def ensure_connector(env: dict) -> None:
    """If CLOUDFLARE_TUNNEL_TOKEN is set, make sure cloudflared runs with it."""
    token = env.get("CLOUDFLARE_TUNNEL_TOKEN", "").strip()
    if not token:
        print("cloudflare: CLOUDFLARE_TUNNEL_TOKEN unset — assuming cloudflared is already configured")
        return
    r = subprocess.run(["systemctl", "is-active", "cloudflared"], capture_output=True, text=True)
    if r.returncode == 0 and r.stdout.strip() == "active":
        print("cloudflare: cloudflared service already active")
        return
    print("cloudflare: installing cloudflared systemd service with token from .env")
    subprocess.run(["sudo", "cloudflared", "service", "install", token], check=False)


def verify_hostname(base: str) -> None:
    try:
        with urllib.request.urlopen(base + "/health", timeout=20) as resp:
            print(f"cloudflare: verified {base}/health -> HTTP {resp.status}")
    except Exception as e:
        print(f"WARNING: could not verify {base}/health yet ({e}) — retry after cloudflared connects")


# ---------------------------------------------------------------------------
# commands
# ---------------------------------------------------------------------------

def cmd_on() -> None:
    env = load_env(ENV_PATH)
    base = require(env, "TUNNEL_BASE_URL", "e.g. https://crm.example.com")
    token = require(env, "CLOUDFLARE_API_TOKEN", "a Cloudflare API token with DNS:Edit + Tunnel:Write scope")
    hostname = domain_from_base(base)
    # Optional API tunnel hostname (e.g. https://api.crm.example.com). When
    # unset, the web hostname carries the API too (back-compat, port 3005).
    api_base = env.get("TUNNEL_API_BASE_URL", "").strip()
    api_hostname = domain_from_base(api_base) if api_base else None

    account_id = require(env, "CLOUDFLARE_ACCOUNT_ID", "Cloudflare account tag (Zero Trust dashboard)")
    tunnel_id = require(env, "CLOUDFLARE_TUNNEL_ID", "the named tunnel UUID")
    zone_id = env.get("CLOUDFLARE_ZONE_ID", "").strip() or find_zone_id(token, hostname)

    print(f"cloudflare: ensuring {hostname} on tunnel {tunnel_id}")
    ensure_dns_cname(token, zone_id, hostname, tunnel_id)
    if api_hostname:
        print(f"cloudflare: ensuring {hostname} (web -> 3007) on tunnel {tunnel_id}")
        ensure_ingress(token, account_id, tunnel_id, hostname, local_port="3007")
        print(f"cloudflare: ensuring {api_hostname} (api -> 3005) on tunnel {tunnel_id}")
        ensure_dns_cname(token, zone_id, api_hostname, tunnel_id)
        ensure_ingress(token, account_id, tunnel_id, api_hostname, local_port="3005")
    else:
        # Back-compat single-hostname mode: the web hostname carries the API.
        ensure_ingress(token, account_id, tunnel_id, hostname, local_port="3005")
    ensure_connector(env)

    # Snapshot root .env BEFORE mutating PUBLIC_BASE_URL (preserves comments).
    if ENV_PATH.exists():
        import shutil
        shutil.copy2(ENV_PATH, BACKUP_PATH)
        print("env: backed up .env -> .env.tunnel.bak")
    set_env_value(ENV_PATH, "PUBLIC_BASE_URL", base)

    # Explicit tunnel mode in the web app uses the API hostname when present,
    # otherwise the web hostname (back-compat). With runtime derivation the
    # env.local is optional; it pins tunnel mode for `make tunnel` semantics.
    api_for_web = api_base or base
    WEB_ENV_LOCAL.parent.mkdir(parents=True, exist_ok=True)
    WEB_ENV_LOCAL.write_text(
        f"NEXT_PUBLIC_API_ACCESS=tunnel\nNEXT_PUBLIC_API_TUNNEL_BASE={api_for_web}\n"
    )
    print(f"env: wrote apps/web/.env.local (NEXT_PUBLIC_API_ACCESS=tunnel -> {api_for_web})")
    print(f"env: PUBLIC_BASE_URL set to {base} in .env")
    print("done: restart the web dev server to pick up NEXT_PUBLIC vars")


def cmd_off() -> None:
    WEB_ENV_LOCAL.unlink(missing_ok=True)
    print("env: removed apps/web/.env.local")
    if BACKUP_PATH.exists():
        import shutil
        shutil.copy2(BACKUP_PATH, ENV_PATH)
        BACKUP_PATH.unlink()
        print("env: restored .env from .env.tunnel.bak")
    else:
        print("env: no .env.tunnel.bak found — .env left untouched")
    print("done: local API mode restored (restart the web dev server)")


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in ("on", "off"):
        sys.exit("usage: python3 scripts/tunnel.py on|off")
    (cmd_on if sys.argv[1] == "on" else cmd_off)()


if __name__ == "__main__":
    main()
