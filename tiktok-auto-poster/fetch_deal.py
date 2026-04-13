"""
fetch_deal.py — Fetch today's top deal from Supabase.
Falls back to mock data if Supabase is unavailable.
"""

import os
import logging
from datetime import datetime, timezone, timedelta

log = logging.getLogger(__name__)

# ── Mock fallback (used when Supabase is down or returns nothing) ─────────────

MOCK_DEAL = {
    "id": 0,
    "title": "Écouteurs Bluetooth TWS - Réduction de bruit",
    "original_price": 299,
    "discounted_price": 149,
    "discount_percent": 50,
    "store": "AliExpress",
    "image_url": None,   # None → Scene 1 shows a placeholder
    "created_at": datetime.now(timezone.utc).isoformat(),
}

# ── Supabase fetch ────────────────────────────────────────────────────────────

def fetch_top_deal() -> dict:
    """
    Returns the best deal posted in the last 24 h (highest discount).
    Falls back to MOCK_DEAL on any error.
    """
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_KEY", "")

    if not supabase_url or not supabase_key:
        log.warning("SUPABASE_URL / SUPABASE_KEY not set — using mock deal")
        return MOCK_DEAL

    try:
        from supabase import create_client

        client = create_client(supabase_url, supabase_key)

        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

        # Column mapping: the Supabase deals table uses snake_case
        # Adapt if your column names differ.
        resp = (
            client.table("deals")
            .select(
                "id, title, price, original_price, discount, source, image, created_at"
            )
            .gte("created_at", since)
            .gte("discount", 10)
            .order("discount", desc=True)
            .limit(1)
            .execute()
        )

        rows = resp.data if resp.data else []

        if not rows:
            log.warning("Supabase returned 0 deals — using mock deal")
            return MOCK_DEAL

        row = rows[0]

        # Normalise to expected keys (handle column name variants)
        deal = {
            "id": row.get("id", 0),
            "title": row.get("title") or row.get("name") or "Deal du jour",
            "original_price": float(row.get("original_price") or 0),
            "discounted_price": float(row.get("price") or 0),
            "discount_percent": int(row.get("discount") or 0),
            "store": row.get("source") or "L'Hamza",
            "image_url": row.get("image") or row.get("image_url"),
            "created_at": row.get("created_at", ""),
        }

        log.info(
            "Fetched deal: %s — -%d%% (%s)",
            deal["title"][:50],
            deal["discount_percent"],
            deal["store"],
        )
        return deal

    except Exception as exc:
        log.error("Supabase fetch failed: %s — using mock deal", exc)
        return MOCK_DEAL
