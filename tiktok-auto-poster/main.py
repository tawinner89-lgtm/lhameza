"""
main.py — Daily TikTok video generator & poster for L'Hamza deals.

Run:   python main.py
Cron:  0 12 * * *  cd /path/to/tiktok-auto-poster && python main.py
"""

import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Load .env before importing anything else that reads env vars
load_dotenv(Path(__file__).parent / ".env")

from fetch_deal import fetch_top_deal
from generate_video import generate_video
from post_tiktok import post_video

# ─── Logging ─────────────────────────────────────────────────────────────────

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "daily.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
log = logging.getLogger("main")

# ─── Day counter (auto-increments in .env) ───────────────────────────────────

def _read_day() -> int:
    return int(os.getenv("DAY_COUNTER", "1"))


def _increment_day():
    """Bump DAY_COUNTER in the .env file after a successful run."""
    env_path = Path(__file__).parent / ".env"
    day = _read_day()
    new_day = day + 1

    lines = env_path.read_text(encoding="utf-8").splitlines(keepends=True)
    updated = []
    replaced = False
    for line in lines:
        if line.startswith("DAY_COUNTER="):
            updated.append(f"DAY_COUNTER={new_day}\n")
            replaced = True
        else:
            updated.append(line)
    if not replaced:
        updated.append(f"DAY_COUNTER={new_day}\n")

    env_path.write_text("".join(updated), encoding="utf-8")
    log.info("DAY_COUNTER updated: %d → %d", day, new_day)


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    day = _read_day()

    log.info("=" * 60)
    log.info("L'HAMZA TikTok Auto-Poster  —  %s  —  Day %d", now, day)
    log.info("=" * 60)

    # 1. Fetch today's top deal from Supabase
    log.info("Step 1/3 — Fetching top deal from Supabase…")
    deal = fetch_top_deal()
    log.info(
        "Deal: %s  |  -%d%%  |  %s MAD  |  %s",
        deal["title"][:60],
        deal.get("discount_percent", 0),
        deal.get("discounted_price", "?"),
        deal.get("store", ""),
    )

    # 2. Generate video
    log.info("Step 2/3 — Generating TikTok video…")
    video_path = generate_video(deal, day)
    log.info("Video generated: %s  (%.1f MB)", video_path, video_path.stat().st_size / 1e6)

    # 3. Post to TikTok
    log.info("Step 3/3 — Posting to TikTok…")
    try:
        post_video(video_path, deal)
        log.info("✅ Posted to TikTok successfully!")
        _increment_day()
    except RuntimeError as exc:
        log.error("❌ TikTok post failed: %s", exc)
        log.info("Video saved locally at: %s", video_path)
        log.info("You can post it manually from the output/ folder.")
        sys.exit(1)

    log.info("Done. See you tomorrow! 🇲🇦")


if __name__ == "__main__":
    main()
