/**
 * L'HAMZA F SEL'A - Decathlon Morocco Adapter
 * 
 * Scrapes sports equipment and clothing from Decathlon.ma
 * Category: Sports
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class DecathlonAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'Decathlon',
            baseUrl: 'https://www.decathlon.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'sports',
            emoji: '⚽',
            minDiscount: 10,
            maxItems: 50
        });

        this.saleUrls = [
            'https://www.decathlon.ma/5080-promotions',
            'https://www.decathlon.ma/3074-soldes',
            'https://www.decathlon.ma/15-chaussures-sport',
            'https://www.decathlon.ma/16-vetements-sport'
        ];
    }

    async scrape(url = null) {
        const targetUrl = url || this.saleUrls[0];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            logger.info(`${this.name}: Scraping`, { url: targetUrl });
            
            await page.goto(targetUrl, { 
                waitUntil: 'networkidle', 
                timeout: this.timeout 
            });
            
            await this.handleCookieConsent(page);
            await this.randomDelay(2000, 4000);
            await this.scrollPage(page, 6);

            const rawItems = await page.evaluate(() => {
                const products = [];

                // Decathlon.ma uses PrestaShop — try multiple card selectors
                const cardSelectors = [
                    'article.js-product-miniature',
                    'article.product-miniature',
                    '.js-product-miniature',
                    '[data-id-product]',
                    '.product-item',
                    'article.product'
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

                        // Name — prefer the product title anchor text
                        const name = getText([
                            '.product-title a',
                            '.product-title',
                            'h3.product-title',
                            '.product-name a',
                            'h2 a',
                            'h3 a'
                        ]);

                        // Current (sale) price — PrestaShop puts it in .price
                        const currentPrice = getText([
                            '.product-price-and-shipping .price:not(.regular-price)',
                            '.price-product .price',
                            'span.price',
                            '.current-price span',
                            '[itemprop="price"]'
                        ]);

                        // Original price (crossed-out)
                        const originalPrice = getText([
                            '.regular-price',
                            '.price-product .regular-price',
                            'del .price',
                            '.price-old',
                            's.price'
                        ]);

                        // Discount badge (e.g. "-30%")
                        const discount = getText([
                            '.discount-percentage',
                            '.discount-amount',
                            '.badge-promo',
                            '.promo-badge',
                            '[class*="discount"]'
                        ]);

                        // Image — prefer data-src (lazy loaded)
                        const image = getAttr(
                            ['img.product-thumbnail', '.product-image img', 'img'],
                            'data-src'
                        ) || getAttr(
                            ['img.product-thumbnail', '.product-image img', 'img'],
                            'src'
                        );

                        // Product link
                        const link = card.querySelector('a.product-thumbnail, h3 a, .product-title a, a')?.href || '';

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
                    brand: 'Decathlon',
                    category: 'sports'
                }))
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} items`);
            
            return {
                success: true,
                store: this.name,
                source: 'decathlon',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }

    // Scrape all sale pages
    async scrapeAll() {
        const allItems = [];
        
        for (const url of this.saleUrls) {
            const result = await this.scrape(url);
            if (result.success && result.items) {
                allItems.push(...result.items);
            }
            await this.randomDelay(3000, 5000);
        }

        return {
            success: true,
            store: this.name,
            itemCount: allItems.length,
            items: allItems
        };
    }
}

module.exports = DecathlonAdapter;
