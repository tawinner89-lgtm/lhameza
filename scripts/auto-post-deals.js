#!/usr/bin/env node
/**
 * L'HAMZA F SEL'A - Auto Post Deals to Telegram
 * Queries Supabase for new deals (last 12h, discount >= 30%)
 * Posts top 10 to Telegram, skipping already-posted deals.
 *
 * Usage: node scripts/auto-post-deals.js
 * Env:   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SUPABASE_URL, SUPABASE_ANON_KEY
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const https = require('https');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ─── Config ──────────────────────────────────────────────────────────────────

const POSTED_FILE = path.join(__dirname, '../data/posted-deals.json');
const MIN_DISCOUNT = 30;
const MAX_POSTS = 10;
// Keep only the last N IDs to prevent unbounded file growth
const MAX_TRACKED_IDS = 500;

// ─── Telegram ────────────────────────────────────────────────────────────────

function telegramPost(endpoint, payload) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.log('[auto-post] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping.');
        return Promise.resolve(null);
    }

    const body = JSON.stringify({ chat_id: chatId, ...payload });

    return new Promise((resolve) => {
        const req = https.request(
            `https://api.telegram.org/bot${token}/${endpoint}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (!json.ok) console.warn('[auto-post] Telegram error:', json.description);
                        resolve(json);
                    } catch {
                        resolve(null);
                    }
                });
            }
        );
        req.on('error', (err) => {
            console.error('[auto-post] Telegram request failed:', err.message);
            resolve(null);
        });
        req.write(body);
        req.end();
    });
}

function sendTelegram(text) {
    return telegramPost('sendMessage', {
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    });
}

function sendTelegramPhoto(imageUrl, caption) {
    return telegramPost('sendPhoto', {
        photo: imageUrl,
        caption,
        parse_mode: 'HTML',
    });
}

// ─── Posted-deals tracker ────────────────────────────────────────────────────

function loadPostedIds() {
    try {
        if (fs.existsSync(POSTED_FILE)) {
            return new Set(JSON.parse(fs.readFileSync(POSTED_FILE, 'utf8')));
        }
    } catch {
        // corrupt file — start fresh
    }
    return new Set();
}

function savePostedIds(ids) {
    // Trim to last MAX_TRACKED_IDS to keep file small
    const arr = Array.from(ids).slice(-MAX_TRACKED_IDS);
    const dir = path.dirname(POSTED_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(POSTED_FILE, JSON.stringify(arr, null, 2));
}

// ─── Format a deal for Telegram ──────────────────────────────────────────────

function formatDeal(deal) {
    const title = (deal.title || deal.name || '').slice(0, 100);
    const price = deal.price != null ? deal.price : '?';
    const origPrice = deal.original_price || deal.originalPrice;
    const discount = deal.discount;
    const url = deal.url || deal.link || '';
    const source = deal.source || '';

    let text = `🔥 ${title}\n\n`;
    text += `💰 ${price} MAD`;
    if (origPrice && origPrice > (deal.price || 0)) {
        text += `  <s>${origPrice} MAD</s>`;
    }
    text += '\n';
    if (discount) {
        text += `📉 -${discount}%\n`;
    }
    if (source) {
        text += `🏷️ ${source}\n`;
    }
    text += `\n👉 <a href="${url}">Voir le deal</a>\n\n`;
    text += `🛒 lhamza.vercel.app`;

    return text;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.log('[auto-post] SUPABASE_URL or SUPABASE_ANON_KEY not set — exiting.');
        process.exit(0);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    console.log(`[auto-post] Querying deals since ${since} with discount >= ${MIN_DISCOUNT}%`);

    const { data: deals, error } = await supabase
        .from('deals')
        .select('id, title, price, original_price, discount, url, source, category, image_url')
        .gte('created_at', since)
        .gte('discount', MIN_DISCOUNT)
        .order('discount', { ascending: false })
        .limit(50);

    if (error) {
        console.error('[auto-post] Supabase query failed:', error.message);
        process.exit(0); // Don't fail the whole pipeline
    }

    if (!deals || deals.length === 0) {
        console.log('[auto-post] No new deals found.');
        process.exit(0);
    }

    console.log(`[auto-post] Found ${deals.length} candidate deals`);

    const postedIds = loadPostedIds();
    const toPost = deals
        .filter(d => d.id && !postedIds.has(String(d.id)))
        .slice(0, MAX_POSTS);

    if (toPost.length === 0) {
        console.log('[auto-post] All deals already posted — nothing to send.');
        process.exit(0);
    }

    console.log(`[auto-post] Posting ${toPost.length} new deals to Telegram`);

    // Post a header, then each deal individually (avoids message truncation)
    const now = new Date().toLocaleString('fr-FR', {
        timeZone: 'Africa/Casablanca',
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    await sendTelegram(`🛒 <b>L'HAMZA — Nouvelles promos</b>\n📅 ${now}\n(${toPost.length} deals avec -${MIN_DISCOUNT}%+)`);

    for (const deal of toPost) {
        const text = formatDeal(deal);
        const imageUrl = deal.image_url;
        const result = imageUrl
            ? await sendTelegramPhoto(imageUrl, text)
            : await sendTelegram(text);
        if (result && result.ok) {
            postedIds.add(String(deal.id));
            console.log(`[auto-post] Posted: ${(deal.title || deal.name || '').slice(0, 60)}`);
        }
        // Small delay to respect Telegram rate limit (30 msg/s per bot)
        await new Promise(r => setTimeout(r, 400));
    }

    savePostedIds(postedIds);
    console.log(`[auto-post] Done. ${toPost.length} deals posted.`);
}

main().catch((err) => {
    console.error('[auto-post] Unexpected error:', err.message);
    process.exit(0); // Always exit cleanly — don't break the scrape pipeline
});
