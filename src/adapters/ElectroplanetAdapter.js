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

        this.saleUrls = [
            'https://www.electroplanet.ma/promotions',
            'https://www.electroplanet.ma/informatique/ordinateurs-portables',
            'https://www.electroplanet.ma/telephonie/smartphones',
            'https://www.electroplanet.ma/tv-image-son/televiseurs',
            'https://www.electroplanet.ma/gros-electromenager/refrigerateurs',
            'https://www.electroplanet.ma/petit-electromenager'
        ];
    }

    async scrape(url = null) {
        const targetUrl = url || this.saleUrls[0];
        
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
            await this.scrollPage(page, 8);

            const rawItems = await page.evaluate(() => {
                const products = [];
                
                // Electroplanet product card selectors
                const cardSelectors = [
                    '.product-item',
                    '.product-miniature',
                    '[data-product-id]',
                    '.product-card',
                    '.item-product'
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
                            'h3',
                            'h2',
                            '.name',
                            'a.product-title'
                        ]);
                        
                        const currentPrice = getText([
                            '.price',
                            '.product-price',
                            '.current-price',
                            '.price-new',
                            '[class*="price"]'
                        ]);
                        
                        const originalPrice = getText([
                            '.regular-price',
                            '.old-price',
                            '.price-old',
                            'del',
                            '.price-was'
                        ]);
                        
                        const discount = getText([
                            '.discount-percentage',
                            '.discount-badge',
                            '.badge-promo',
                            '.reduction',
                            '[class*="discount"]'
                        ]);
                        
                        const image = getAttr('img', 'src') || 
                                     getAttr('img', 'data-src') ||
                                     getAttr('img', 'data-lazy');
                        
                        const link = card.querySelector('a')?.href;
                        
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
