"""
Ollama Service — Raw HTTP Client
=================================
Communicates directly with the local Ollama REST API at:
  http://localhost:11434/api/generate

Provides a clean, production-ready interface for sending prompts to
any Ollama-hosted model (default: gemma3) with full error handling,
configurable timeouts, and graceful fallback support.

Configuration (environment variables):
  OLLAMA_BASE_URL   — Ollama server base URL  (default: http://localhost:11434)
  OLLAMA_MODEL      — Model name to use        (default: gemma3)
  OLLAMA_TIMEOUT    — Request timeout seconds  (default: 120)
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

import requests

# ── Logging ────────────────────────────────────────────────────────────────────

logger = logging.getLogger("ollama_service")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("[%(name)s] %(message)s"))
    logger.addHandler(_handler)

# ── Configuration ──────────────────────────────────────────────────────────────

OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma3")
OLLAMA_TIMEOUT: int = int(os.getenv("OLLAMA_TIMEOUT", "120"))

# ── Helpers ────────────────────────────────────────────────────────────────────


def _strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` fences that models sometimes add."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


# ── Core Generate Call ─────────────────────────────────────────────────────────


def generate(
    prompt: str,
    model: Optional[str] = None,
    system: Optional[str] = None,
    base_url: Optional[str] = None,
    timeout: Optional[int] = None,
    temperature: float = 0.7,
    strip_fences: bool = True,
) -> Optional[str]:
    """
    Send a prompt to Ollama's /api/generate endpoint and return the
    generated text.

    Parameters
    ----------
    prompt      : The user prompt.
    model       : Model name; overrides OLLAMA_MODEL env var.
    system      : Optional system instruction prepended to the conversation.
    base_url    : Ollama server URL; overrides OLLAMA_BASE_URL env var.
    timeout     : Request timeout in seconds; overrides OLLAMA_TIMEOUT env var.
    temperature : Sampling temperature (0.0–1.0).
    strip_fences: If True, strips markdown code fences from the response.

    Returns
    -------
    str | None  — Generated text, or None if Ollama is unavailable or errors.
    """
    _model = model or OLLAMA_MODEL
    _base_url = (base_url or OLLAMA_BASE_URL).rstrip("/")
    _timeout = timeout or OLLAMA_TIMEOUT

    endpoint = f"{_base_url}/api/generate"

    # Build full prompt — prepend system instruction if provided
    full_prompt = f"{system}\n\n{prompt}" if system else prompt

    payload: dict = {
        "model": _model,
        "prompt": full_prompt,
        "stream": False,  # Return full response at once
        "options": {
            "temperature": temperature,
        },
    }

    logger.info(f"[AI] Calling Ollama — model='{_model}' url='{endpoint}' timeout={_timeout}s")

    try:
        response = requests.post(
            endpoint,
            json=payload,
            timeout=_timeout,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()

        data: dict = response.json()
        raw: str = data.get("response", "").strip()

        if not raw:
            logger.warning("Ollama returned an empty response")
            return None

        if strip_fences:
            raw = _strip_markdown_fences(raw)

        logger.info(f"[AI] Ollama response received ({len(raw)} chars)")
        return raw

    except requests.exceptions.ConnectionError:
        logger.warning(
            f"Ollama is not reachable at {_base_url}. "
            "Ensure Ollama is running: `ollama serve`"
        )
        return None
    except requests.exceptions.Timeout:
        logger.warning(
            f"Ollama request timed out after {_timeout}s (model='{_model}'). "
            "The model may still be loading — try again."
        )
        return None
    except requests.exceptions.HTTPError as exc:
        logger.warning(f"Ollama HTTP error {exc.response.status_code}: {exc}")
        return None
    except json.JSONDecodeError as exc:
        logger.warning(f"Ollama returned non-JSON response: {exc}")
        return None
    except Exception as exc:
        logger.warning(f"Unexpected Ollama error ({type(exc).__name__}): {exc}")
        return None


# ── Health Check ───────────────────────────────────────────────────────────────


def get_status(base_url: Optional[str] = None) -> dict:
    """
    Check whether the local Ollama server is running and list available models.

    Returns
    -------
    dict with keys:
      running         (bool)      — True if Ollama responded
      model           (str)       — Configured default model
      base_url        (str)       — Server URL checked
      available_models (list[str]) — Models installed locally
    """
    _base_url = (base_url or OLLAMA_BASE_URL).rstrip("/")

    result: dict = {
        "running": False,
        "model": OLLAMA_MODEL,
        "base_url": _base_url,
        "available_models": [],
    }

    try:
        response = requests.get(f"{_base_url}/api/tags", timeout=5)
        response.raise_for_status()
        data = response.json()
        models = data.get("models", [])
        result["available_models"] = [
            m.get("name", m.get("model", "")) for m in models
        ]
        result["running"] = True
        logger.info(
            f"Ollama is running at {_base_url} — "
            f"{len(result['available_models'])} model(s) available"
        )
    except requests.exceptions.ConnectionError:
        logger.debug(f"Ollama not reachable at {_base_url}")
    except Exception as exc:
        logger.debug(f"Ollama status check failed: {exc}")

    return result


# ── Convenience alias used by existing code ────────────────────────────────────

#: Alias so callers can use `from services.ollama_service import call_ollama`
def call_ollama(
    prompt: str,
    model: Optional[str] = None,
    system: str = "You are a JSON-only API. Respond with valid JSON only. No markdown, no explanation.",
    base_url: Optional[str] = None,
) -> Optional[str]:
    """
    Backward-compatible wrapper around :func:`generate`.
    Drop-in replacement for the ollama_client.call_ollama() function.
    """
    return generate(
        prompt=prompt,
        model=model,
        system=system,
        base_url=base_url,
    )
