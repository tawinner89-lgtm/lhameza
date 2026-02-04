/**
 * L'HAMZA F SEL'A - Yves Rocher Morocco Adapter (2026)
 * 
 * Scrapes beauty deals from Yves-Rocher.ma
 * Known for: 50% discounts on perfumes and skincare
 * Categories: Perfumes, Skincare, Makeup, Haircare
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class YvesRocherAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'YvesRocher',
            baseUrl: 'https://www.yves-rocher.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'beauty',
            emoji: '🌿',
            minDiscount: 20,
            maxItems: 50
        });

        this.saleUrls = [
            // Promotions
            'https://www.yves-rocher.ma/promotions',
            'https://www.yves-rocher.ma/offres-speciales',
            'https://www.yves-rocher.ma/soldes',
            
            // Perfumes
            'https://www.yves-rocher.ma/parfums',
            'https://www.yves-rocher.ma/parfums-femme',
            'https://www.yves-rocher.ma/parfums-homme',
            
            // Skincare
            'https://www.yves-rocher.ma/soin-visage',
            'https://www.yves-rocher.ma/anti-age',
            'https://www.yves-rocher.ma/hydratation',
            
            // Body care
            'https://www.yves-rocher.ma/soin-corps',
            
            // Makeup
            'https://www.yves-rocher.ma/maquillage',
            
            // Haircare
            'https://www.yves-rocher.ma/soin-cheveux'
        ];
    }

    async scrape(url = null) {
        const targetUrl = url || this.saleUrls[0];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            logger.info(`${this.name}: Scraping beauty deals`, { url: targetUrl });
            
            await page.goto(targetUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: this.timeout 
            });
            
            await this.handleCookieConsent(page);
            await this.randomDelay(2000, 4000);
            await this.scrollPage(page, 5);

            const rawItems = await page.evaluate(() => {
                const products = [];
                
                // Yves Rocher product selectors
                const cardSelectors = [
                    '.product-tile',
                    '.product-item',
                    '.product-card',
                    '[data-product-id]',
                    '.product'
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
                            '.product-name',
                            '.product-title',
                            'h3',
                            '.name',
                            '.title'
                        ]);
                        
                        const currentPrice = getText([
                            '.sales-price',
                            '.price-sales',
                            '.current-price',
                            '.price',
                            '.prix-promo'
                        ]);
                        
                        const originalPrice = getText([
                            '.strike-through',
                            '.price-standard',
                            '.old-price',
                            'del',
                            '.prix-barre'
                        ]);
                        
                        const discount = getText([
                            '.discount-badge',
                            '.promo-badge',
                            '.reduction',
                            '.discount'
                        ]);
                        
                        const image = getAttr('img', 'src') || 
                                     getAttr('img', 'data-src') ||
                                     getAttr('.product-image img', 'src');
                        
                        const link = card.querySelector('a')?.href;
                        
                        // Product size/volume
                        const size = getText([
                            '.product-size',
                            '.volume',
                            '.contenance'
                        ]);
                        
                        // Rating
                        const rating = getText([
                            '.rating-value',
                            '.stars',
                            '.note'
                        ]);
                        
                        if (name && name.length > 3) {
                            products.push({
                                name,
                                currentPrice,
                                originalPrice,
                                discountBadge: discount,
                                image,
                                link,
                                size,
                                rating
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
                        brand: 'Yves Rocher',
                        category: 'beauty',
                        subcategory
                    });
                    
                    // Add beauty-specific tags
                    deal.tags = [...(deal.tags || []), ...this.extractBeautyTags(item.name)];
                    
                    return deal;
                })
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} beauty items`);
            
            return {
                success: true,
                store: this.name,
                source: 'yvesrocher',
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
        if (url.includes('parfum')) return 'perfumes';
        if (url.includes('visage') || url.includes('anti-age')) return 'skincare';
        if (url.includes('corps')) return 'bodycare';
        if (url.includes('maquillage')) return 'makeup';
        if (url.includes('cheveux')) return 'haircare';
        return 'beauty';
    }

    extractBeautyTags(name) {
        const tags = [];
        const lower = name.toLowerCase();
        
        if (lower.includes('anti-rides') || lower.includes('anti-age')) tags.push('anti-aging');
        if (lower.includes('hydratant')) tags.push('hydrating');
        if (lower.includes('bio') || lower.includes('naturel')) tags.push('natural', 'bio');
        if (lower.includes('parfum')) tags.push('fragrance');
        if (lower.includes('sérum')) tags.push('serum');
        if (lower.includes('crème')) tags.push('cream');
        if (lower.includes('homme')) tags.push('men');
        if (lower.includes('femme')) tags.push('women');
        
        return tags;
    }

    async scrapePromotions() {
        const allItems = [];
        const promoUrls = this.saleUrls.slice(0, 3);
        
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

module.exports = YvesRocherAdapter;
