/**
 * L'HAMZA F SEL'A - Jumia Fashion Adapter
 * 
 * Scrapes fashion/sports brands from Jumia Morocco
 * Includes: Adidas, Nike, Puma, and other fashion brands
 * Category: Fashion
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class JumiaFashionAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'Jumia Fashion',
            baseUrl: 'https://www.jumia.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'fashion',
            emoji: '👟',
            minDiscount: 10,
            maxItems: 100,
            timeout: 60000
        });

        // Fashion brand pages on Jumia
        this.saleUrls = [
            'https://www.jumia.ma/mlp-fashion-days/',
            'https://www.jumia.ma/catalog/?q=adidas&rating=4-5',
            'https://www.jumia.ma/catalog/?q=nike&rating=4-5',
            'https://www.jumia.ma/catalog/?q=puma&rating=4-5',
            'https://www.jumia.ma/chaussures-baskets-homme/',
            'https://www.jumia.ma/chaussures-baskets-femme/'
        ];
    }

    // Override to use visible browser
    async initBrowser() {
        if (this.browser) return;

        const { chromium } = require('playwright');
        
        this.browser = await chromium.launch({
            headless: false,
            slowMo: 30,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--start-maximized'
            ]
        });

        this.context = await this.browser.newContext({
            userAgent: this.getRandomUserAgent(),
            viewport: { width: 1366, height: 900 },
            locale: 'fr-MA',
            timezoneId: 'Africa/Casablanca'
        });

        logger.info(`${this.name}: Browser initialized (visible mode)`);
    }

    async scrollPage(page) {
        for (let i = 0; i < 8; i++) {
            await page.evaluate(() => window.scrollBy({ top: 600, behavior: 'smooth' }));
            await this.randomDelay(800, 1500);
        }
    }

    async scrape(url = null) {
        const allItems = [];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            for (const saleUrl of (url ? [url] : this.saleUrls.slice(0, 4))) {
                logger.info(`${this.name}: Scraping`, { url: saleUrl });
                
                await page.goto(saleUrl, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: this.timeout 
                });
                
                await this.handleCookieConsent(page);
                await this.randomDelay(2000, 3000);

                try {
                    await page.waitForSelector('article.prd, .sku, [data-sku]', { timeout: 10000 });
                } catch (e) {
                    logger.warn(`${this.name}: No products found on ${saleUrl}`);
                    continue;
                }

                await this.scrollPage(page);
                await this.randomDelay(1500, 2500);

                const rawItems = await page.evaluate((baseUrl) => {
                    const products = [];
                    
                    // Jumia product cards - multiple selectors
                    const cards = document.querySelectorAll('article.prd, .sku, [data-sku], a.core[href*=".html"]');
                    
                    cards.forEach(card => {
                        try {
                            // Name - try multiple selectors
                            const nameEl = card.querySelector('.name, .info h3, [data-name], .core h3, h3.name');
                            let name = nameEl?.textContent?.trim();
                            
                            // Link - IMPROVED: multiple ways to get the product URL
                            let link = null;
                            
                            // 1. If card itself is an anchor
                            if (card.tagName === 'A' && card.href) {
                                link = card.href;
                            }
                            // 2. Look for anchor with .core class (main product link)
                            if (!link) {
                                const coreLink = card.querySelector('a.core, a[href*=".html"]');
                                if (coreLink?.href) link = coreLink.href;
                            }
                            // 3. Any anchor inside the card
                            if (!link) {
                                const anyLink = card.querySelector('a[href]');
                                if (anyLink?.href && anyLink.href.includes('.html')) {
                                    link = anyLink.href;
                                }
                            }
                            // 4. Data attribute
                            if (!link) {
                                const sku = card.getAttribute('data-sku') || card.querySelector('[data-sku]')?.getAttribute('data-sku');
                                if (sku) {
                                    link = `${baseUrl}/catalog/?q=${sku}`;
                                }
                            }
                            
                            // Fallback name from link
                            if (!name && link) {
                                const titleMatch = link.match(/\/([^\/]+)-\d+\.html/);
                                if (titleMatch) {
                                    name = titleMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                }
                            }
                            
                            // Prices - Jumia uses specific classes
                            const currentPriceEl = card.querySelector('.prc, .price .act, [data-price]');
                            const originalPriceEl = card.querySelector('.old, .price .old, del');
                            
                            const currentPrice = currentPriceEl?.textContent?.trim();
                            const originalPrice = originalPriceEl?.textContent?.trim();
                            
                            // Discount badge
                            const discountEl = card.querySelector('.bdg._dsct, .tag._dsct, [class*="discount"]');
                            const discount = discountEl?.textContent?.trim();
                            
                            // Image
                            const imgEl = card.querySelector('img');
                            let image = imgEl?.getAttribute('data-src') || imgEl?.src;
                            
                            // Brand detection
                            const brandKeywords = ['adidas', 'nike', 'puma', 'reebok', 'fila', 'new balance', 'converse', 'vans'];
                            const nameLower = (name || '').toLowerCase();
                            const detectedBrand = brandKeywords.find(b => nameLower.includes(b));
                            
                            if (name && name.length > 3 && link) {
                                products.push({
                                    name,
                                    currentPrice,
                                    originalPrice,
                                    discountBadge: discount,
                                    image,
                                    link,
                                    brand: detectedBrand ? detectedBrand.charAt(0).toUpperCase() + detectedBrand.slice(1) : 'Jumia'
                                });
                            }
                        } catch (e) {}
                    });
                    
                    return products;
                }, this.baseUrl);

                if (rawItems.length > 0) {
                    logger.info(`${this.name}: Sample item: ${JSON.stringify(rawItems[0])}`);
                }
                
                allItems.push(...rawItems);
                logger.info(`${this.name}: Found ${rawItems.length} items from ${saleUrl}, total: ${allItems.length}`);
                
                await this.randomDelay(2000, 4000);
            }

            await page.close();
            await this.closeBrowser();
            
            // Filter valid items
            const validItems = allItems.filter(item => item.name && item.name.length > 3);
            
            // Deduplicate
            const uniqueItems = [...new Map(validItems.map(item => [`${item.name}-${item.link}`, item])).values()];
            
            const items = uniqueItems
                .slice(0, this.maxItems)
                .map(item => this.formatDeal({
                    ...item,
                    brand: item.brand || 'Jumia',
                    category: 'fashion'
                }))
                .filter(item => item.name);

            logger.info(`${this.name}: Total ${items.length} unique items`);
            
            return {
                success: true,
                store: this.name,
                source: 'jumia-fashion',
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

module.exports = JumiaFashionAdapter;
