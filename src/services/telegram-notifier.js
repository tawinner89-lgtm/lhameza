/**
 * L'HAMZA F SEL'A — Telegram Notifier
 *
 * Fires automatically after each scrape run.
 * Posts only NEWLY ADDED deals with discount >= MIN_DISCOUNT to @lhamzadeals.
 *
 * No external dependencies — uses Node's built-in https module.
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const logger = require('../utils/logger');

const MIN_DISCOUNT    = 40;                            // Only post deals ≥ 40% off
const POSTED_FILE     = path.join(__dirname, '../../data/posted-deals.json');
const MAX_TRACKED_IDS = 1000;                          // Cap file size

// ─── Emoji map per source ─────────────────────────────────────────────────────

const SOURCE_EMOJI = {
    zara: '👗', nike: '👟', adidas: '👟', bershka: '👕', pullbear: '🧥',
    decathlon: '⚽', electroplanet: '💻', jumia: '📦', jumia_tech: '💻',
    jumia_fashion: '👗', jumia_home: '🏠', jumia_beauty: '💄',
    kitea: '🛋️', aliexpress: '🛒', marjane: '🛒', hmizate: '🔥',
    ultrapc: '🖥️', yvesrocher: '🌿', hmall: '💄', cosmetique: '💋',
};

// ─── Low-level Telegram HTTP call ────────────────────────────────────────────

function telegramRequest(endpoint, payload) {
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) return Promise.resolve(null);

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
                    try { resolve(JSON.parse(data)); } catch { resolve(null); }
                });
            }
        );
        req.on('error', () => resolve(null));
        req.write(body);
        req.end();
    });
}

// ─── Posted-IDs tracker (prevents double-posting) ────────────────────────────

function loadPostedIds() {
    try {
        if (fs.existsSync(POSTED_FILE)) {
            return new Set(JSON.parse(fs.readFileSync(POSTED_FILE, 'utf8')));
        }
    } catch { /* corrupt file — start fresh */ }
    return new Set();
}

function savePostedIds(ids) {
    const arr = Array.from(ids).slice(-MAX_TRACKED_IDS);
    fs.mkdirSync(path.dirname(POSTED_FILE), { recursive: true });
    fs.writeFileSync(POSTED_FILE, JSON.stringify(arr, null, 2));
}

// ─── Message formatter ────────────────────────────────────────────────────────

function formatCaption(deal) {
    const title    = (deal.title || deal.name || '').slice(0, 100);
    const price    = deal.price != null ? deal.price : '?';
    const origPrice = deal.originalPrice || deal.original_price;
    const discount = deal.discount;
    const url      = deal.url || deal.link || '';
    const source   = deal.source || '';
    const emoji    = SOURCE_EMOJI[source] || '🛍️';
    const brand    = (deal.brand || source).toUpperCase();

    // Discount intensity
    const fireEmoji = discount >= 60 ? '🔥🔥🔥' : discount >= 50 ? '🔥🔥' : '🔥';

    let text = `${fireEmoji} <b>${title}</b>\n\n`;

    // Price line
    text += `💰 <b>${price} MAD</b>`;
    if (origPrice && Number(origPrice) > Number(price)) {
        text += `  <s>${origPrice} MAD</s>`;
    }
    text += `\n`;

    // Discount badge
    text += `📉 <b>-${discount}% de réduction</b>\n`;

    // Source
    text += `${emoji} ${brand}\n`;

    // Savings amount
    if (origPrice && Number(origPrice) > Number(price)) {
        const saved = Math.round(Number(origPrice) - Number(price));
        text += `💸 Vous économisez <b>${saved} MAD</b>\n`;
    }

    text += `\n👉 <a href="${url}">Voir le deal →</a>\n`;
    text += `\n🛒 <a href="https://lhamza.vercel.app">lhamza.vercel.app</a>`;

    return text;
}

// ─── Send a single deal (photo + caption, fallback to text) ──────────────────

async function sendDeal(deal) {
    const caption = formatCaption(deal);
    const image   = deal.image;

    if (image && typeof image === 'string' && image.startsWith('http')) {
        // Try with photo first
        const res = await telegramRequest('sendPhoto', {
            photo: image,
            caption: caption.slice(0, 1024),   // Telegram caption limit
            parse_mode: 'HTML',
        });
        if (res && res.ok) return res;
    }

    // Fallback: text-only message
    return telegramRequest('sendMessage', {
        text: caption,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called from scraper.service.js after each runAdapterSync.
 * @param {Array} newDeals - deals that were ADDED (not updated) this run,
 *                           each with their Supabase id attached.
 * @returns {{ sent: number, skipped: number }}
 */
async function notifyNewDeals(newDeals = []) {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
        return { sent: 0, skipped: 0 };
    }

    // Keep only deals with a real discount
    const eligible = newDeals.filter(
        d => d.discount != null && d.discount >= MIN_DISCOUNT
    );

    if (eligible.length === 0) return { sent: 0, skipped: newDeals.length };

    const postedIds = loadPostedIds();
    const toPost    = eligible.filter(d => d.id && !postedIds.has(String(d.id)));

    if (toPost.length === 0) {
        return { sent: 0, skipped: eligible.length };
    }

    logger.info(`📱 Telegram: posting ${toPost.length} new deal(s) with ≥${MIN_DISCOUNT}% off`);

    let sent = 0;
    for (const deal of toPost) {
        try {
            const res = await sendDeal(deal);
            if (res && res.ok) {
                postedIds.add(String(deal.id));
                sent++;
                logger.info(`📱 Telegram: ✅ "${(deal.title || deal.name || '').slice(0, 50)}" -${deal.discount}%`);
            } else {
                logger.warn(`📱 Telegram: ⚠️ Failed for "${(deal.title || '').slice(0, 40)}"`);
            }
        } catch (err) {
            logger.warn(`📱 Telegram: error — ${err.message}`);
        }

        // Respect Telegram rate limit (max ~30 msg/s, stay well below)
        await new Promise(r => setTimeout(r, 500));
    }

    savePostedIds(postedIds);

    logger.info(`📱 Telegram: done — ${sent}/${toPost.length} sent`);
    return { sent, skipped: eligible.length - toPost.length };
}

module.exports = { notifyNewDeals, MIN_DISCOUNT };
