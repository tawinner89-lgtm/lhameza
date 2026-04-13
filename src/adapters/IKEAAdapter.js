/**
 * L'HAMZA F SEL'A - IKEA Morocco Adapter
 *
 * Scrapes home & furniture deals from IKEA Morocco
 * Category: Home / Furniture
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class IKEAAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'IKEA',
            baseUrl: 'https://www.ikea.com/ma/fr',
            currency: 'MAD',
            country: 'MA',
            category: 'home',
            emoji: '🛋️',
            minDiscount: 10,
            maxItems: 60,
            timeout: 90000,
        });

        // IKEA Morocco pages most likely to contain discounted items
        this.saleUrls = [
            'https://www.ikea.com/ma/fr/cat/offres-13732/',
            'https://www.ikea.com/ma/fr/offers/',
            'https://www.ikea.com/ma/fr/cat/chambre-a-coucher-10264/',
            'https://www.ikea.com/ma/fr/cat/salon-10382/',
            'https://www.ikea.com/ma/fr/cat/cuisine-12161/',
        ];
    }

    async initBrowser() {
        if (this.browser) return;

        const { chromium } = require('playwright');

        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });

        this.context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 900 },
            locale: 'fr-MA',
            timezoneId: 'Africa/Casablanca',
        });

        logger.info(`${this.name}: Browser initialized`);
    }

    /**
     * Parse a MAD price string into a float.
     * Handles French number format: "1 199,00 DH" → 1199, "699,00 MAD" → 699
     */
    _parseMAD(text) {
        if (!text) return null;
        let s = String(text).trim();
        // Normalise non-breaking spaces
        s = s.replace(/[\u00a0\u202f\u2009]/g, ' ');
        // Strip currency label
        s = s.replace(/\s*(MAD|DH|dh|د\.م)\s*/gi, '').trim();
        if (!s) return null;

        if (s.match(/,\d{1,2}(\s|$)/)) {
            // Comma = decimal (French): "1 199,00"
            s = s.replace(/[\s.]/g, '').replace(',', '.');
        } else if (s.match(/\.\d{3}/) && s.includes(',')) {
            // Period = thousands, comma = decimal: "1.199,00"
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/[\s,]/g, '');
        }

        const n = parseFloat(s);
        // Sanity: MAD furniture prices are 50–100 000
        return !isNaN(n) && n >= 50 && n <= 100000 ? n : null;
    }

    /**
     * Extract all product cards from the current page.
     */
    async _extractProducts(page) {
        await this.randomDelay(2000, 4000);

        return page.evaluate(() => {
            const results = [];

            // IKEA product card selectors (covers both old and new PLP layouts)
            const cardSelectors = [
                '[data-testid="pip-plp-product-card"]',
                '.plp-fragment-wrapper article',
                '.product-compact',
                '[class*="plp-product-card"]',
                '.pip-plp-product-card',
            ];

            let cards = [];
            for (const sel of cardSelectors) {
                const found = document.querySelectorAll(sel);
                if (found.length > 0) { cards = Array.from(found); break; }
            }

            // Fallback: every <article> on the page
            if (cards.length === 0) {
                cards = Array.from(document.querySelectorAll('article'));
            }

            for (const card of cards) {
                // ── Name ─────────────────────────────────────────────────────
                const nameEl = card.querySelector([
                    '[data-testid="pip-plp-product-card__title"]',
                    '[class*="product-name"]',
                    '[class*="product-title"]',
                    '[class*="plp-product-card__title"]',
                    'h2', 'h3',
                ].join(','));
                const name = nameEl ? nameEl.textContent?.trim() : null;
                if (!name || name.length < 3) continue;

                // ── Link ──────────────────────────────────────────────────────
                const linkEl = card.querySelector('a[href]');
                const link = linkEl ? linkEl.href : null;
                if (!link || !link.includes('ikea.com')) continue;

                // ── Image ─────────────────────────────────────────────────────
                const imgEl = card.querySelector('img[src], img[data-src]');
                const image = imgEl
                    ? (imgEl.getAttribute('data-src') || imgEl.src || '')
                    : '';

                // ── Current price ─────────────────────────────────────────────
                const curPriceEl = card.querySelector([
                    '[data-testid="plp-price-module__current-price"]',
                    '[class*="price-module__current-price"]',
                    '[class*="price__integer"]',
                    '.pip-price__main',
                    '[class*="regular-price"]',
                    '[class*="current-price"]',
                    '[class*="sale-price"]',
                ].join(','));
                const currentPriceText = curPriceEl ? curPriceEl.textContent?.trim() : null;

                // ── Original price ────────────────────────────────────────────
                const oldPriceEl = card.querySelector([
                    '[data-testid="plp-price-module__previous-price"]',
                    '[class*="price-module__previous-price"]',
                    '[class*="previous-price"]',
                    '[class*="old-price"]',
                    '[class*="was-price"]',
                    'del',
                    's[class*="price"]',
                    '[class*="original-price"]',
                    '[class*="crossed"]',
                    'del .pip-price__main',
                ].join(','));
                const originalPriceText = oldPriceEl ? oldPriceEl.textContent?.trim() : null;

                // ── Discount badge ────────────────────────────────────────────
                const badgeEl = card.querySelector([
                    '[class*="offer-badge"]',
                    '[class*="discount-badge"]',
                    '[class*="promo-badge"]',
                    '[class*="savings-badge"]',
                    '[class*="price-module__offer"]',
                    '[data-testid*="discount"]',
                ].join(','));
                const discountText = badgeEl ? badgeEl.textContent?.trim() : null;

                results.push({
                    name,
                    link,
                    image,
                    currentPriceText,
                    originalPriceText,
                    discountText,
                });
            }

            return results;
        });
    }

    async scrape() {
        const allItems = [];

        try {
            await this.initBrowser();
            const page = await this.context.newPage();

            let cookieHandled = false;

            for (const url of this.saleUrls) {
                if (allItems.length >= this.maxItems) break;

                logger.info(`${this.name}: Scraping ${url}`);

                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeout });
                } catch (e) {
                    logger.warn(`${this.name}: Timeout on ${url}`);
                    continue;
                }

                // Handle cookie banner once
                if (!cookieHandled) {
                    try {
                        const cookieBtn = await page.$([
                            '#onetrust-accept-btn-handler',
                            'button[id*="accept"]',
                            'button:has-text("Accepter")',
                            'button:has-text("Accept")',
                            '[data-testid="accept-cookies"]',
                        ].join(','));
                        if (cookieBtn) {
                            await cookieBtn.click();
                            await this.randomDelay(1000, 2000);
                        }
                        cookieHandled = true;
                    } catch (e) { cookieHandled = true; }
                }

                // Scroll to trigger lazy-loading
                await this.scrollPage(page, 8);
                await this.randomDelay(1500, 3000);

                const raw = await this._extractProducts(page);
                logger.info(`${this.name}: Found ${raw.length} raw cards on ${url}`);

                for (const r of raw) {
                    const currentPrice = this._parseMAD(r.currentPriceText);
                    if (!currentPrice) continue;

                    const originalPrice = this._parseMAD(r.originalPriceText);

                    // Extract discount from badge text
                    let discount = null;
                    if (r.discountText) {
                        const m = r.discountText.match(/-?(\d+)\s*%/);
                        if (m) discount = parseInt(m[1]);
                    }

                    const deal = this.formatDeal({
                        name: r.name,
                        currentPrice: String(currentPrice),
                        originalPrice: originalPrice ? String(originalPrice) : '',
                        discount,
                        image: r.image,
                        link: r.link,
                        brand: 'IKEA',
                        category: 'home',
                        source: 'ikea',
                    });

                    if (deal) allItems.push(deal);
                }

                await this.randomDelay(2000, 4000);
            }

            await page.close();
            await this.closeBrowser();

            // Deduplicate by link
            const seen = new Set();
            const unique = allItems.filter(d => {
                if (!d.url || seen.has(d.url)) return false;
                seen.add(d.url);
                return true;
            });

            logger.info(`${this.name}: Total ${unique.length} unique deals`);

            return {
                success: unique.length > 0,
                store: this.name,
                source: 'ikea',
                itemCount: unique.length,
                items: unique,
            };

        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }
}

module.exports = IKEAAdapter;
