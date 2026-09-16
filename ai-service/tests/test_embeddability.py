"""
tests/test_embeddability.py

Unit tests for services/embeddability.py.

Run with:
    cd ai-service
    python -m pytest tests/test_embeddability.py -v

No network access is used — all HTTP calls are mocked via unittest.mock.
"""

from __future__ import annotations

import socket
from unittest.mock import MagicMock, patch

import pytest

# ── Module under test ────────────────────────────────────────────────────────
from services.embeddability import (
    _check_headers,
    _is_private_ip,
    _parse_csp_frame_ancestors,
    _parse_xfo,
    _validate_url,
    check_embeddability,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Helper — build a fake requests.Response-like object
# ═══════════════════════════════════════════════════════════════════════════════

def _make_response(status_code: int = 200, headers: dict | None = None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.headers = headers or {}
    resp.raise_for_status = MagicMock()
    resp.close = MagicMock()
    return resp


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Private IP detection
# ═══════════════════════════════════════════════════════════════════════════════

class TestIsPrivateIp:
    def test_loopback_ipv4(self):
        assert _is_private_ip("127.0.0.1") is True

    def test_loopback_ipv6(self):
        assert _is_private_ip("::1") is True

    def test_private_10_block(self):
        assert _is_private_ip("10.0.0.1") is True

    def test_private_172_block(self):
        assert _is_private_ip("172.20.0.1") is True

    def test_private_192_168_block(self):
        assert _is_private_ip("192.168.1.100") is True

    def test_link_local(self):
        assert _is_private_ip("169.254.1.1") is True

    def test_public_ip_is_not_private(self):
        assert _is_private_ip("8.8.8.8") is False

    def test_public_ip_172_not_in_range(self):
        # 172.32.x.x is NOT in 172.16.0.0/12
        assert _is_private_ip("172.32.0.1") is False

    def test_invalid_ip_treated_as_unsafe(self):
        assert _is_private_ip("not-an-ip") is True


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Scheme / URL validation
# ═══════════════════════════════════════════════════════════════════════════════

class TestValidateUrl:
    def _resolve_public(self, hostname):
        """Patch socket.getaddrinfo to return a public IP for tests."""
        return [(socket.AF_INET, None, None, None, ("93.184.216.34", 80))]

    def test_javascript_scheme_rejected(self):
        result = _validate_url("javascript:alert(1)")
        assert result is not None
        assert "javascript" in result

    def test_data_scheme_rejected(self):
        result = _validate_url("data:text/html,<h1>hi</h1>")
        assert result is not None
        assert "data" in result

    def test_file_scheme_rejected(self):
        result = _validate_url("file:///etc/passwd")
        assert result is not None
        assert "file" in result

    def test_ftp_scheme_rejected(self):
        result = _validate_url("ftp://example.com/file.zip")
        assert result is not None

    def test_valid_https_url(self):
        with patch("socket.getaddrinfo", return_value=[(socket.AF_INET, None, None, None, ("93.184.216.34", 80))]):
            result = _validate_url("https://example.com/page")
        assert result is None  # None means valid

    def test_valid_http_url(self):
        with patch("socket.getaddrinfo", return_value=[(socket.AF_INET, None, None, None, ("93.184.216.34", 80))]):
            result = _validate_url("http://example.com/page")
        assert result is None

    def test_private_ip_rejected(self):
        # Hostname resolves to 127.0.0.1
        with patch("socket.getaddrinfo", return_value=[(socket.AF_INET, None, None, None, ("127.0.0.1", 80))]):
            result = _validate_url("http://localhost/admin")
        assert result is not None
        assert "private" in result.lower() or "loopback" in result.lower()

    def test_dns_failure_rejected(self):
        with patch("socket.getaddrinfo", side_effect=socket.gaierror("NXDOMAIN")):
            result = _validate_url("http://this-domain-does-not-exist-xyz.invalid/")
        assert result is not None
        assert "DNS" in result or "resolution" in result


# ═══════════════════════════════════════════════════════════════════════════════
# 3. X-Frame-Options header parsing
# ═══════════════════════════════════════════════════════════════════════════════

class TestParseXfo:
    def test_deny_blocked(self):
        assert _parse_xfo("DENY") is False

    def test_deny_case_insensitive(self):
        assert _parse_xfo("deny") is False

    def test_sameorigin_blocked(self):
        assert _parse_xfo("SAMEORIGIN") is False

    def test_allow_from_embeddable(self):
        # ALLOW-FROM is deprecated; treat as embeddable
        assert _parse_xfo("ALLOW-FROM https://trusted.example.com") is True

    def test_empty_embeddable(self):
        assert _parse_xfo("") is True

    def test_unknown_value_embeddable(self):
        assert _parse_xfo("SOME-FUTURE-VALUE") is True


# ═══════════════════════════════════════════════════════════════════════════════
# 4. CSP frame-ancestors parsing
# ═══════════════════════════════════════════════════════════════════════════════

class TestParseCspFrameAncestors:
    def test_none_blocked(self):
        assert _parse_csp_frame_ancestors("default-src 'none'; frame-ancestors 'none'") is False

    def test_self_blocked(self):
        assert _parse_csp_frame_ancestors("frame-ancestors 'self'") is False

    def test_wildcard_embeddable(self):
        assert _parse_csp_frame_ancestors("frame-ancestors *") is True

    def test_specific_origin_embeddable(self):
        assert _parse_csp_frame_ancestors("frame-ancestors https://trusted.example.com") is True

    def test_no_frame_ancestors_directive(self):
        # Policy has no frame-ancestors — not restricted
        assert _parse_csp_frame_ancestors("default-src 'self'; script-src 'none'") is True

    def test_empty_csp_embeddable(self):
        assert _parse_csp_frame_ancestors("") is True


# ═══════════════════════════════════════════════════════════════════════════════
# 5. check_embeddability integration (with mocked HTTP)
# ═══════════════════════════════════════════════════════════════════════════════

class TestCheckEmbeddability:
    """End-to-end tests through check_embeddability(), mocking network & cache."""

    def _public_dns(self, hostname, *args, **kwargs):
        return [(socket.AF_INET, None, None, None, ("93.184.216.34", 80))]

    # ── 5a. Allow-all site ────────────────────────────────────────────────────
    def test_allow_all_site(self):
        """Site with no framing restrictions → embeddable."""
        with (
            patch("socket.getaddrinfo", side_effect=self._public_dns),
            patch("services.embeddability.Session") as MockSession,
        ):
            session_instance = MagicMock()
            MockSession.return_value.__enter__ = MagicMock(return_value=session_instance)
            MockSession.return_value = session_instance
            session_instance.head.return_value = _make_response(200, headers={})

            result = check_embeddability("https://example.com/")

        assert result["embeddable"] is True
        assert "no restrictive" in result["reason"]

    # ── 5b. DENY site ─────────────────────────────────────────────────────────
    def test_deny_site(self):
        """Site returns X-Frame-Options: DENY → not embeddable."""
        with (
            patch("socket.getaddrinfo", side_effect=self._public_dns),
            patch("services.embeddability.Session") as MockSession,
        ):
            session_instance = MagicMock()
            MockSession.return_value = session_instance
            session_instance.head.return_value = _make_response(
                200, headers={"X-Frame-Options": "DENY"}
            )

            result = check_embeddability("https://deny-example.com/")

        assert result["embeddable"] is False
        assert "DENY" in result["reason"]

    # ── 5c. CSP-restricted site ───────────────────────────────────────────────
    def test_csp_restricted_site(self):
        """Site returns CSP frame-ancestors 'none' → not embeddable."""
        with (
            patch("socket.getaddrinfo", side_effect=self._public_dns),
            patch("services.embeddability.Session") as MockSession,
        ):
            session_instance = MagicMock()
            MockSession.return_value = session_instance
            session_instance.head.return_value = _make_response(
                200,
                headers={
                    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'"
                },
            )

            result = check_embeddability("https://csp-example.com/")

        assert result["embeddable"] is False
        assert "frame-ancestors" in result["reason"].lower()

    # ── 5d. Private-IP rejection ──────────────────────────────────────────────
    def test_private_ip_rejection(self):
        """Hostname resolves to a private IP → embeddable=False before any HTTP."""
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, None, None, None, ("192.168.1.1", 80))],
        ):
            result = check_embeddability("http://internal-server/")

        assert result["embeddable"] is False
        assert "private" in result["reason"].lower() or "loopback" in result["reason"].lower()

    # ── 5e. Bad-scheme rejection ──────────────────────────────────────────────
    def test_bad_scheme_javascript(self):
        result = check_embeddability("javascript:alert('xss')")
        assert result["embeddable"] is False
        assert "javascript" in result["reason"]

    def test_bad_scheme_data(self):
        result = check_embeddability("data:text/html,<script>evil()</script>")
        assert result["embeddable"] is False

    def test_bad_scheme_file(self):
        result = check_embeddability("file:///etc/passwd")
        assert result["embeddable"] is False

    # ── 5f. Timeout ───────────────────────────────────────────────────────────
    def test_timeout(self):
        """Network timeout → embeddable=False, reason mentions timeout."""
        import requests as req_module

        with (
            patch("socket.getaddrinfo", side_effect=self._public_dns),
            patch("services.embeddability.Session") as MockSession,
        ):
            session_instance = MagicMock()
            MockSession.return_value = session_instance
            session_instance.head.side_effect = req_module.exceptions.Timeout()

            result = check_embeddability("https://slow-site.example.com/")

        assert result["embeddable"] is False
        assert "timed out" in result["reason"]

    # ── 5g. Cache hit ─────────────────────────────────────────────────────────
    def test_cache_hit_skips_network(self):
        """When Supabase returns a cached row, no HTTP probe is issued."""
        mock_supabase = MagicMock()
        mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
            "embeddable": True,
            "reason": "no restrictive framing headers found",
            "checked_at": "2024-01-01T00:00:00+00:00",
        }

        with patch("socket.getaddrinfo", side_effect=self._public_dns):
            result = check_embeddability("https://example.com/", supabase_client=mock_supabase)

        assert result["from_cache"] is True
        assert result["embeddable"] is True
