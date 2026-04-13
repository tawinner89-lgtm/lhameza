"""
post_tiktok.py — Post a video to TikTok via Content Posting API v2.

TikTok Content Posting API flow (Direct Post):
  1. POST /v2/post/publish/video/init/   → get publish_id + upload_url
  2. PUT  <upload_url>                    → upload the video bytes
  3. GET  /v2/post/publish/status/fetch/ → poll until status == "PUBLISH_COMPLETE"

Docs: https://developers.tiktok.com/doc/content-posting-api-get-started/

IMPORTANT: This requires a USER access token (not just client credentials).
The access token must have the `video.publish` scope granted by the TikTok user.
Obtain it via the OAuth 2.0 authorization code flow (one-time manual step).
"""

import logging
import os
import time
from pathlib import Path

import requests

log = logging.getLogger(__name__)

TIKTOK_API_BASE = "https://open.tiktokapis.com"


def _get_access_token() -> str:
    token = os.getenv("TIKTOK_ACCESS_TOKEN", "")
    if not token:
        raise RuntimeError(
            "TIKTOK_ACCESS_TOKEN not set in .env. "
            "Complete the OAuth flow once to obtain a user access token with "
            "the video.publish scope, then save it to .env."
        )
    return token


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=UTF-8",
    }


# ─── Step 1: Initialize the video upload ─────────────────────────────────────

def _init_upload(token: str, video_path: Path, caption: str) -> dict:
    """
    POST /v2/post/publish/video/init/
    Returns: { publish_id, upload_url }
    """
    file_size = video_path.stat().st_size

    payload = {
        "post_info": {
            "title": caption[:2200],          # TikTok caption limit
            "privacy_level": "PUBLIC_TO_EVERYONE",
            "disable_duet": False,
            "disable_comment": False,
            "disable_stitch": False,
            "video_cover_timestamp_ms": 1000,
        },
        "source_info": {
            "source": "FILE_UPLOAD",
            "video_size": file_size,
            "chunk_size": file_size,           # single-chunk upload
            "total_chunk_count": 1,
        },
    }

    resp = requests.post(
        f"{TIKTOK_API_BASE}/v2/post/publish/video/init/",
        json=payload,
        headers=_headers(token),
        timeout=30,
    )

    data = resp.json()
    log.debug("init/ response: %s", data)

    if resp.status_code != 200 or data.get("error", {}).get("code") != "ok":
        err = data.get("error", {})
        raise RuntimeError(
            f"TikTok init failed [{resp.status_code}]: "
            f"{err.get('code')} — {err.get('message')}"
        )

    result = data["data"]
    return {
        "publish_id": result["publish_id"],
        "upload_url": result["upload_url"],
    }


# ─── Step 2: Upload the video file ───────────────────────────────────────────

def _upload_video(upload_url: str, video_path: Path):
    """
    PUT <upload_url>  with the raw video bytes.
    TikTok requires Content-Range header even for single-chunk uploads.
    """
    file_size = video_path.stat().st_size

    with open(video_path, "rb") as f:
        video_bytes = f.read()

    resp = requests.put(
        upload_url,
        data=video_bytes,
        headers={
            "Content-Type": "video/mp4",
            "Content-Length": str(file_size),
            "Content-Range": f"bytes 0-{file_size - 1}/{file_size}",
        },
        timeout=120,
    )

    if resp.status_code not in (200, 201, 204):
        raise RuntimeError(
            f"TikTok video upload failed [{resp.status_code}]: {resp.text[:300]}"
        )

    log.info("Video uploaded successfully (%d bytes)", file_size)


# ─── Step 3: Poll for publish status ─────────────────────────────────────────

def _poll_status(token: str, publish_id: str, max_wait: int = 120) -> bool:
    """
    Poll /v2/post/publish/status/fetch/ until status == "PUBLISH_COMPLETE"
    or timeout.
    """
    deadline = time.time() + max_wait

    while time.time() < deadline:
        resp = requests.post(
            f"{TIKTOK_API_BASE}/v2/post/publish/status/fetch/",
            json={"publish_id": publish_id},
            headers=_headers(token),
            timeout=15,
        )
        data = resp.json()
        status = data.get("data", {}).get("status", "UNKNOWN")
        log.debug("publish status: %s", status)

        if status == "PUBLISH_COMPLETE":
            log.info("TikTok post published successfully (publish_id=%s)", publish_id)
            return True
        if status in ("FAILED", "PUBLISH_FAILED"):
            err = data.get("data", {}).get("fail_reason", "unknown")
            raise RuntimeError(f"TikTok publish failed: {err}")

        time.sleep(5)

    raise RuntimeError(
        f"Timed out waiting for TikTok publish status after {max_wait}s"
    )


# ─── Public API ──────────────────────────────────────────────────────────────

def post_video(video_path: Path, deal: dict) -> bool:
    """
    Upload and publish *video_path* to TikTok.
    Returns True on success, raises on failure.
    """
    token = _get_access_token()

    title  = deal.get("title", "Deal du jour")[:50]
    pct    = deal.get("discount_percent", 0)
    store  = deal.get("store", "L'Hamza")

    caption = (
        f"🔥 Deal du jour - {title} | -{pct}% sur {store} | "
        f"Lien dans bio 👇 "
        f"#lhamza #deals #maroc #bonplan #promo #shopping"
    )

    log.info("Initializing TikTok upload…")
    init = _init_upload(token, video_path, caption)

    log.info("Uploading video to TikTok (publish_id=%s)…", init["publish_id"])
    _upload_video(init["upload_url"], video_path)

    log.info("Polling publish status…")
    _poll_status(token, init["publish_id"])

    return True
