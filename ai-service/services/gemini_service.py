"""
Google Gemini Service — Client Wrapper
======================================
Provides a direct interface to Google Gemini (default: gemini-2.5-flash)
using the official google-genai SDK.

Configuration (environment variables):
  GEMINI_API_KEY  — Google Gemini API key
  GEMINI_MODEL    — Gemini model name to use (default: gemini-2.5-flash)
"""

import os
import logging
import time
from typing import Optional

logger = logging.getLogger("gemini_service")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(name)s] %(message)s"))
    logger.addHandler(handler)

# Configuration
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()


def generate_with_gemini(
    prompt: str,
    system_instruction: Optional[str] = None,
    json_mode: bool = False,
    temperature: float = 0.5,
) -> Optional[str]:
    """
    Send a prompt to Google Gemini and return the text.

    Parameters
    ----------
    prompt             : The prompt message.
    system_instruction : Optional system instruction/persona.
    json_mode          : If True, forces output format to application/json.
    temperature        : Control randomness (0.0 to 2.0).

    Returns
    -------
    str | None — Response content or None if error/unconfigured.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip() or GEMINI_API_KEY
    model_name = os.getenv("GEMINI_MODEL", "").strip() or GEMINI_MODEL
    if not api_key:
        logger.warning("[AI] GEMINI_API_KEY is not set. Cannot call Gemini.")
        return None

    try:
        from google import genai
        from google.genai import types as genai_types

        logger.info(f"[AI] Calling Gemini ({model_name})...")
        t0 = time.time()

        client = genai.Client(api_key=api_key)

        config = genai_types.GenerateContentConfig(
            temperature=temperature,
            system_instruction=system_instruction,
            response_mime_type="application/json" if json_mode else None,
        )

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=config,
        )

        raw = response.text
        if not raw:
            logger.warning("[AI] Gemini returned empty response text.")
            return None

        raw = raw.strip()
        # Clean markdown code fences if response_mime_type wasn't respected or fences were added
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        elapsed = time.time() - t0
        logger.info(f"[AI] Gemini response received in {elapsed:.2f}s ({len(raw)} chars)")
        return raw

    except ImportError:
        logger.error("[AI] google-genai library not installed. Install with: pip install google-genai")
        return None
    except Exception as e:
        logger.error(f"[AI] Error calling Gemini API: {type(e).__name__}: {e}")
        return None


def get_gemini_status() -> dict:
    """
    Check if Gemini is configured and verify connectivity by sending a simple query.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip() or GEMINI_API_KEY
    model_name = os.getenv("GEMINI_MODEL", "").strip() or GEMINI_MODEL
    result = {
        "configured": bool(api_key),
        "status": "Ready" if api_key else "Missing API Key",
        "model": model_name,
        "error": None,
    }

    if not api_key:
        return result

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        # Fast connection test
        response = client.models.generate_content(
            model=model_name,
            contents="ping",
        )
        if response.text:
            result["status"] = "Ready"
        else:
            result["status"] = "Error"
            result["error"] = "Received empty response from Gemini test call"
    except ImportError:
        result["status"] = "Error"
        result["error"] = "google-genai library is not installed in the Python environment"
    except Exception as e:
        result["status"] = "Error"
        result["error"] = f"{type(e).__name__}: {e}"

    return result

