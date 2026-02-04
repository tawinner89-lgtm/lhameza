/**
 * L'HAMZA F SEL'A - LC Waikiki Morocco Adapter
 * 
 * Scrapes budget fashion from LCWaikiki.ma
 * Category: Fashion
 * 
 * STATUS: TEMPORARILY DISABLED
 * Reason: LC Waikiki's discount pages are currently empty.
 * The site uses dynamic React pages that require specific timing.
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class LCWaikikiAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'LC Waikiki',
            baseUrl: 'https://www.lcwaikiki.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'fashion',
            emoji: '👕',
            minDiscount: 15,
            maxItems: 50,
            timeout: 60000,
            // DISABLED: Set to true when promotions are available
            disabled: true
        });

        this.saleUrls = [
            'https://www.lcwaikiki.ma/fr/mvc/women-black-friday',
            'https://www.lcwaikiki.ma/fr/mvc/men-black-friday'
        ];
    }

    async scrape(url = null) {
        // Return empty result when disabled
        if (this.disabled) {
            logger.info(`${this.name}: Adapter is currently disabled (no active promotions)`);
            return {
                success: true,
                store: this.name,
                source: 'lcwaikiki',
                itemCount: 0,
                items: [],
                message: 'Adapter disabled - no active promotions on the site'
            };
        }

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
            await this.randomDelay(3000, 5000);
            await this.scrollPage(page, 10);
            await this.randomDelay(2000, 3000);

            const rawItems = await page.evaluate(() => {
                const products = [];
                
                // LC Waikiki uses React - these selectors may need updating
                const cardSelectors = [
                    '.product-card',
                    '.product-card-tile',
                    '[data-testid="product-card"]',
                    '.plp-product'
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
                        
                        const name = getText(['.product-card__title', '.product-title', 'h3', '.name']);
                        const currentPrice = getText(['.price-sales', '.sale-price', '.current-price']);
                        const originalPrice = getText(['.price-standard', '.original-price', 'del']);
                        const discount = getText(['.discount-badge', '.badge-sale']);
                        const image = getAttr('img', 'src') || getAttr('img', 'data-src');
                        const link = card.querySelector('a')?.href;
                        
                        if (name && name.length > 2) {
                            products.push({ name, currentPrice, originalPrice, discountBadge: discount, image, link });
                        }
                    } catch (e) {}
                });
                
                return products;
            });

            await page.close();
            await this.closeBrowser();
            
            const items = rawItems
                .slice(0, this.maxItems)
                .map(item => this.formatDeal({ ...item, brand: 'LC Waikiki', category: 'fashion' }))
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} items`);
            
            return {
                success: true,
                store: this.name,
                source: 'lcwaikiki',
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

module.exports = LCWaikikiAdapter;
