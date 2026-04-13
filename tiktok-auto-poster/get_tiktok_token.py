"""
get_tiktok_token.py — One-time OAuth 2.0 flow to obtain a TikTok user access token.

Run ONCE to get your TIKTOK_ACCESS_TOKEN, then paste it into .env.

Steps:
  1. python get_tiktok_token.py
  2. Open the printed URL in your browser
  3. Log in / authorize the app
  4. Copy the full redirect URL from your browser address bar and paste it here
  5. Your access token + refresh token are printed → copy to .env

Requirements: your TikTok app must have redirect URI set to http://localhost:8080/callback
"""

import hashlib
import os
import secrets
import sys
import urllib.parse
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import requests

CLIENT_KEY    = os.getenv("TIKTOK_CLIENT_KEY", "")
CLIENT_SECRET = os.getenv("TIKTOK_CLIENT_SECRET", "")
REDIRECT_URI  = "http://localhost:8080/callback"

AUTH_URL    = "https://www.tiktok.com/v2/auth/authorize/"
TOKEN_URL   = "https://open.tiktokapis.com/v2/oauth/token/"

SCOPES = "video.publish,user.info.basic"


def main():
    if not CLIENT_KEY or not CLIENT_SECRET:
        print("ERROR: TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be set in .env")
        sys.exit(1)

    # PKCE code verifier + challenge
    code_verifier  = secrets.token_urlsafe(64)
    code_challenge = (
        hashlib.sha256(code_verifier.encode()).digest().hex()
    )
    state = secrets.token_urlsafe(16)

    params = {
        "client_key":             CLIENT_KEY,
        "response_type":          "code",
        "scope":                  SCOPES,
        "redirect_uri":           REDIRECT_URI,
        "state":                  state,
        "code_challenge":         code_challenge,
        "code_challenge_method":  "S256",
    }
    auth_link = AUTH_URL + "?" + urllib.parse.urlencode(params)

    print("\n" + "=" * 70)
    print("STEP 1 — Open this URL in your browser and authorize the app:")
    print("=" * 70)
    print(auth_link)
    print()

    redirect_raw = input(
        "STEP 2 — Paste the full redirect URL from your browser here:\n> "
    ).strip()

    parsed   = urllib.parse.urlparse(redirect_raw)
    qs       = urllib.parse.parse_qs(parsed.query)
    code     = qs.get("code", [None])[0]
    got_state = qs.get("state", [None])[0]

    if not code:
        print("ERROR: Could not extract authorization code from URL.")
        sys.exit(1)
    if got_state != state:
        print("WARNING: state mismatch — possible CSRF. Proceeding anyway.")

    print("\nExchanging authorization code for access token…")

    resp = requests.post(
        TOKEN_URL,
        data={
            "client_key":     CLIENT_KEY,
            "client_secret":  CLIENT_SECRET,
            "code":           code,
            "grant_type":     "authorization_code",
            "redirect_uri":   REDIRECT_URI,
            "code_verifier":  code_verifier,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )

    data = resp.json()

    if "access_token" not in data:
        print(f"ERROR: Token exchange failed: {data}")
        sys.exit(1)

    access_token  = data["access_token"]
    refresh_token = data.get("refresh_token", "")
    expires_in    = data.get("expires_in", "?")

    print("\n" + "=" * 70)
    print("SUCCESS! Copy these into your .env file:")
    print("=" * 70)
    print(f"TIKTOK_ACCESS_TOKEN={access_token}")
    if refresh_token:
        print(f"TIKTOK_REFRESH_TOKEN={refresh_token}")
    print(f"\nToken expires in: {expires_in} seconds (~{int(str(expires_in).replace('?','0')) // 86400} days)")
    print()
    print("Once the token expires, re-run this script to get a new one.")


if __name__ == "__main__":
    main()
