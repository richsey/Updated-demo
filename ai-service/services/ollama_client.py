"""
Ollama Local LLM Client
========================
Provides a simple interface to call a locally-running Ollama instance.
Configured via environment variables:

  OLLAMA_BASE_URL   — Ollama server URL (default: http://localhost:11434)
  OLLAMA_MODEL      — Model to use       (default: llama3.2)

Falls back gracefully (returns None) if Ollama is not running or the model
is unavailable, allowing callers to try the next provider in the chain.
"""

import os
import json
import logging
import re
from typing import Optional

logger = logging.getLogger("ollama_client")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(name)s] %(message)s"))
    logger.addHandler(handler)

# ── Configuration ──────────────────────────────────────────────────────────────

OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str    = os.getenv("OLLAMA_MODEL", "llama3.2")


def _strip_fences(text: str) -> str:
    """Remove markdown code fences that some models add despite instructions."""
    text = text.strip()
    # Strip ```json ... ``` or ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def call_ollama(
    prompt: str,
    model: Optional[str] = None,
    system: str = "You are a JSON-only API. Respond with valid JSON only. No markdown, no explanation.",
    base_url: Optional[str] = None,
) -> Optional[str]:
    """
    Call a locally-running Ollama instance and return the raw text response.

    Parameters
    ----------
    prompt   : The user prompt to send.
    model    : Model name (overrides OLLAMA_MODEL env var).
    system   : System instruction prepended to the conversation.
    base_url : Ollama server URL (overrides OLLAMA_BASE_URL env var).

    Returns
    -------
    str | None — Raw response text, or None if Ollama is unavailable / errors.
    """
    _model    = model    or OLLAMA_MODEL
    _base_url = base_url or OLLAMA_BASE_URL

    try:
        import ollama  # imported lazily so missing package doesn't crash startup

        logger.info(f"Calling Ollama model='{_model}' at {_base_url} ...")

        client = ollama.Client(host=_base_url)

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        response = client.chat(
            model=_model,
            messages=messages,
            stream=False,
            options={"temperature": 0.7},
        )

        raw: str = response["message"]["content"].strip()
        raw = _strip_fences(raw)

        logger.info(f"Ollama response received ({len(raw)} chars)")
        return raw

    except ImportError:
        logger.warning("ollama package not installed — run: pip install ollama")
        return None
    except Exception as e:
        # ConnectionRefusedError, model not found, timeout, etc.
        logger.warning(f"Ollama unavailable or error: {type(e).__name__}: {e}")
        return None


def get_ollama_status(base_url: Optional[str] = None) -> dict:
    """
    Check whether the local Ollama server is running and list available models.

    Returns
    -------
    dict with keys: running (bool), model (str), base_url (str),
                    available_models (list[str])
    """
    _base_url = base_url or OLLAMA_BASE_URL

    result = {
        "running": False,
        "model": OLLAMA_MODEL,
        "base_url": _base_url,
        "available_models": [],
    }

    try:
        import ollama

        client = ollama.Client(host=_base_url)
        models_response = client.list()

        # Response is a dict with a 'models' key
        models = models_response.get("models", [])
        result["available_models"] = [m.get("name", m.get("model", "")) for m in models]
        result["running"] = True

    except ImportError:
        logger.warning("ollama package not installed")
    except Exception as e:
        logger.debug(f"Ollama not running: {e}")

    return result
