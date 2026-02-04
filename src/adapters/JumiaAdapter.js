/**
 * L'HAMZA F SEL'A - Jumia Morocco Adapter
 * 
 * Scrapes deals from Jumia.ma (Largest Moroccan e-commerce)
 * Categories: Tech, Fashion, Home, Beauty
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../utils/logger');

class JumiaAdapter extends BaseAdapter {
    constructor(category = 'all') {
        super({
            name: 'Jumia',
            baseUrl: 'https://www.jumia.ma',
            currency: 'MAD',
            country: 'MA',
            category: category,
            emoji: '🛍️',
            minDiscount: 10,
            maxItems: 50
        });

        // Category-specific URLs
        this.categoryUrls = {
            tech: [
                'https://www.jumia.ma/ordinateurs-portables/',
                'https://www.jumia.ma/telephones-smartphones/',
                'https://www.jumia.ma/tablettes/',
                'https://www.jumia.ma/accessoires-telephonie/'
            ],
            fashion: [
                'https://www.jumia.ma/mode-homme/',
                'https://www.jumia.ma/mode-femme/',
                'https://www.jumia.ma/chaussures-homme/',
                'https://www.jumia.ma/chaussures-femme/',
                'https://www.jumia.ma/montres/',
                'https://www.jumia.ma/sacs-accessoires/'
            ],
            home: [
                'https://www.jumia.ma/maison-cuisine/',
                'https://www.jumia.ma/electromenager/'
            ],
            beauty: [
                // Main Categories
                'https://www.jumia.ma/maquillage/',
                'https://www.jumia.ma/beaute-parfums/',
                'https://www.jumia.ma/soins-visage/',
                // Top Brands 💄
                'https://www.jumia.ma/catalog/?q=maybelline',
                'https://www.jumia.ma/catalog/?q=loreal',
                'https://www.jumia.ma/catalog/?q=nyx',
                'https://www.jumia.ma/catalog/?q=essence+makeup',
                'https://www.jumia.ma/catalog/?q=garnier',
                'https://www.jumia.ma/catalog/?q=eveline',
                // More
                'https://www.jumia.ma/soins-cheveux/',
                'https://www.jumia.ma/parfums/'
            ],
            all: [
                'https://www.jumia.ma/flash-sales/',
                'https://www.jumia.ma/mlp-jumia-deals/'
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
            
            // Scroll slowly to trigger lazy loading of images
            await this.scrollPage(page, 10);
            
            // Scroll back to top and wait for images to load
            await page.evaluate(() => window.scrollTo(0, 0));
            await this.randomDelay(1000, 2000);
            
            // Wait for images to have data-src loaded
            await page.waitForTimeout(2000);

            const rawItems = await page.evaluate(() => {
                const products = [];
                
                // Jumia product card selectors
                const cardSelectors = [
                    'article.prd',
                    '.sku.-gallery',
                    '[data-sku]',
                    '.product-card',
                    'a.core'
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
                            '.name',
                            '.title',
                            'h3',
                            '.info h3',
                            '.prd-name'
                        ]);
                        
                        const currentPrice = getText([
                            '.prc',
                            '.price',
                            '.new-price',
                            '.sales-price'
                        ]);
                        
                        const originalPrice = getText([
                            '.old',
                            '.old-price',
                            '.original-price',
                            'del'
                        ]);
                        
                        const discount = getText([
                            '.bdg._dsct',
                            '.discount',
                            '.tag._dsct',
                            '[class*="discount"]'
                        ]);
                        
                        const rating = getText([
                            '.stars._s',
                            '.rating',
                            '.rev'
                        ]);
                        
                        // Jumia uses lazy loading - check multiple attributes
                        const imgEl = card.querySelector('img');
                        let image = '';
                        if (imgEl) {
                            // Priority: data-src (lazy load) > src > data-lazy-src
                            image = imgEl.getAttribute('data-src') || 
                                   imgEl.getAttribute('src') || 
                                   imgEl.getAttribute('data-lazy-src') ||
                                   imgEl.getAttribute('data-original') || '';
                            
                            // Skip placeholder/loading images
                            if (image.includes('placeholder') || 
                                image.includes('loader') || 
                                image.includes('data:image') ||
                                image.includes('spinner')) {
                                image = imgEl.getAttribute('data-src') || '';
                            }
                        }
                        
                        const link = card.tagName === 'A' ? card.href : card.querySelector('a')?.href;
                        
                        if (name && name.length > 3) {
                            products.push({
                                name,
                                currentPrice,
                                originalPrice,
                                discountBadge: discount,
                                rating,
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
            
            // Detect category from URL
            const detectedCategory = this.detectCategoryFromUrl(targetUrl);
            
            // Process and format items
            const items = rawItems
                .slice(0, this.maxItems)
                .map(item => this.formatDeal({
                    ...item,
                    brand: 'Jumia',
                    category: detectedCategory
                }))
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} items`);
            
            return {
                success: true,
                store: this.name,
                source: 'jumia',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }

    // Detect category from URL
    detectCategoryFromUrl(url) {
        if (url.includes('ordinateurs') || url.includes('telephones') || url.includes('tablettes') || url.includes('telephonie')) {
            return 'tech';
        }
        if (url.includes('mode') || url.includes('chaussures') || url.includes('montres') || url.includes('sacs')) {
            return 'fashion';
        }
        if (url.includes('maison') || url.includes('electromenager')) {
            return 'home';
        }
        if (url.includes('beaute') || url.includes('soins') || url.includes('parfums')) {
            return 'beauty';
        }
        return 'general';
    }

    // Scrape multiple categories
    async scrapeCategory(category) {
        const urls = this.categoryUrls[category] || this.categoryUrls.all;
        const allItems = [];
        
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
            category,
            itemCount: allItems.length,
            items: allItems
        };
    }

    // Scrape all categories
    async scrapeAll() {
        const allItems = [];
        const categories = ['tech', 'fashion', 'home', 'beauty'];
        
        for (const category of categories) {
            const result = await this.scrapeCategory(category);
            if (result.success && result.items) {
                allItems.push(...result.items);
            }
        }

        return {
            success: true,
            store: this.name,
            itemCount: allItems.length,
            items: allItems
        };
    }
}

module.exports = JumiaAdapter;
