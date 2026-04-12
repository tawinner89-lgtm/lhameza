/**
 * L'HAMZA F SEL'A - Electroplanet Morocco Adapter
 * 
 * Scrapes electronics and tech from Electroplanet.ma
 * Category: Tech
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class ElectroplanetAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'Electroplanet',
            baseUrl: 'https://www.electroplanet.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'tech',
            emoji: '💻',
            minDiscount: 10,
            maxItems: 50
        });

        // Primary promo pages — promotions page first (has standard product cards)
        // depliant is a PDF/catalogue viewer with no scrapable product cards, skip it
        this.saleUrls = [
            'https://www.electroplanet.ma/promotions',
            'https://www.electroplanet.ma/informatique/ordinateurs-portables',
            'https://www.electroplanet.ma/telephonie/smartphones',
            'https://www.electroplanet.ma/tv-image-son/televiseurs'
        ];
    }

    async scrape(url = null) {
        const targetUrl = url || this.saleUrls[0];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            logger.info(`${this.name}: Scraping`, { url: targetUrl });
            
            // Use networkidle so JS-rendered product cards are present
            try {
                await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: this.timeout });
            } catch (e) {
                // Fallback if networkidle times out
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: this.timeout });
                await this.randomDelay(4000, 6000);
            }

            await this.handleCookieConsent(page);
            await this.randomDelay(2000, 3000);

            // Wait for any product card to appear before extracting
            const productCardSelector = [
                'article.js-product-miniature',
                'article.product-miniature',
                '.product-miniature',
                '[data-product-id]',
                '.product-item',
                '.product-card',
                '.js-product',
            ].join(',');

            try {
                await page.waitForSelector(productCardSelector, { timeout: 15000 });
            } catch (e) {
                logger.warn(`${this.name}: No product cards found after wait on ${targetUrl}`);
            }

            await this.scrollPage(page, 8);
            await this.randomDelay(1000, 2000);

            const rawItems = await page.evaluate(() => {
                const products = [];

                // Electroplanet uses PrestaShop — multiple possible card structures
                const cardSelectors = [
                    // Standard PrestaShop product cards
                    'article.js-product-miniature',
                    'article.product-miniature',
                    '.js-product-miniature',
                    '.product-miniature',
                    // Custom Electroplanet theme
                    '.product-item',
                    '.product-card',
                    '[data-product-id]',
                    '.item-product',
                    // Generic fallback
                    '.js-product',
                    'li.ajax_block_product'
                ];

                let cards = [];
                for (const selector of cardSelectors) {
                    cards = document.querySelectorAll(selector);
                    if (cards.length > 0) break;
                }

                cards.forEach(card => {
                    try {
                        const getText = (sels) => {
                            const selectors = Array.isArray(sels) ? sels : [sels];
                            for (const sel of selectors) {
                                const el = card.querySelector(sel);
                                const text = el?.textContent?.trim();
                                if (text) return text;
                            }
                            return '';
                        };

                        const getAttr = (sels, attr) => {
                            const selectors = Array.isArray(sels) ? sels : [sels];
                            for (const sel of selectors) {
                                const el = card.querySelector(sel);
                                const val = el?.getAttribute(attr);
                                if (val) return val;
                            }
                            return '';
                        };

                        const name = getText([
                            '.product-title a',
                            '.product-title',
                            '.product-name a',
                            '.product-name',
                            'h3 a',
                            'h3',
                            'h2 a',
                            'h2',
                            '.name'
                        ]);

                        // Sale price — prefer explicit selectors, fall back to generic .price
                        const currentPrice = getText([
                            '.product-price-and-shipping .price:not(.regular-price)',
                            '.price__current',
                            '.product-price .price:not(.old-price)',
                            'span.price:not(.regular-price):not(.old-price)',
                            '.price-new',
                            '.current-price-value',
                            '.current-price span',
                            '[itemprop="price"]',
                            '.special-price .price',
                            '.price'
                        ]);

                        // Original crossed-out price
                        const originalPrice = getText([
                            '.regular-price',
                            '.price__old',
                            'del .price',
                            '.price-old',
                            '.old-price',
                            '.crossed-out .price',
                            'del',
                            's'
                        ]);

                        // Discount badge (e.g. "-20%", "Promo -30%", "SOLDES -25%")
                        const discount = getText([
                            '.discount-percentage',
                            '.discount-amount',
                            '.badge-discount',
                            '.badge-promo',
                            '.promo-percentage',
                            '.product-flag.discount',
                            '.product-flag.on-sale',
                            '[class*="discount"]',
                            '[class*="promo"]',
                            '.reduction',
                            '.flag-discount'
                        ]);

                        // Image with fallbacks for lazy-loading
                        const image = getAttr(
                            ['img.product-thumbnail', '.product-image img', 'img'],
                            'data-src'
                        ) || getAttr(
                            ['img.product-thumbnail', '.product-image img', 'img'],
                            'src'
                        ) || getAttr(
                            ['img'],
                            'data-lazy'
                        );

                        const link = card.querySelector(
                            'a.product-thumbnail, .product-title a, h3 a, a'
                        )?.href || '';

                        if (name && name.length > 3) {
                            products.push({
                                name,
                                currentPrice,
                                originalPrice,
                                discountBadge: discount,
                                image,
                                link
                            });
                        }
                    } catch (e) {}
                });

                return products;
            });

            await page.close();
            await this.closeBrowser();
            
            // Process and format items
            const items = rawItems
                .slice(0, this.maxItems)
                .map(item => this.formatDeal({
                    ...item,
                    brand: 'Electroplanet',
                    category: 'tech'
                }))
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} items`);
            
            return {
                success: true,
                store: this.name,
                source: 'electroplanet',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }

    // Scrape all categories
    async scrapeAll() {
        const allItems = [];
        
        for (const url of this.saleUrls) {
            const result = await this.scrape(url);
            if (result.success && result.items) {
                allItems.push(...result.items);
            }
            await this.randomDelay(3000, 5000);
        }

        // Remove duplicates by name
        const uniqueItems = [];
        const seen = new Set();
        for (const item of allItems) {
            if (!seen.has(item.name)) {
                seen.add(item.name);
                uniqueItems.push(item);
            }
        }

        return {
            success: true,
            store: this.name,
            itemCount: uniqueItems.length,
            items: uniqueItems
        };
    }
}

module.exports = ElectroplanetAdapter;
