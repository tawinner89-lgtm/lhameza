/**
 * L'HAMZA F SEL'A - Marjane Morocco Adapter
 * 
 * Scrapes supermarket deals from Marjane.ma
 * Category: Home/Supermarket
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class MarjaneAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'Marjane',
            baseUrl: 'https://www.marjane.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'home',
            emoji: '🛒',
            minDiscount: 10,
            maxItems: 50
        });

        this.saleUrls = [
            'https://www.marjane.ma/promotions',
            'https://www.marjane.ma/electromenager',
            'https://www.marjane.ma/high-tech',
            'https://www.marjane.ma/maison-deco',
            'https://www.marjane.ma/jardin-bricolage'
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
                
                // Marjane product card selectors
                const cardSelectors = [
                    '.product-item',
                    '.product-card',
                    '[data-product-id]',
                    '.product',
                    '.item-product',
                    '.product-miniature'
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
                            'a.product-name'
                        ]);
                        
                        const currentPrice = getText([
                            '.price',
                            '.product-price',
                            '.price-new',
                            '.current-price',
                            '[class*="price"]'
                        ]);
                        
                        const originalPrice = getText([
                            '.old-price',
                            '.price-old',
                            '.regular-price',
                            'del',
                            '.was-price'
                        ]);
                        
                        const discount = getText([
                            '.discount',
                            '.badge-promo',
                            '.reduction',
                            '[class*="discount"]',
                            '.percentage'
                        ]);
                        
                        const image = getAttr('img', 'src') || 
                                     getAttr('img', 'data-src');
                        
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
                    brand: 'Marjane',
                    category: 'home'
                }))
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} items`);
            
            return {
                success: true,
                store: this.name,
                source: 'marjane',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }
}

module.exports = MarjaneAdapter;
