/**
 * L'HAMZA F SEL'A - Hmall.ma Adapter
 * 
 * Scrapes beauty/makeup deals from Hmall.ma (Marjane's online beauty store)
 * Categories: Face, Eyes, Lips, Kits, Skincare
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../utils/logger');

class HmallAdapter extends BaseAdapter {
    constructor(category = 'beauty') {
        super({
            name: 'Hmall',
            baseUrl: 'https://www.hmall.ma',
            currency: 'MAD',
            country: 'MA',
            category: category,
            emoji: '💄',
            minDiscount: 5,
            maxItems: 50
        });

        // Category-specific URLs
        this.categoryUrls = {
            beauty: [
                'https://www.hmall.ma/beaute/maquillage.html',
                'https://www.hmall.ma/beaute/maquillage/visage.html',
                'https://www.hmall.ma/beaute/maquillage/yeux.html',
                'https://www.hmall.ma/beaute/maquillage/levres.html',
                'https://www.hmall.ma/beaute/maquillage/ongles.html'
            ],
            skincare: [
                'https://www.hmall.ma/beaute/soin-visage.html',
                'https://www.hmall.ma/beaute/soin-corps.html'
            ],
            all: [
                'https://www.hmall.ma/beaute.html'
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
            await this.scrollPage(page, 8);

            const rawItems = await page.evaluate(() => {
                const products = [];
                
                // Hmall product card selectors (Magento-based)
                const cardSelectors = [
                    '.product-item',
                    '.product-item-info',
                    '.item.product',
                    '[data-product-id]'
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
                            '.product-item-name',
                            '.product-name',
                            '.product-item-link',
                            'a.product-item-link'
                        ]);
                        
                        const currentPrice = getText([
                            '.special-price .price',
                            '.price-box .price',
                            '[data-price-type="finalPrice"] .price',
                            '.price'
                        ]);
                        
                        const originalPrice = getText([
                            '.old-price .price',
                            '.price-box .old-price .price',
                            '[data-price-type="oldPrice"] .price'
                        ]);
                        
                        const discount = getText([
                            '.discount-percent',
                            '.sale-label',
                            '.discount-label'
                        ]);
                        
                        // Image extraction
                        const imgEl = card.querySelector('img');
                        let image = '';
                        if (imgEl) {
                            image = imgEl.getAttribute('data-src') || 
                                   imgEl.getAttribute('src') || 
                                   imgEl.getAttribute('data-lazy') || '';
                        }
                        
                        const link = getAttr('a.product-item-link', 'href') || 
                                    getAttr('a', 'href') || '';
                        
                        const brand = getText([
                            '.product-brand',
                            '.brand-name',
                            '[data-brand]'
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
                    brand: item.brand || 'Hmall',
                    category: 'beauty'
                }))
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} beauty items`);
            
            return {
                success: true,
                store: this.name,
                source: 'hmall',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }

    // Scrape all beauty categories
    async scrapeAll() {
        const allItems = [];
        const urls = [
            ...this.categoryUrls.beauty,
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

module.exports = HmallAdapter;
