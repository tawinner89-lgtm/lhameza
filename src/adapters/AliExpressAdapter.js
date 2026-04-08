/**
 * L'HAMZA F SEL'A - AliExpress Adapter 🛒
 * Scrapes trending/discounted products from AliExpress for Morocco
 * Converts USD → MAD automatically
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../utils/logger');

// Approximate USD → MAD exchange rate
// Update periodically if you want more accuracy
const USD_TO_MAD = 10.0;

class AliExpressAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'AliExpress',
            baseUrl: 'https://www.aliexpress.com',
            currency: 'MAD',
            country: 'MA',
            category: 'tech',
            emoji: '🛒',
            minDiscount: 10,
            maxItems: 40,
            timeout: 90000,
            minDelay: 2000,
            maxDelay: 5000
        });

        // Category pages to scrape for Morocco-relevant deals
        this.searchUrls = [
            { url: 'https://www.aliexpress.com/category/708/smartphones.html?SortType=default_desc&isFreeShip=y', category: 'tech' },
            { url: 'https://www.aliexpress.com/wholesale?catId=708&SearchText=earphones+wireless&SortType=default_desc&isFreeShip=y', category: 'tech' },
            { url: 'https://www.aliexpress.com/wholesale?catId=708&SearchText=smartwatch&SortType=default_desc&isFreeShip=y', category: 'tech' },
            { url: 'https://www.aliexpress.com/wholesale?catId=708&SearchText=power+bank&SortType=default_desc&isFreeShip=y', category: 'tech' },
            { url: 'https://www.aliexpress.com/wholesale?catId=708&SearchText=phone+case&SortType=default_desc&isFreeShip=y', category: 'tech' },
            { url: 'https://www.aliexpress.com/wholesale?catId=200000783&SearchText=bag+fashion&SortType=default_desc&isFreeShip=y', category: 'fashion' },
            { url: 'https://www.aliexpress.com/wholesale?catId=200000783&SearchText=watch+fashion&SortType=default_desc&isFreeShip=y', category: 'fashion' },
        ];
    }

    /**
     * Scrape a single AliExpress page for discounted products
     */
    async _scrapePage(targetUrl, category) {
        let page;
        try {
            await this.initBrowser();
            page = await this.context.newPage();

            logger.info(`${this.name}: Scraping ${targetUrl}`);

            await page.goto(targetUrl, {
                waitUntil: 'domcontentloaded',
                timeout: this.timeout
            });

            await this.handleCookieConsent(page);
            await this.randomDelay(3000, 5000);

            // Scroll to trigger lazy loading
            await this.scrollPage(page, 8);
            await page.evaluate(() => window.scrollTo(0, 0));
            await this.randomDelay(1500, 2500);

            const rawItems = await page.evaluate((usdToMad) => {
                const products = [];

                // AliExpress uses dynamic/hashed CSS class names — target stable attributes
                // and fall back through multiple selectors
                const cardSelectors = [
                    'a[href*="/item/"]',                          // product links directly
                    '[class*="SearchCard"]',
                    '[class*="card--contentWrapper"]',
                    '.search-item-card-wrapper-gallery',
                    '.list--gallery--C2f2tvm > div',
                    '[class*="product-card"]'
                ];

                let cards = [];
                for (const sel of cardSelectors) {
                    const found = document.querySelectorAll(sel);
                    if (found.length > 3) {
                        cards = Array.from(found);
                        break;
                    }
                }

                cards.forEach(card => {
                    try {
                        const getText = (selectors) => {
                            for (const sel of selectors) {
                                const el = card.querySelector(sel);
                                if (el?.textContent?.trim()) return el.textContent.trim();
                            }
                            return '';
                        };

                        const name = getText([
                            '[class*="titleText"]',
                            '[class*="title--wrap"]',
                            '[class*="productTitle"]',
                            '[class*="item-title"]',
                            'h1', 'h2', 'h3',
                            '[class*="Title"]'
                        ]);

                        const priceText = getText([
                            '[class*="price--current"]',
                            '[class*="sale--price"]',
                            '[class*="price-sale"]',
                            '[class*="salePrice"]',
                            '[class*="Price"] span',
                        ]);

                        const origPriceText = getText([
                            '[class*="price--original"]',
                            '[class*="price-origin"]',
                            '[class*="originalPrice"]',
                            '[class*="oldPrice"]',
                            'del', 's'
                        ]);

                        const discountText = getText([
                            '[class*="discount"]',
                            '[class*="Discount"]',
                            '[class*="off"]',
                            '[class*="percentage"]',
                            '[class*="coupon"]'
                        ]);

                        // Image: prefer data-src (lazy load)
                        const imgEl = card.querySelector('img');
                        let image = '';
                        if (imgEl) {
                            image = imgEl.getAttribute('data-src') || imgEl.getAttribute('src') || '';
                            if (image.startsWith('//')) image = 'https:' + image;
                            // Skip non-product images (gifs, icons, placeholders)
                            if (!image.includes('alicdn.com') || image.endsWith('.gif')) image = '';
                        }

                        // Product link — must be a direct /item/ URL
                        let link = null;
                        const linkEl = card.tagName === 'A' && card.href.includes('/item/')
                            ? card
                            : card.querySelector('a[href*="/item/"]');
                        if (linkEl) {
                            link = linkEl.href;
                            // Strip tracking params that inflate URL length, keep it clean
                            try {
                                const u = new URL(link);
                                // Keep only the essential path; strip platform/session params
                                link = `${u.origin}${u.pathname}`;
                            } catch (_) { /* keep as-is */ }
                        }

                        // Skip if not a product page URL
                        if (!link || !link.match(/\/item\/\d+\.html/)) return;

                        // Parse USD price and convert to MAD
                        const parseUSD = (str) => {
                            if (!str) return null;
                            // Handle ranges like "$2.99 - $4.99" — take the lower price
                            const match = str.replace(/,/g, '').match(/[\d.]+/);
                            return match ? parseFloat(match[0]) : null;
                        };

                        const priceUSD = parseUSD(priceText);
                        const origUSD = parseUSD(origPriceText);

                        if (!priceUSD) return;

                        const priceMAD = Math.round(priceUSD * usdToMad);
                        const origMAD = origUSD ? Math.round(origUSD * usdToMad) : null;

                        if (name && name.length > 3) {
                            products.push({
                                name: name.slice(0, 150), // trim overly long titles
                                currentPrice: String(priceMAD),
                                originalPrice: origMAD ? String(origMAD) : '',
                                discountBadge: discountText,
                                image,
                                link,
                            });
                        }
                    } catch (_) { /* skip malformed cards */ }
                });

                return products;
            }, USD_TO_MAD);

            if (page) await page.close();
            await this.closeBrowser();

            const items = rawItems
                .slice(0, this.maxItems)
                .map(item => this.formatDeal({
                    ...item,
                    brand: 'AliExpress',
                    category,
                    source: 'aliexpress'
                }))
                .filter(item => item && item.name && item.price);

            logger.info(`${this.name} [${category}]: Found ${items.length} valid items`);
            return items;

        } catch (error) {
            logger.error(`${this.name}: Page scrape failed`, { url: targetUrl, error: error.message });
            if (page) { try { await page.close(); } catch (_) {} }
            await this.closeBrowser();
            return [];
        }
    }

    /**
     * scrape() — called by BaseAdapter.scrapeWithRetry()
     * Iterates all category URLs and returns aggregated results.
     */
    async scrape(url = null) {
        if (url) {
            // Single URL mode (for direct invocation / retry)
            const items = await this._scrapePage(url, this.category);
            return { success: true, store: this.name, source: 'aliexpress', itemCount: items.length, items };
        }

        // Multi-URL mode: scrape all categories
        const allItems = [];
        for (let i = 0; i < this.searchUrls.length; i++) {
            const { url: targetUrl, category } = this.searchUrls[i];
            const items = await this._scrapePage(targetUrl, category);
            allItems.push(...items);

            // Polite delay between requests (skip after last)
            if (i < this.searchUrls.length - 1) {
                await this.randomDelay(3000, 6000);
            }
        }

        return {
            success: true,
            store: this.name,
            source: 'aliexpress',
            itemCount: allItems.length,
            items: allItems
        };
    }
}

module.exports = AliExpressAdapter;
