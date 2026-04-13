# L'Hamza TikTok Auto-Poster

Daily TikTok video generator + poster for L'Hamza deals.

## Quick Start

### 1. Install dependencies

```bash
cd tiktok-auto-poster
pip install -r requirements.txt
```

### 2. Install FFmpeg (required by MoviePy)

Windows: download from https://ffmpeg.org/download.html → add to PATH

### 3. Add fonts (recommended)

Download Montserrat Bold from https://fonts.google.com/specimen/Montserrat  
Place `Montserrat-Bold.ttf` and `Montserrat-Regular.ttf` in `assets/fonts/`

Without them the system uses Arial/system fallback (still works).

### 4. Add background music (optional)

Place any `.mp3` in `assets/music/bgm.mp3`  
Without it the video is generated silently.

### 5. Configure .env

```env
# Your TikTok app credentials (rotate immediately after use in chat)
TIKTOK_CLIENT_KEY=your_key
TIKTOK_CLIENT_SECRET=your_secret
TIKTOK_ACCESS_TOKEN=   ← fill this in step 6

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_anon_key

DAY_COUNTER=1
```

### 6. Get your TikTok access token (one-time)

```bash
python get_tiktok_token.py
```

This opens the TikTok OAuth flow in your browser, exchanges the code, and
prints your `TIKTOK_ACCESS_TOKEN`. Paste it into `.env`.

**The token is valid for ~24 hours.** Re-run when it expires.

### 7. Run

```bash
python main.py
```

The script:
1. Fetches the best deal of the day from Supabase
2. Generates a 1080×1920 MP4 with 3 scenes (~12s)
3. Uploads + publishes it to TikTok
4. Increments `DAY_COUNTER` in `.env`
5. Logs everything to `logs/daily.log`

---

## Automate (Windows Task Scheduler)

Run daily at 12:00:

```
Program:  python
Arguments: C:\Users\dell\Desktop\centre data\tiktok-auto-poster\main.py
Start in: C:\Users\dell\Desktop\centre data\tiktok-auto-poster\
```

---

## File structure

```
tiktok-auto-poster/
├── .env                   # credentials (never commit this)
├── main.py                # entry point
├── fetch_deal.py          # Supabase deal fetcher
├── generate_video.py      # video generation (MoviePy + Pillow)
├── post_tiktok.py         # TikTok Content Posting API v2
├── get_tiktok_token.py    # OAuth helper (one-time)
├── requirements.txt
├── assets/
│   ├── fonts/             # Montserrat-Bold.ttf etc.
│   ├── music/bgm.mp3      # background music
│   └── logo/              # lhamza_logo.png
├── output/
│   └── daily_video.mp4    # generated video
└── logs/
    └── daily.log
```

---

## Video scenes

| Scene | Duration | Content |
|-------|----------|---------|
| 1 — Product | 4s | Product image (Ken Burns zoom) + prices + store badge |
| 2 — Daily Deal | 4s | Neon glassmorphism card, "DAY {N}", discount pill |
| 3 — CTA | 4s | Telegram + website links, notification bell |

---

## Troubleshooting

**`TIKTOK_ACCESS_TOKEN not set`** — run `get_tiktok_token.py`

**`TikTok init failed: spam_risk_too_many_requests`** — wait 24 h between posts

**`No module named 'moviepy'`** — `pip install -r requirements.txt`

**`FileNotFoundError: ffmpeg`** — install FFmpeg and add it to your PATH
