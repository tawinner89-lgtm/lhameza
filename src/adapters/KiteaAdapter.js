/**
 * L'HAMZA F SEL'A - Kitea Morocco Adapter (2026)
 * 
 * Scrapes furniture deals from Kitea.ma
 * Morocco's leading furniture retailer
 * Categories: Living Room, Bedroom, Kitchen, Office
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class KiteaAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'Kitea',
            baseUrl: 'https://www.kitea.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'home',
            emoji: '🛋️',
            minDiscount: 15,
            maxItems: 50
        });

        this.saleUrls = [
            // Promotions
            'https://www.kitea.ma/promotions',
            'https://www.kitea.ma/bonnes-affaires',
            'https://www.kitea.ma/soldes',
            'https://www.kitea.ma/destockage',
            
            // Categories
            'https://www.kitea.ma/salon',
            'https://www.kitea.ma/chambre-a-coucher',
            'https://www.kitea.ma/salle-a-manger',
            'https://www.kitea.ma/bureau',
            'https://www.kitea.ma/cuisine',
            'https://www.kitea.ma/rangement',
            'https://www.kitea.ma/decoration',
            'https://www.kitea.ma/literie'
        ];
    }

    async scrape(url = null) {
        const targetUrl = url || this.saleUrls[0];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            logger.info(`${this.name}: Scraping furniture deals`, { url: targetUrl });
            
            await page.goto(targetUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: this.timeout 
            });
            
            await this.handleCookieConsent(page);
            await this.randomDelay(2000, 4000);
            await this.scrollPage(page, 6);

            const rawItems = await page.evaluate(() => {
                const products = [];
                
                // Kitea product selectors
                const cardSelectors = [
                    '.product-item',
                    '.product-miniature',
                    '.product-card',
                    '[data-product-id]',
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
                            'h3 a',
                            '.name',
                            '.title'
                        ]);
                        
                        const currentPrice = getText([
                            '.product-price',
                            '.price',
                            '.current-price',
                            '.prix-actuel'
                        ]);
                        
                        const originalPrice = getText([
                            '.regular-price',
                            '.old-price',
                            '.prix-barre',
                            'del'
                        ]);
                        
                        const discount = getText([
                            '.discount-percentage',
                            '.discount',
                            '.reduction',
                            '.badge-promo'
                        ]);
                        
                        const image = getAttr('img', 'src') || 
                                     getAttr('img', 'data-src');
                        
                        const link = card.querySelector('a')?.href;
                        
                        // Dimensions if available
                        const dimensions = getText([
                            '.dimensions',
                            '.product-dimensions',
                            '.taille'
                        ]);
                        
                        // Color options
                        const colors = getText([
                            '.color-options',
                            '.couleurs'
                        ]);
                        
                        if (name && name.length > 3) {
                            products.push({
                                name,
                                currentPrice,
                                originalPrice,
                                discountBadge: discount,
                                image,
                                link,
                                dimensions,
                                colors
                            });
                        }
                    } catch (e) {}
                });
                
                return products;
            });

            await page.close();
            await this.closeBrowser();
            
            const subcategory = this.detectSubcategory(targetUrl);
            
            const items = rawItems
                .slice(0, this.maxItems)
                .map(item => {
                    const deal = this.formatDeal({
                        ...item,
                        brand: 'Kitea',
                        category: 'home',
                        subcategory
                    });
                    
                    // Add furniture-specific tags
                    deal.tags = [...(deal.tags || []), 'meuble', 'made-in-morocco'];
                    
                    return deal;
                })
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} furniture items`);
            
            return {
                success: true,
                store: this.name,
                source: 'kitea',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }

    detectSubcategory(url) {
        if (url.includes('salon')) return 'living-room';
        if (url.includes('chambre')) return 'bedroom';
        if (url.includes('salle-a-manger')) return 'dining';
        if (url.includes('bureau')) return 'office';
        if (url.includes('cuisine')) return 'kitchen';
        if (url.includes('rangement')) return 'storage';
        if (url.includes('decoration')) return 'decor';
        if (url.includes('literie')) return 'bedding';
        return 'furniture';
    }

    async scrapePromotions() {
        const allItems = [];
        const promoUrls = this.saleUrls.slice(0, 4);
        
        for (const url of promoUrls) {
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

module.exports = KiteaAdapter;
