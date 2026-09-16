"""
embeddability.py — Checks whether an external URL can be loaded inside an
iframe by inspecting response headers.

Security guarantees
-------------------
- Only http/https schemes accepted.
- Blocks javascript:, data:, file: and any other scheme.
- Resolves the hostname via socket.getaddrinfo and rejects:
    • loopback  (127.0.0.0/8, ::1)
    • private    (10/8, 172.16/12, 192.168/16, fc00::/7)
    • link-local (169.254/16, fe80::/10)
- Issues a HEAD first; falls back to a Range GET (bytes=0-0) if the
  server refuses HEAD (405) or returns no headers.
- Follows at most MAX_REDIRECTS redirects (SSRF-safe: each redirect is
  re-validated).
- Hard timeout: REQUEST_TIMEOUT_SECONDS.

Caching
-------
Results are cached per-host in the Supabase `link_embed_cache` table.
The caller is responsible for supplying the supabase client.
"""

from __future__ import annotations

import ipaddress
import re
import socket
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import requests
from requests import Session

# ─── Constants ────────────────────────────────────────────────────────────────

REQUEST_TIMEOUT_SECONDS = 8
MAX_REDIRECTS = 3
RANGE_HEADERS = {"Range": "bytes=0-0"}
ALLOWED_SCHEMES = {"http", "https"}

# ─── SSRF — private / reserved address detection ──────────────────────────────

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),       # loopback IPv4
    ipaddress.ip_network("::1/128"),            # loopback IPv6
    ipaddress.ip_network("10.0.0.0/8"),         # private
    ipaddress.ip_network("172.16.0.0/12"),      # private
    ipaddress.ip_network("192.168.0.0/16"),     # private
    ipaddress.ip_network("169.254.0.0/16"),     # link-local IPv4
    ipaddress.ip_network("fc00::/7"),           # ULA IPv6
    ipaddress.ip_network("fe80::/10"),          # link-local IPv6
    ipaddress.ip_network("100.64.0.0/10"),      # shared address space (RFC 6598)
    ipaddress.ip_network("0.0.0.0/8"),          # "this" network
    ipaddress.ip_network("240.0.0.0/4"),        # reserved
]


def _is_private_ip(ip_str: str) -> bool:
    """Return True if the IP is in any reserved / private range."""
    try:
        addr = ipaddress.ip_address(ip_str)
        return any(addr in net for net in _PRIVATE_NETWORKS)
    except ValueError:
        return True  # unparseable → treat as unsafe


def _validate_url(url: str) -> Optional[str]:
    """
    Parse and validate the URL. Returns an error reason string if invalid,
    or None if the URL is acceptable.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return "unparseable URL"

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return f"scheme '{parsed.scheme}' is not allowed (only http/https)"

    hostname = parsed.hostname
    if not hostname:
        return "missing hostname"

    # Resolve all IPs for the hostname and block private ranges
    try:
        results = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        return f"DNS resolution failed: {exc}"

    for family, _type, _proto, _canonname, sockaddr in results:
        ip = sockaddr[0]
        if _is_private_ip(ip):
            return f"hostname resolves to private/loopback address {ip}"

    return None  # all clear


# ─── Header inspection ────────────────────────────────────────────────────────

def _parse_xfo(value: str) -> bool:
    """
    X-Frame-Options: DENY → not embeddable.
    X-Frame-Options: SAMEORIGIN → not embeddable (we're cross-origin).
    X-Frame-Options: ALLOW-FROM → technically allows specific origins but
        modern browsers mostly ignore this header now; treat as embeddable
        for our purposes since browsers fall through to CSP.
    Absent → embeddable (no restriction from XFO).
    """
    v = value.strip().upper()
    return v not in ("DENY", "SAMEORIGIN")


def _parse_csp_frame_ancestors(csp_value: str) -> bool:
    """
    Inspect Content-Security-Policy for frame-ancestors directive.
    'frame-ancestors none'  → blocked.
    'frame-ancestors self'  → blocked (cross-origin).
    Absent directive        → not restricted by CSP.
    Returns True if embeddable.
    """
    # Find the frame-ancestors directive (case-insensitive)
    match = re.search(
        r"frame-ancestors\s+([^;]+)",
        csp_value,
        re.IGNORECASE,
    )
    if not match:
        return True  # no frame-ancestors directive — allowed

    sources = match.group(1).strip().lower().split()
    if "'none'" in sources or "none" in sources:
        return False
    if "'self'" in sources or "self" in sources:
        # self allows only same-origin; we're cross-origin → blocked
        return False
    # Any other value (*, specific origin list, etc.) → treat as embeddable
    return True


def _check_headers(headers: dict) -> tuple[bool, str]:
    """
    Inspect the response headers dictionary and return (embeddable, reason).
    """
    xfo = headers.get("X-Frame-Options", "")
    csp = headers.get("Content-Security-Policy", "")

    if xfo and not _parse_xfo(xfo):
        return False, f"X-Frame-Options: {xfo.strip()}"

    if csp and not _parse_csp_frame_ancestors(csp):
        # Extract just the directive value for the reason message
        match = re.search(r"frame-ancestors\s+([^;]+)", csp, re.IGNORECASE)
        directive = match.group(0).strip() if match else csp[:80]
        return False, f"CSP {directive}"

    return True, "no restrictive framing headers found"


# ─── HTTP probe ───────────────────────────────────────────────────────────────

def _probe(url: str, session: Session) -> tuple[bool, str, dict]:
    """
    Issue a HEAD then (if needed) a ranged GET.
    Returns (embeddable, reason, response_headers).
    Raises requests.RequestException on network failure/timeout.
    """
    # Control redirects via the session attribute (works across all requests versions)
    session.max_redirects = MAX_REDIRECTS

    common_kwargs = {
        "timeout": REQUEST_TIMEOUT_SECONDS,
        "allow_redirects": True,
        "headers": {
            "User-Agent": (
                "Mozilla/5.0 (compatible; DataFlowAI-EmbedChecker/1.0)"
            )
        },
    }

    try:
        resp = session.head(url, **common_kwargs)
        # Some servers return 405 Method Not Allowed for HEAD
        if resp.status_code == 405:
            raise requests.exceptions.InvalidSchema("HEAD not allowed")
        resp.raise_for_status()
        return _check_headers(dict(resp.headers)) + (dict(resp.headers),)
    except (
        requests.exceptions.InvalidSchema,
        requests.exceptions.HTTPError,
    ):
        pass  # fall through to ranged GET

    # Fallback: range GET to retrieve only the first byte
    range_headers = {**common_kwargs["headers"], **RANGE_HEADERS}
    resp = session.get(url, **{**common_kwargs, "headers": range_headers}, stream=True)
    resp.close()
    embeddable, reason = _check_headers(dict(resp.headers))
    return embeddable, reason, dict(resp.headers)


# ─── Public API ───────────────────────────────────────────────────────────────

def check_embeddability(url: str, supabase_client=None) -> dict:
    """
    Main entry point.  Returns:
    {
        "url":          str,
        "host":         str,
        "embeddable":   bool,
        "reason":       str,
        "checked_at":   str (ISO-8601 UTC),
    }

    If supabase_client is provided:
    - Checks the `link_embed_cache` table first (by host).
    - On a cache miss, writes the result back to the cache.
    """
    checked_at = datetime.now(timezone.utc).isoformat()

    # ── Validate URL ──
    error = _validate_url(url)
    if error:
        return {
            "url": url,
            "host": urlparse(url).hostname or "",
            "embeddable": False,
            "reason": error,
            "checked_at": checked_at,
        }

    host = urlparse(url).hostname or ""

    # ── Cache lookup (per host) ──
    if supabase_client is not None:
        try:
            cached = (
                supabase_client.table("link_embed_cache")
                .select("embeddable, reason, checked_at")
                .eq("host", host)
                .maybe_single()
                .execute()
            )
            if cached and cached.data:
                row = cached.data
                return {
                    "url": url,
                    "host": host,
                    "embeddable": row["embeddable"],
                    "reason": row["reason"] + " (cached)",
                    "checked_at": row["checked_at"],
                    "from_cache": True,
                }
        except Exception as exc:
            print(f"[EmbedChecker] Cache lookup failed: {exc}")

    # ── Network probe ──
    session = Session()
    try:
        embeddable, reason, _headers = _probe(url, session)
    except requests.exceptions.Timeout:
        embeddable, reason = False, "request timed out"
    except requests.exceptions.TooManyRedirects:
        embeddable, reason = False, f"exceeded {MAX_REDIRECTS} redirects"
    except requests.exceptions.ConnectionError as exc:
        embeddable, reason = False, f"connection error: {exc}"
    except Exception as exc:
        embeddable, reason = False, f"probe failed: {exc}"
    finally:
        session.close()

    checked_at = datetime.now(timezone.utc).isoformat()

    result = {
        "url": url,
        "host": host,
        "embeddable": embeddable,
        "reason": reason,
        "checked_at": checked_at,
    }

    # ── Cache write (upsert by host) ──
    if supabase_client is not None:
        try:
            supabase_client.table("link_embed_cache").upsert(
                {
                    "host": host,
                    "embeddable": embeddable,
                    "reason": reason,
                    "checked_at": checked_at,
                },
                on_conflict="host",
            ).execute()
        except Exception as exc:
            print(f"[EmbedChecker] Cache write failed: {exc}")

    return result
