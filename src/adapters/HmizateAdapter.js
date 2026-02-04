/**
 * L'HAMZA F SEL'A - Hmizate Morocco Adapter
 * 
 * Scrapes deals from Hmizate.ma (Moroccan Daily Deals Site)
 * Categories: Beauty, Tech, Fashion, Home, Services
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class HmizateAdapter extends BaseAdapter {
    constructor(category = 'beauty') {
        super({
            name: 'Hmizate',
            baseUrl: 'https://www.hmizate.ma',
            currency: 'MAD',
            country: 'MA',
            category: category,
            emoji: '🔥',
            minDiscount: 20,
            maxItems: 40
        });

        this.categoryUrls = {
            beauty: [
                'https://www.hmizate.ma/deals/beaute-bien-etre',
                'https://www.hmizate.ma/deals/beaute',
                'https://www.hmizate.ma/deals/parfums',
                'https://www.hmizate.ma/deals/soins'
            ],
            tech: [
                'https://www.hmizate.ma/deals/high-tech',
                'https://www.hmizate.ma/deals/informatique',
                'https://www.hmizate.ma/deals/telephonie'
            ],
            fashion: [
                'https://www.hmizate.ma/deals/mode',
                'https://www.hmizate.ma/deals/accessoires'
            ],
            home: [
                'https://www.hmizate.ma/deals/maison',
                'https://www.hmizate.ma/deals/electromenager'
            ],
            all: [
                'https://www.hmizate.ma/deals',
                'https://www.hmizate.ma/'
            ]
        };
    }

    async scrape(url = null) {
        const targetUrl = url || this.categoryUrls[this.category]?.[0] || this.categoryUrls.all[0];
        
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
            await this.scrollPage(page, 5);

            const rawItems = await page.evaluate(() => {
                const products = [];
                
                // Hmizate deal card selectors
                const cardSelectors = [
                    '.deal-item',
                    '.deal-card',
                    '.product-item',
                    '.offre',
                    '[class*="deal"]',
                    '.item'
                ];
                
                let cards = [];
                for (const selector of cardSelectors) {
                    cards = document.querySelectorAll(selector);
                    if (cards.length > 0) break;
                }
                
                // If no cards found, try generic approach
                if (cards.length === 0) {
                    cards = document.querySelectorAll('a[href*="/deal/"]');
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
                            '.deal-title',
                            '.title',
                            'h2',
                            'h3',
                            '.name',
                            '.offre-title'
                        ]) || card.querySelector('img')?.alt || '';
                        
                        const currentPrice = getText([
                            '.deal-price',
                            '.price',
                            '.new-price',
                            '.prix',
                            '[class*="price"]',
                            '.montant'
                        ]);
                        
                        const originalPrice = getText([
                            '.old-price',
                            '.original-price',
                            '.prix-barre',
                            'del',
                            's',
                            '[class*="old"]'
                        ]);
                        
                        const discount = getText([
                            '.discount',
                            '.reduction',
                            '.pourcentage',
                            '[class*="discount"]',
                            '.badge'
                        ]);
                        
                        const image = getAttr('img', 'src') || 
                                     getAttr('img', 'data-src') ||
                                     getAttr('img', 'data-lazy');
                        
                        const link = card.tagName === 'A' ? card.href : card.querySelector('a')?.href;
                        
                        const location = getText([
                            '.location',
                            '.ville',
                            '.city',
                            '[class*="location"]'
                        ]);
                        
                        if (name && name.length > 3) {
                            products.push({
                                name,
                                currentPrice,
                                originalPrice,
                                discountBadge: discount,
                                image,
                                link,
                                location: location || 'Morocco'
                            });
                        }
                    } catch (e) {}
                });
                
                return products;
            });

            await page.close();
            await this.closeBrowser();
            
            // Detect category from URL
            const detectedCategory = this.detectCategoryFromUrl(targetUrl);
            
            // Process and format items
            const items = rawItems
                .slice(0, this.maxItems)
                .map(item => this.formatDeal({
                    ...item,
                    brand: 'Hmizate',
                    category: detectedCategory
                }))
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} items`);
            
            return {
                success: true,
                store: this.name,
                source: 'hmizate',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }

    detectCategoryFromUrl(url) {
        if (url.includes('beaute') || url.includes('parfum') || url.includes('soins') || url.includes('bien-etre')) {
            return 'beauty';
        }
        if (url.includes('high-tech') || url.includes('informatique') || url.includes('telephonie')) {
            return 'tech';
        }
        if (url.includes('mode') || url.includes('accessoires')) {
            return 'fashion';
        }
        if (url.includes('maison') || url.includes('electromenager')) {
            return 'home';
        }
        return 'general';
    }

    async scrapeCategory(category) {
        const urls = this.categoryUrls[category] || this.categoryUrls.all;
        const allItems = [];
        
        for (const url of urls) {
            const result = await this.scrape(url);
            if (result.success && result.items) {
                allItems.push(...result.items);
            }
            await this.randomDelay(2000, 4000);
        }

        return {
            success: true,
            store: this.name,
            category,
            itemCount: allItems.length,
            items: allItems
        };
    }

    async scrapeBeauty() {
        return this.scrapeCategory('beauty');
    }
}

module.exports = HmizateAdapter;
