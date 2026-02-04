/**
 * L'HAMZA F SEL'A - Cosmetique.ma Adapter
 * 
 * Scrapes makeup/skincare deals from Cosmetique.ma
 * Specialized Moroccan beauty e-commerce
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../utils/logger');

class CosmetiqueAdapter extends BaseAdapter {
    constructor(category = 'beauty') {
        super({
            name: 'Cosmetique',
            baseUrl: 'https://www.cosmetique.ma',
            currency: 'MAD',
            country: 'MA',
            category: category,
            emoji: '💋',
            minDiscount: 5,
            maxItems: 50
        });

        // Category-specific URLs
        this.categoryUrls = {
            makeup: [
                'https://www.cosmetique.ma/maquillage',
                'https://www.cosmetique.ma/maquillage/yeux',
                'https://www.cosmetique.ma/maquillage/levres',
                'https://www.cosmetique.ma/maquillage/teint',
                'https://www.cosmetique.ma/maquillage/ongles'
            ],
            skincare: [
                'https://www.cosmetique.ma/soin-visage',
                'https://www.cosmetique.ma/soin-corps'
            ],
            brands: [
                'https://www.cosmetique.ma/marques/maybelline',
                'https://www.cosmetique.ma/marques/loreal',
                'https://www.cosmetique.ma/marques/nyx',
                'https://www.cosmetique.ma/marques/essence'
            ],
            promo: [
                'https://www.cosmetique.ma/promotions'
            ],
            all: [
                'https://www.cosmetique.ma/nouveautes'
            ]
        };
    }

    async scrape(url = null) {
        const targetUrl = url || this.categoryUrls.promo[0] || this.categoryUrls.all[0];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            logger.info(`${this.name}: Scraping`, { url: targetUrl });
            
            await page.goto(targetUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: this.timeout 
            });
            
            await this.handleCookieConsent(page);
            await this.randomDelay(2000, 4000);
            await this.scrollPage(page, 10);

            const rawItems = await page.evaluate(() => {
                const products = [];
                
                // Cosmetique.ma product card selectors
                const cardSelectors = [
                    '.product-card',
                    '.product-miniature',
                    '.product-item',
                    '[data-id-product]',
                    '.js-product-miniature'
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
                                if (el?.textContent?.trim()) return el.textContent.trim();
                            }
                            return '';
                        };
                        
                        const getAttr = (sel, attr) => {
                            const el = card.querySelector(sel);
                            return el?.getAttribute(attr) || '';
                        };
                        
                        const name = getText([
                            '.product-title',
                            '.product-name',
                            'h3.product-title a',
                            '.product-title a',
                            'a.product-name'
                        ]);
                        
                        const currentPrice = getText([
                            '.product-price',
                            '.price',
                            '.current-price',
                            '[itemprop="price"]'
                        ]);
                        
                        const originalPrice = getText([
                            '.regular-price',
                            '.old-price',
                            '.price-regular',
                            '.was-price'
                        ]);
                        
                        const discount = getText([
                            '.discount-percentage',
                            '.discount',
                            '.sale-percentage',
                            '.promo-label'
                        ]);
                        
                        // Image extraction with lazy loading support
                        const imgEl = card.querySelector('img');
                        let image = '';
                        if (imgEl) {
                            image = imgEl.getAttribute('data-src') || 
                                   imgEl.getAttribute('data-lazy-src') ||
                                   imgEl.getAttribute('src') || '';
                            
                            // Skip placeholder images
                            if (image.includes('placeholder') || image.includes('loader')) {
                                image = imgEl.getAttribute('data-src') || '';
                            }
                        }
                        
                        const link = getAttr('a.product-title', 'href') || 
                                    getAttr('a.product-thumbnail', 'href') ||
                                    getAttr('a', 'href') || '';
                        
                        const brand = getText([
                            '.product-brand',
                            '.brand',
                            '.manufacturer-name'
                        ]);
                        
                        if (name && name.length > 3) {
                            products.push({
                                name,
                                currentPrice,
                                originalPrice,
                                discountBadge: discount,
                                image,
                                link,
                                brand
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
                    brand: item.brand || 'Cosmetique.ma',
                    category: 'beauty'
                }))
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} beauty items`);
            
            return {
                success: true,
                store: this.name,
                source: 'cosmetique',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }

    // Scrape makeup categories
    async scrapeMakeup() {
        const allItems = [];
        
        for (const url of this.categoryUrls.makeup) {
            const result = await this.scrape(url);
            if (result.success && result.items) {
                allItems.push(...result.items);
            }
            await this.randomDelay(3000, 5000);
        }

        return {
            success: true,
            store: this.name,
            category: 'makeup',
            itemCount: allItems.length,
            items: allItems
        };
    }

    // Scrape all categories
    async scrapeAll() {
        const allItems = [];
        const urls = [
            ...this.categoryUrls.promo,
            ...this.categoryUrls.makeup,
            ...this.categoryUrls.skincare
        ];
        
        for (const url of urls) {
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

module.exports = CosmetiqueAdapter;
