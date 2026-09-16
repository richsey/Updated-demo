#!/usr/bin/env python3
"""
backfill_embeddable.py — One-off script to populate materials.embeddable
for every existing row whose embeddable column is still NULL.

Features
--------
- Resumable: skips rows where embeddable IS NOT NULL (already checked).
- Rate-limited: pauses RATE_LIMIT_DELAY_S seconds between requests so we
  don't hammer external servers or trip Supabase rate limits.
- Per-host deduplication: if two materials share the same hostname, the
  second one reuses the result from the Phase 2 link_embed_cache table
  (the embeddability checker writes to it automatically).
- Dry-run mode: pass --dry-run to print what would happen without
  writing anything to the database.
- Progress reporting: prints a running tally every REPORT_EVERY rows.

Usage
-----
    cd ai-service
    source venv/bin/activate

    # Live run (writes to DB):
    python backfill_embeddable.py

    # Preview only (no writes):
    python backfill_embeddable.py --dry-run

    # Adjust rate limit (seconds between requests):
    python backfill_embeddable.py --delay 1.5

Environment
-----------
Reads from ai-service/.env (same as main.py):
    SUPABASE_URL
    SUPABASE_KEY  (or SUPABASE_SERVICE_ROLE_KEY)
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
import os

# ── Load env (works whether run from ai-service/ or project root) ─────────────
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=str(_env_path))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] SUPABASE_URL and SUPABASE_KEY must be set in ai-service/.env", file=sys.stderr)
    sys.exit(1)

from supabase import create_client
from services.embeddability import check_embeddability

# ── Tunables ──────────────────────────────────────────────────────────────────
RATE_LIMIT_DELAY_S: float = 1.0   # seconds to wait between network probes
REPORT_EVERY: int = 10            # print a progress line every N rows
PAGE_SIZE: int = 100              # rows fetched per Supabase page


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Backfill materials.embeddable column")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print results without writing to the database.",
    )
    p.add_argument(
        "--delay",
        type=float,
        default=RATE_LIMIT_DELAY_S,
        metavar="SECONDS",
        help=f"Delay between network probes (default: {RATE_LIMIT_DELAY_S}s).",
    )
    return p.parse_args()


def column_exists(client, table: str, column: str) -> bool:
    """Return True if `column` exists on `table` in the public schema."""
    try:
        resp = (
            client.table("information_schema.columns")  # type: ignore[arg-type]
            .select("column_name")
            .eq("table_schema", "public")
            .eq("table_name", table)
            .eq("column_name", column)
            .execute()
        )
        return bool(resp.data)
    except Exception:
        return False


def fetch_unchecked(client, page: int, has_embeddable_col: bool) -> list[dict]:
    """Fetch one page of materials.
    If the embeddable column already exists, only fetch NULL rows (resumable).
    If the column doesn't exist yet, fetch all rows.
    """
    q = client.table("materials").select("id, url, title")
    if has_embeddable_col:
        q = q.is_("embeddable", "null")
    return (q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).execute().data or [])


def write_result(client, material_id: str, embeddable: bool) -> None:
    """Update a single row in materials."""
    client.table("materials").update({"embeddable": embeddable}).eq("id", material_id).execute()


def main() -> None:
    args = parse_args()
    delay = args.delay
    dry_run = args.dry_run

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── Check if the migration has been run ──────────────────────────────────
    has_embeddable_col = column_exists(client, "materials", "embeddable")
    if not has_embeddable_col:
        print(
            "[WARNING] The `embeddable` column does not yet exist on `materials`.\n"
            "          Run migration 002_materials_embeddable.sql in Supabase first.\n"
            "          Continuing in preview mode — all rows will be fetched but "
            "no DB writes will occur regardless of --dry-run flag.\n"
        )
        dry_run = True  # force dry-run to prevent a crash on write

    print(f"[Backfill] Starting {'(DRY RUN) ' if dry_run else ''}embeddability backfill")
    print(f"[Backfill] Rate limit: {delay}s between network probes")
    print(f"[Backfill] embeddable column present: {has_embeddable_col}")
    print("-" * 60)

    total_processed = 0
    total_embeddable = 0
    total_blocked = 0
    total_skipped = 0   # rows with empty/None URL
    last_probe_at: float = 0.0

    page = 0
    while True:
        rows = fetch_unchecked(client, page, has_embeddable_col)
        if not rows:
            break  # no more un-checked rows

        for row in rows:
            material_id: str = row["id"]
            url: str | None = row.get("url", "")
            title: str = row.get("title", "")

            if not url or not url.strip():
                print(f"  [SKIP]  {title[:50]!r} — no URL stored")
                if not dry_run:
                    # Mark as non-embeddable so it gets the fallback card
                    write_result(client, material_id, False)
                total_skipped += 1
                total_processed += 1
                continue

            # Respect rate limit only before actual network calls
            elapsed = time.monotonic() - last_probe_at
            if elapsed < delay:
                time.sleep(delay - elapsed)

            result = check_embeddability(url.strip(), supabase_client=client)
            last_probe_at = time.monotonic()

            embeddable: bool = result["embeddable"]
            reason: str = result["reason"]
            from_cache: bool = result.get("from_cache", False)

            status = "✓ embed" if embeddable else "✗ block"
            cache_tag = " [cache]" if from_cache else ""
            print(
                f"  [{status}]{cache_tag}  "
                f"{urlparse(url).hostname or url[:40]}  "
                f"— {reason[:60]}"
            )

            if not dry_run:
                write_result(client, material_id, embeddable)

            if embeddable:
                total_embeddable += 1
            else:
                total_blocked += 1
            total_processed += 1

            if total_processed % REPORT_EVERY == 0:
                print(
                    f"  [Progress] {total_processed} processed "
                    f"| {total_embeddable} embeddable "
                    f"| {total_blocked} blocked "
                    f"| {total_skipped} skipped"
                )

        # If this page was smaller than PAGE_SIZE, we've reached the end
        if len(rows) < PAGE_SIZE:
            break

        page += 1

    print("-" * 60)
    print(f"[Backfill] Done {'(DRY RUN — no writes made)' if dry_run else ''}")
    print(f"  Total processed : {total_processed}")
    print(f"  Embeddable (✓)  : {total_embeddable}")
    print(f"  Blocked    (✗)  : {total_blocked}")
    print(f"  Skipped (no URL): {total_skipped}")


if __name__ == "__main__":
    main()
