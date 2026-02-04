/**
 * L'HAMZA F SEL'A - Pull&Bear Morocco Adapter
 * 
 * Scrapes fashion deals from Pull&Bear Morocco with scroll-based loading
 * Category: Fashion
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class PullBearAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'Pull&Bear',
            baseUrl: 'https://www.pullandbear.com/ma',
            currency: 'MAD',
            country: 'MA',
            category: 'fashion',
            emoji: '🧥',
            minDiscount: 10,
            maxItems: 100,
            timeout: 90000
        });

        this.saleUrls = [
            'https://www.pullandbear.com/ma/fr/femme-n11',
            'https://www.pullandbear.com/ma/fr/homme-n12',
            'https://www.pullandbear.com/ma/fr/femme/vetements-n6420',
            'https://www.pullandbear.com/ma/fr/homme/vetements-n6486'
        ];
    }

    // Override to use visible browser
    async initBrowser() {
        if (this.browser) return;

        const { chromium } = require('playwright');
        
        this.browser = await chromium.launch({
            headless: false,
            slowMo: 50,
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

    // Pull&Bear uses infinite scroll like Zara (same Inditex platform)
    async scrollToBottom(page) {
        let previousHeight = 0;
        let scrollCount = 0;
        const maxScrolls = 25;

        while (scrollCount < maxScrolls) {
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            
            if (currentHeight === previousHeight) {
                await page.evaluate(() => window.scrollBy(0, 1000));
                await this.randomDelay(2000, 3000);
                
                const newHeight = await page.evaluate(() => document.body.scrollHeight);
                if (newHeight === currentHeight) break;
            }

            previousHeight = currentHeight;

            await page.evaluate(() => {
                window.scrollBy({
                    top: 700,
                    behavior: 'smooth'
                });
            });

            await this.randomDelay(1000, 2000);
            scrollCount++;

            const itemCount = await page.evaluate(() => 
                document.querySelectorAll('.product-link, [data-productid], .grid-product, .product-grid-product').length
            );
            logger.info(`${this.name}: Scroll ${scrollCount}/${maxScrolls} - Found ${itemCount} items`);
        }
    }

    async scrape(url = null) {
        const allItems = [];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            for (const saleUrl of (url ? [url] : this.saleUrls.slice(0, 2))) {
                logger.info(`${this.name}: Scraping`, { url: saleUrl });
                
                await page.goto(saleUrl, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: this.timeout 
                });
                
                await this.handleCookieConsent(page);
                await this.randomDelay(3000, 5000);

                try {
                    await page.waitForSelector('.product-link, [data-productid], .grid-product, .product-grid-product', { 
                        timeout: 15000 
                    });
                } catch (e) {
                    logger.warn(`${this.name}: No products found on ${saleUrl}`);
                    continue;
                }

                await this.scrollToBottom(page);
                await this.randomDelay(2000, 3000);

                const rawItems = await page.evaluate(() => {
                    const products = [];
                    
                    // Pull&Bear selectors (Inditex platform)
                    const selectors = [
                        'li.product-grid-product',
                        'article.product-grid-product',
                        '[data-productid]',
                        '.product-grid__product-list li',
                        'a.product-link',
                        'a[href*=".html"]'
                    ];
                    
                    let cards = [];
                    for (const sel of selectors) {
                        cards = document.querySelectorAll(sel);
                        if (cards.length > 0) break;
                    }
                    
                    cards.forEach(card => {
                        try {
                            // Link first - needed for name extraction
                            let link = card.href;
                            if (!link) {
                                const linkEl = card.querySelector('a[href*=".html"]');
                                link = linkEl?.href;
                            }
                            
                            // Name - try selectors first
                            let name = '';
                            const nameSelectors = [
                                '.product-grid-product-info__name span',
                                '.product-grid-product-info__name',
                                '.product-grid-product__name span',
                                '.product-grid-product__name',
                                'h2 span',
                                'h2'
                            ];
                            for (const sel of nameSelectors) {
                                const el = card.querySelector(sel);
                                const text = el?.textContent?.trim();
                                if (text && text.length > 3 && 
                                    !text.toLowerCase().includes('ajouter') &&
                                    !text.toLowerCase().includes('panier')) {
                                    name = text;
                                    break;
                                }
                            }
                            
                            // Fallback: Extract from URL
                            if (!name && link) {
                                const urlMatch = link.match(/\/([^\/]+)-p\d+\.html/);
                                if (urlMatch) {
                                    name = urlMatch[1]
                                        .replace(/-/g, ' ')
                                        .replace(/\b\w/g, l => l.toUpperCase());
                                }
                            }
                            
                            // Prices
                            let currentPrice = '';
                            let originalPrice = '';
                            
                            const priceSelectors = ['.money-amount__main', '.price span', '.price'];
                            for (const sel of priceSelectors) {
                                const el = card.querySelector(sel);
                                if (el?.textContent?.trim()) {
                                    currentPrice = el.textContent.trim();
                                    break;
                                }
                            }
                            
                            // Image
                            const imgEl = card.querySelector('img');
                            let image = imgEl?.src;
                            if (!image || image.includes('transparent')) {
                                image = imgEl?.getAttribute('data-src') || 
                                       imgEl?.getAttribute('srcset')?.split(' ')[0];
                            }
                            
                            if (name && name.length > 2) {
                                products.push({
                                    name,
                                    currentPrice,
                                    originalPrice,
                                    discountBadge: '',
                                    image,
                                    link
                                });
                            }
                        } catch (e) {}
                    });
                    
                    return products;
                });

                allItems.push(...rawItems);
                logger.info(`${this.name}: Found ${rawItems.length} items from ${saleUrl}`);
                
                await this.randomDelay(2000, 4000);
            }

            await page.close();
            await this.closeBrowser();
            
            const uniqueItems = [...new Map(allItems.map(item => [item.name, item])).values()];
            
            const items = uniqueItems
                .slice(0, this.maxItems)
                .map(item => this.formatDeal({
                    ...item,
                    brand: 'Pull&Bear',
                    category: 'fashion'
                }))
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Total ${items.length} unique items`);
            
            return {
                success: true,
                store: this.name,
                source: 'pullbear',
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

module.exports = PullBearAdapter;
