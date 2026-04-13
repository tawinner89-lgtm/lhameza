"""
generate_video.py — Generate a 9:16 TikTok video (1080×1920) with 3 scenes.

Scenes:
  1. Product showcase  — product image + prices, Ken Burns zoom
  2. Daily Deal card   — neon glassmorphism card, "DAY {N}"
  3. CTA card          — Telegram + website links

Dependencies: moviepy==1.0.3  pillow  requests  numpy
"""

import io
import math
import os
import textwrap
import urllib.request
from pathlib import Path
from typing import Optional

import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# moviepy 1.x API
from moviepy.editor import (
    AudioFileClip,
    CompositeVideoClip,
    ImageClip,
    concatenate_videoclips,
)
from moviepy.audio.AudioClip import AudioArrayClip

# ─── Constants ────────────────────────────────────────────────────────────────

W, H = 1080, 1920          # 9:16
SCENE_DUR = 4.0            # seconds per scene
FPS = 30
TOTAL_DUR = SCENE_DUR * 3

BG_DARK = "#0d1f2d"        # deep teal-dark
CYAN    = "#00f5ff"
ORANGE  = "#ff6b00"
WHITE   = "#ffffff"
RED_STR = "#ff3b3b"
GREEN   = "#00e676"

ASSETS = Path(__file__).parent / "assets"
FONTS_DIR  = ASSETS / "fonts"
MUSIC_PATH = ASSETS / "music" / "bgm.mp3"
LOGO_PATH  = ASSETS / "logo" / "lhamza_logo.png"

OUTPUT_PATH = Path(__file__).parent / "output" / "daily_video.mp4"

# ─── Font helpers ─────────────────────────────────────────────────────────────

def _load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    """Try project fonts directory first, then system fallbacks."""
    candidates = []
    if bold:
        candidates += [
            FONTS_DIR / "Montserrat-Bold.ttf",
            FONTS_DIR / "Roboto-Bold.ttf",
            "/c/Windows/Fonts/arialbd.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
    else:
        candidates += [
            FONTS_DIR / "Montserrat-Regular.ttf",
            FONTS_DIR / "Roboto-Regular.ttf",
            "/c/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]

    for p in candidates:
        try:
            return ImageFont.truetype(str(p), size)
        except Exception:
            pass

    # Last resort: default bitmap font (no size control)
    return ImageFont.load_default()


# ─── Drawing helpers ──────────────────────────────────────────────────────────

def hex2rgb(h: str) -> tuple:
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def draw_neon_rect(
    img: Image.Image,
    xy: tuple,
    color: str,
    width: int = 3,
    blur: int = 18,
    layers: int = 4,
):
    """Draw a glowing neon rectangle border by stacking blurred layers."""
    for i in range(layers, 0, -1):
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        r, g, b = hex2rgb(color)
        alpha = int(180 * (i / layers))
        expand = (layers - i) * 4
        x0, y0, x1, y1 = xy
        d.rectangle(
            [x0 - expand, y0 - expand, x1 + expand, y1 + expand],
            outline=(r, g, b, alpha),
            width=width + expand,
        )
        blurred = layer.filter(ImageFilter.GaussianBlur(blur))
        img = Image.alpha_composite(img.convert("RGBA"), blurred)
    return img


def draw_glassmorphism_card(
    img: Image.Image,
    xy: tuple,
    border_color_top: str = CYAN,
    border_color_bot: str = ORANGE,
) -> Image.Image:
    """
    Draw a frosted glass card:
    - semi-transparent dark fill
    - blurred reflection layer
    - neon border glow (cyan top, orange bottom)
    """
    img = img.convert("RGBA")
    x0, y0, x1, y1 = xy
    radius = 40

    # Frosted fill
    card = Image.new("RGBA", img.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle(xy, radius=radius, fill=(13, 31, 45, 200))
    # Subtle white edge
    cd.rounded_rectangle(xy, radius=radius, outline=(255, 255, 255, 30), width=2)
    img = Image.alpha_composite(img, card)

    # Neon glow — top half cyan, bottom half orange
    mid_y = (y0 + y1) // 2
    img = draw_neon_rect(img, (x0, y0, x1, mid_y), border_color_top, width=3, blur=20)
    img = draw_neon_rect(img, (x0, mid_y, x1, y1), border_color_bot, width=3, blur=20)

    return img


def text_centered(draw, y, text, font, fill, img_w=W, shadow=True):
    """Draw horizontally centered text with optional drop shadow."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (img_w - tw) // 2
    if shadow:
        draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 160))
    draw.text((x, y), text, font=font, fill=fill)


def draw_circuit_lines(draw, count=12):
    """Subtle background circuit-board lines in cyan."""
    import random
    rng = random.Random(42)
    for _ in range(count):
        x = rng.randint(0, W)
        y = rng.randint(0, H)
        length = rng.randint(40, 160)
        horiz = rng.choice([True, False])
        alpha = rng.randint(20, 60)
        color = (*hex2rgb(CYAN), alpha)
        if horiz:
            draw.line([(x, y), (x + length, y)], fill=color, width=1)
            # Corner dot
            draw.ellipse([(x + length - 3, y - 3), (x + length + 3, y + 3)], fill=color)
        else:
            draw.line([(x, y), (x, y + length)], fill=color, width=1)
            draw.ellipse([(x - 3, y + length - 3), (x + 3, y + length + 3)], fill=color)


def gradient_background(size=(W, H), top=BG_DARK, bottom="#060f17") -> Image.Image:
    """Create a vertical gradient background."""
    base = Image.new("RGBA", size, hex2rgb(top) + (255,))
    arr = np.array(base, dtype=np.float32)
    t_rgb = np.array(hex2rgb(top),    dtype=np.float32)
    b_rgb = np.array(hex2rgb(bottom), dtype=np.float32)
    for row in range(size[1]):
        t = row / size[1]
        arr[row, :, :3] = t_rgb * (1 - t) + b_rgb * t
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


# ─── Image download ───────────────────────────────────────────────────────────

def download_image(url: str, max_size=(800, 800)) -> Optional[Image.Image]:
    if not url:
        return None
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
        img.thumbnail(max_size, Image.LANCZOS)
        return img
    except Exception:
        return None


def placeholder_product_image(size=(600, 600)) -> Image.Image:
    """Return a styled placeholder when product image is unavailable."""
    img = Image.new("RGBA", size, (20, 40, 60, 255))
    d = ImageDraw.Draw(img)
    font = _load_font(32)
    d.text((size[0] // 2 - 60, size[1] // 2 - 20), "📦 Deal", font=font, fill=WHITE)
    return img


# ─── Scene 1 — Product showcase ──────────────────────────────────────────────

def make_scene1_frame(deal: dict, t: float, duration: float) -> np.ndarray:
    """
    Ken Burns zoom: product image slowly zooms from 1.0x → 1.15x over the scene.
    Prices slide in from bottom after 0.5 s.
    """
    img = gradient_background()
    d = ImageDraw.Draw(img)

    # Background circuit lines
    draw_circuit_lines(d, count=8)

    # Product image with Ken Burns zoom
    prod_img = deal.get("_product_img")  # pre-loaded PIL image
    if prod_img is None:
        prod_img = placeholder_product_image()

    zoom = 1.0 + 0.15 * (t / duration)
    pw, ph = prod_img.size
    nw, nh = int(pw * zoom), int(ph * zoom)
    zoomed = prod_img.resize((nw, nh), Image.LANCZOS)
    # Crop center to original size
    cx, cy = nw // 2, nh // 2
    crop_box = (cx - pw // 2, cy - ph // 2, cx + pw // 2, cy + ph // 2)
    cropped = zoomed.crop(crop_box)

    # Paste product image centered vertically in top 55% of frame
    px = (W - cropped.width) // 2
    py = int(H * 0.08)
    img.paste(cropped, (px, py), cropped)

    # Store badge
    store = deal.get("store", "L'Hamza")
    badge_font = _load_font(36)
    badge_text = f"  {store}  "
    bbox = d.textbbox((0, 0), badge_text, font=badge_font)
    bw = bbox[2] - bbox[0] + 20
    bh = bbox[3] - bbox[1] + 16
    bx = 60
    by = py + cropped.height + 30
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=12,
                         fill=hex2rgb(ORANGE) + (230,))
    d.text((bx + 10, by + 8), badge_text, font=badge_font, fill=WHITE)

    # Prices — slide in from bottom after 0.5 s
    price_alpha = min(1.0, max(0.0, (t - 0.5) / 0.5))
    slide_y_offset = int((1 - price_alpha) * 120)

    orig  = deal.get("original_price", 0)
    disc  = deal.get("discounted_price", 0)
    pct   = deal.get("discount_percent", 0)

    price_y = int(H * 0.62) + slide_y_offset

    # Original price — crossed out, red
    if orig and orig > disc:
        orig_font = _load_font(52)
        orig_text = f"{int(orig)} MAD"
        bbox = d.textbbox((0, 0), orig_text, font=orig_font)
        tw = bbox[2] - bbox[0]
        ox = (W - tw) // 2
        d.text((ox, price_y), orig_text, font=orig_font,
               fill=hex2rgb(RED_STR) + (int(255 * price_alpha),))
        # Strikethrough
        mid = price_y + (bbox[3] - bbox[1]) // 2
        d.line([(ox, mid), (ox + tw, mid)], fill=hex2rgb(RED_STR) + (int(255 * price_alpha),), width=4)
        price_y += 80

    # Discounted price — big, green
    disc_font = _load_font(100)
    disc_text = f"{int(disc)} MAD"
    bbox = d.textbbox((0, 0), disc_text, font=disc_font)
    tw = bbox[2] - bbox[0]
    dx = (W - tw) // 2
    # Glow shadow
    d.text((dx + 3, price_y + 3), disc_text, font=disc_font,
           fill=(0, 200, 100, int(120 * price_alpha)))
    d.text((dx, price_y), disc_text, font=disc_font,
           fill=hex2rgb(GREEN) + (int(255 * price_alpha),))
    price_y += 120

    # Discount pill
    if pct:
        pill_font = _load_font(44)
        pill_text = f" -{pct}% OFF "
        bbox = d.textbbox((0, 0), pill_text, font=pill_font)
        pw2 = bbox[2] - bbox[0] + 24
        ph2 = bbox[3] - bbox[1] + 18
        px2 = (W - pw2) // 2
        d.rounded_rectangle([px2, price_y, px2 + pw2, price_y + ph2],
                             radius=ph2 // 2, fill=hex2rgb(ORANGE) + (int(240 * price_alpha),))
        d.text((px2 + 12, price_y + 9), pill_text, font=pill_font,
               fill=WHITE)

    # Product title — bottom area
    title = deal.get("title", "")[:60]
    title_font = _load_font(42)
    lines = textwrap.wrap(title, width=26)
    ty = int(H * 0.85)
    for line in lines[:2]:
        text_centered(d, ty, line, title_font, WHITE)
        ty += 54

    return np.array(img.convert("RGB"))


# ─── Scene 2 — Daily Deal card ────────────────────────────────────────────────

def _draw_radar_icon(d: ImageDraw.Draw, cx: int, cy: int, r: int):
    """Draw a simple radar/target icon in cyan neon."""
    for ring_r in [r, r * 2 // 3, r // 3]:
        d.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
                  outline=hex2rgb(CYAN) + (200,), width=3)
    # Cross lines
    d.line([(cx - r, cy), (cx + r, cy)], fill=hex2rgb(CYAN) + (180,), width=2)
    d.line([(cx, cy - r), (cx, cy + r)], fill=hex2rgb(CYAN) + (180,), width=2)
    # Center dot
    d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=hex2rgb(CYAN))


def make_scene2_frame(deal: dict, day_number: int, t: float, duration: float) -> np.ndarray:
    img = gradient_background()
    d_bg = ImageDraw.Draw(img)
    draw_circuit_lines(d_bg, count=14)

    # Glassmorphism card — centered, 80% width
    card_w = int(W * 0.80)
    card_h = int(H * 0.70)
    card_x0 = (W - card_w) // 2
    card_y0 = (H - card_h) // 2
    card_x1 = card_x0 + card_w
    card_y1 = card_y0 + card_h

    img = draw_glassmorphism_card(img, (card_x0, card_y0, card_x1, card_y1))
    d = ImageDraw.Draw(img)

    # Neon pulse effect — oscillate glow width with time
    pulse = 0.5 + 0.5 * math.sin(t * math.pi * 2)

    # "DAILY DEAL" small caps label
    label_font = _load_font(36, bold=False)
    text_centered(d, card_y0 + 50, "DAILY  DEAL", label_font,
                  hex2rgb(CYAN) + (200,))

    # Radar icon
    radar_cy = card_y0 + 220
    _draw_radar_icon(d, W // 2, radar_cy, int(55 + pulse * 8))

    # "DAY X" — big bold
    day_font = _load_font(140)
    day_text = f"DAY {day_number}"
    text_centered(d, radar_cy + 90, day_text, day_font, WHITE)

    # Brand name
    brand_font = _load_font(64)
    text_centered(d, radar_cy + 260, "L'HAMZA", brand_font,
                  hex2rgb(CYAN))

    # Tagline
    tag_font = _load_font(34, bold=False)
    text_centered(d, radar_cy + 340, "deals du jour 🇲🇦", tag_font,
                  hex2rgb(WHITE) + (180,))

    # "+X% OFF" pill button — orange neon border
    pct = deal.get("discount_percent", 0)
    pill_font = _load_font(52)
    pill_text = f"+{pct}% OFF"
    bbox = d.textbbox((0, 0), pill_text, font=pill_font)
    pw2 = bbox[2] - bbox[0] + 60
    ph2 = bbox[3] - bbox[1] + 28
    px2 = (W - pw2) // 2
    py2 = card_y1 - ph2 - 60
    # Pill background
    d.rounded_rectangle([px2, py2, px2 + pw2, py2 + ph2],
                         radius=ph2 // 2,
                         fill=(255, 107, 0, 40),
                         outline=hex2rgb(ORANGE) + (int(200 + 55 * pulse),),
                         width=3)
    d.text((px2 + 30, py2 + 14), pill_text, font=pill_font,
           fill=hex2rgb(ORANGE))

    return np.array(img.convert("RGB"))


# ─── Scene 3 — CTA card ──────────────────────────────────────────────────────

def _draw_telegram_logo(d: ImageDraw.Draw, cx: int, cy: int, r: int):
    """Simple Telegram paper-plane icon."""
    # Outer circle
    d.ellipse([cx - r, cy - r, cx + r, cy + r],
              fill=(0, 136, 204, 220), outline=hex2rgb(CYAN) + (200,), width=3)
    # Paper plane polygon (simplified)
    arrow = [
        (cx - int(r * 0.5), cy + int(r * 0.2)),
        (cx + int(r * 0.6), cy - int(r * 0.1)),
        (cx - int(r * 0.1), cy - int(r * 0.4)),
    ]
    d.polygon(arrow, fill=(255, 255, 255, 230))


def _draw_globe_icon(d: ImageDraw.Draw, cx: int, cy: int, r: int):
    """Simple globe icon for website."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r],
              outline=hex2rgb(ORANGE) + (200,), width=3)
    # Vertical meridian
    d.arc([cx - int(r * 0.5), cy - r, cx + int(r * 0.5), cy + r],
          start=0, end=360, fill=hex2rgb(ORANGE) + (180,), width=2)
    # Equator
    d.line([(cx - r, cy), (cx + r, cy)],
           fill=hex2rgb(ORANGE) + (180,), width=2)


def make_scene3_frame(t: float, duration: float) -> np.ndarray:
    img = gradient_background()
    d_bg = ImageDraw.Draw(img)
    draw_circuit_lines(d_bg, count=14)

    # Card
    card_w = int(W * 0.80)
    card_h = int(H * 0.72)
    card_x0 = (W - card_w) // 2
    card_y0 = (H - card_h) // 2
    card_x1 = card_x0 + card_w
    card_y1 = card_y0 + card_h

    img = draw_glassmorphism_card(img, (card_x0, card_y0, card_x1, card_y1),
                                  border_color_top=ORANGE,
                                  border_color_bot=CYAN)
    d = ImageDraw.Draw(img)

    pulse = 0.5 + 0.5 * math.sin(t * math.pi * 1.5)

    # Header
    header_font = _load_font(38, bold=False)
    text_centered(d, card_y0 + 50, "CONNECT  WITH  US", header_font,
                  hex2rgb(CYAN) + (200,))

    # Icons — Telegram + Globe side by side
    icon_y = card_y0 + 200
    icon_r = 65
    tg_cx = W // 2 - 160
    web_cx = W // 2 + 160

    _draw_telegram_logo(d, tg_cx, icon_y, icon_r)
    _draw_globe_icon(d, web_cx, icon_y, icon_r)

    # Labels under icons
    icon_font = _load_font(36)
    d.text(
        (tg_cx - d.textbbox((0, 0), "JOIN", font=icon_font)[2] // 2 + 10,
         icon_y + icon_r + 20),
        "JOIN", font=icon_font, fill=hex2rgb(CYAN),
    )
    d.text(
        (web_cx - d.textbbox((0, 0), "SITE", font=icon_font)[2] // 2 + 10,
         icon_y + icon_r + 20),
        "SITE", font=icon_font, fill=hex2rgb(ORANGE),
    )

    # Main CTA text
    cta_font = _load_font(60)
    text_centered(d, icon_y + icon_r + 80, "JOIN TELEGRAM", cta_font,
                  WHITE)
    sub_font = _load_font(44, bold=False)
    text_centered(d, icon_y + icon_r + 160, "@lhamzadeals", sub_font,
                  hex2rgb(CYAN))

    text_centered(d, icon_y + icon_r + 240, "VISIT SITE", cta_font, WHITE)
    text_centered(d, icon_y + icon_r + 320, "lhamza.vercel.app", sub_font,
                  hex2rgb(ORANGE))

    # Notification bell + "5 MIN AGO"
    bell_font = _load_font(28, bold=False)
    bell_y = card_y1 - 90
    d.text((card_x0 + 40, bell_y), "🔔  5 MIN AGO", font=bell_font,
           fill=hex2rgb(WHITE) + (140,))

    # 4-pointed star bottom-right
    star_cx = card_x1 - 55
    star_cy = card_y1 - 55
    star_r = 20
    star_pts = []
    for i in range(8):
        angle = math.pi / 4 * i - math.pi / 2
        r = star_r if i % 2 == 0 else star_r // 2
        star_pts.append((
            star_cx + int(r * math.cos(angle)),
            star_cy + int(r * math.sin(angle)),
        ))
    d.polygon(star_pts, fill=hex2rgb(CYAN))

    return np.array(img.convert("RGB"))


# ─── Audio ────────────────────────────────────────────────────────────────────

def _make_silent_audio(duration: float, fps: int = 44100) -> AudioArrayClip:
    """Return a silent audio clip as fallback."""
    samples = np.zeros((int(duration * fps), 2), dtype=np.float32)
    return AudioArrayClip(samples, fps=fps)


def load_audio(duration: float) -> object:
    if MUSIC_PATH.exists():
        try:
            audio = AudioFileClip(str(MUSIC_PATH))
            # Loop if music is shorter than video
            if audio.duration < duration:
                loops = math.ceil(duration / audio.duration)
                from moviepy.editor import concatenate_audioclips
                audio = concatenate_audioclips([audio] * loops)
            # Trim to video duration
            audio = audio.subclip(0, duration)
            # Fade in/out
            audio = audio.audio_fadein(1.0).audio_fadeout(1.5)
            return audio
        except Exception:
            pass
    return _make_silent_audio(duration)


# ─── Main entry ──────────────────────────────────────────────────────────────

def generate_video(deal: dict, day_number: int) -> Path:
    """
    Generate the full TikTok video and write it to OUTPUT_PATH.
    Returns the output path.
    """
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Pre-load product image once (reused across frames)
    deal["_product_img"] = download_image(deal.get("image_url")) or placeholder_product_image()

    def make_frame_scene1(t):
        return make_scene1_frame(deal, t, SCENE_DUR)

    def make_frame_scene2(t):
        return make_scene2_frame(deal, day_number, t, SCENE_DUR)

    def make_frame_scene3(t):
        return make_scene3_frame(t, SCENE_DUR)

    scene1 = ImageClip(make_frame_scene1(SCENE_DUR * 0.5), duration=SCENE_DUR)
    # For Ken Burns we need a VideoClip that varies with t
    from moviepy.editor import VideoClip
    scene1_video = VideoClip(make_frame_scene1, duration=SCENE_DUR)

    scene2_video = VideoClip(make_frame_scene2, duration=SCENE_DUR)
    scene3_video = VideoClip(make_frame_scene3, duration=SCENE_DUR)

    # Fade transitions
    scene1_video = scene1_video.crossfadeout(0.3)
    scene2_video = scene2_video.crossfadein(0.3).crossfadeout(0.3)
    scene3_video = scene3_video.crossfadein(0.3)

    final = concatenate_videoclips(
        [scene1_video, scene2_video, scene3_video],
        method="compose",
    )

    # Audio
    audio = load_audio(final.duration)
    final = final.set_audio(audio)

    # Write
    final.write_videofile(
        str(OUTPUT_PATH),
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        preset="fast",
        ffmpeg_params=["-pix_fmt", "yuv420p"],
        logger=None,
    )

    return OUTPUT_PATH
