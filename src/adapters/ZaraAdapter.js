/**
 * L'HAMZA F SEL'A - Zara Morocco Adapter
 * 
 * Scrapes fashion deals from Zara Morocco
 * Visits each product page to get accurate prices!
 * Category: Fashion
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class ZaraAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'Zara',
            baseUrl: 'https://www.zara.com/ma',
            currency: 'MAD',
            country: 'MA',
            category: 'fashion',
            emoji: '👗',
            minDiscount: 10,
            maxItems: 40,
            timeout: 90000
        });

        // Multiple sale/promo pages to try
        this.saleUrls = [
            'https://www.zara.com/ma/fr/femme-special-prices-l1314.html',
            'https://www.zara.com/ma/fr/homme-special-prices-l806.html',
            'https://www.zara.com/ma/fr/femme-nouveautes-l1180.html',
            'https://www.zara.com/ma/fr/homme-nouveautes-l839.html'
        ];
    }

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
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 900 },
            locale: 'fr-MA',
            timezoneId: 'Africa/Casablanca'
        });

        logger.info(`${this.name}: Browser initialized (visible mode)`);
    }

    async scrollToBottom(page) {
        let previousHeight = 0;
        let scrollCount = 0;
        const maxScrolls = 20;

        while (scrollCount < maxScrolls) {
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            
            if (currentHeight === previousHeight) {
                await page.evaluate(() => window.scrollBy(0, 500));
                await this.randomDelay(2000, 3000);
                
                const newHeight = await page.evaluate(() => document.body.scrollHeight);
                if (newHeight === currentHeight) break;
            }

            previousHeight = currentHeight;

            await page.evaluate(() => {
                window.scrollBy({ top: 700, behavior: 'smooth' });
            });

            await this.randomDelay(1000, 1800);
            scrollCount++;

            // Log progress
            const itemCount = await page.evaluate(() => 
                document.querySelectorAll('a[href*=".html"]').length
            );
            if (scrollCount % 5 === 0) {
                logger.info(`${this.name}: Scroll ${scrollCount}/${maxScrolls} - ${itemCount} links found`);
            }
        }
    }

    // Extract price from individual product page
    async getProductDetails(page, productUrl) {
        try {
            await page.goto(productUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: 25000 
            });
            
            await this.randomDelay(2000, 3500);
            
            // Handle cookie consent
            try {
                const cookieBtn = await page.$('#onetrust-accept-btn-handler, [data-qa-action="accept-cookies"], button:has-text("Accepter")');
                if (cookieBtn) {
                    await cookieBtn.click();
                    await this.randomDelay(500, 1000);
                }
            } catch (e) {}

            // Wait for price element
            try {
                await page.waitForSelector('.money-amount__main, [class*="price"], [class*="money"]', { 
                    timeout: 10000 
                });
            } catch (e) {
                logger.warn(`${this.name}: Price not found on ${productUrl}`);
            }

            const details = await page.evaluate(() => {
                let currentPrice = null;
                let originalPrice = null;
                let discount = null;
                let name = null;
                let image = null;

                // NAME - from h1 or product info
                const nameSelectors = [
                    'h1.product-detail-info__header-name',
                    'h1[class*="product"]',
                    '.product-detail-info__name',
                    'h1'
                ];
                for (const sel of nameSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.textContent.trim().length > 2) {
                        name = el.textContent.trim();
                        break;
                    }
                }

                // IMAGE - from product gallery
                const imgSelectors = [
                    '.media-image__image img',
                    'picture.media-image img',
                    '.product-detail-images img',
                    'img[src*="zara.net"]'
                ];
                for (const sel of imgSelectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        image = el.src || el.getAttribute('data-src');
                        if (image && !image.includes('transparent') && !image.includes('data:')) {
                            break;
                        }
                    }
                }
                // Try picture source
                if (!image || image.includes('transparent')) {
                    const source = document.querySelector('picture source[srcset]');
                    if (source) {
                        const srcset = source.getAttribute('srcset');
                        image = srcset.split(',')[0]?.split(' ')[0];
                    }
                }

                // PRICES - Zara structure: crossed old price, discount %, current price
                // Find all money-amount elements
                const priceContainer = document.querySelector('.product-detail-info__price, .price-current, .price');
                const allPrices = document.querySelectorAll('.money-amount__main');
                
                // Extract all price values as numbers
                // IMPORTANT: Filter out small numbers (discount %, decimals) — real MAD prices are >= 50
                const priceValues = [];
                allPrices.forEach(el => {
                    const text = el.textContent?.trim();
                    if (text && text.match(/[\d.,]+/)) {
                        const numValue = parseFloat(text.replace(/[^\d.,]/g, '').replace(',', '.'));
                        // Only accept values that look like real prices (>= 50 MAD, <= 100000 MAD)
                        if (numValue >= 50 && numValue <= 100000) {
                            priceValues.push({ text, value: numValue });
                        }
                    }
                });

                // Sort by value - highest is original, lowest is current (sale price)
                if (priceValues.length >= 2) {
                    priceValues.sort((a, b) => b.value - a.value); // Descending
                    originalPrice = priceValues[0].text; // Highest = original
                    currentPrice = priceValues[priceValues.length - 1].text; // Lowest = sale price
                } else if (priceValues.length === 1) {
                    currentPrice = priceValues[0].text;
                }

                // Try to get discount percentage from page
                const discountEl = document.querySelector('[class*="discount"], .price-current__discount');
                if (discountEl) {
                    const match = discountEl.textContent?.match(/-?(\d+)%/);
                    if (match) discount = parseInt(match[1]);
                }

                // Calculate discount if we have both prices
                if (originalPrice && currentPrice) {
                    const orig = parseFloat(originalPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
                    const curr = parseFloat(currentPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
                    
                    // Only valid if original > current
                    if (orig > curr) {
                        discount = Math.round((1 - curr / orig) * 100);
                    } else {
                        // No real discount - this is not a sale item
                        originalPrice = null;
                        discount = null;
                    }
                }

                return { currentPrice, originalPrice, discount, name, image };
            });

            return details;
            
        } catch (error) {
            logger.warn(`${this.name}: Error on ${productUrl}: ${error.message}`);
            return null;
        }
    }

    async scrape(url = null) {
        const allItems = [];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            // Step 1: Collect product links from grid pages
            const productLinks = new Set();
            
            for (const saleUrl of this.saleUrls) {
                logger.info(`${this.name}: Collecting from ${saleUrl}`);
                
                try {
                    await page.goto(saleUrl, { 
                        waitUntil: 'networkidle', 
                        timeout: this.timeout 
                    });
                } catch (e) {
                    logger.warn(`${this.name}: Timeout on ${saleUrl}, trying domcontentloaded`);
                    try {
                        await page.goto(saleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    } catch (e2) {
                        logger.warn(`${this.name}: Failed to load ${saleUrl}`);
                        continue;
                    }
                }
                
                // Handle cookie consent
                try {
                    const cookieBtn = await page.$('#onetrust-accept-btn-handler, button:has-text("Accepter"), [data-qa-action="accept-cookies"]');
                    if (cookieBtn) {
                        await cookieBtn.click();
                        await this.randomDelay(1000, 2000);
                    }
                } catch (e) {}

                await this.randomDelay(3000, 5000);

                // Scroll to load products
                await this.scrollToBottom(page);
                await this.randomDelay(2000, 3000);

                // Get all product links - multiple selector strategies
                const links = await page.evaluate(() => {
                    const linkSet = new Set();
                    
                    // Strategy 1: All links containing product patterns
                    document.querySelectorAll('a[href]').forEach(a => {
                        const href = a.href;
                        // Zara product URLs: contain -p followed by digits and .html
                        if (href && href.includes('zara.com/ma/fr/') && href.match(/-p\d+\.html/)) {
                            linkSet.add(href);
                        }
                    });
                    
                    // Strategy 2: Product grid items
                    document.querySelectorAll('.product-link, [class*="product-grid"] a').forEach(a => {
                        if (a.href && a.href.includes('.html')) {
                            linkSet.add(a.href);
                        }
                    });
                    
                    return Array.from(linkSet);
                });

                links.forEach(link => productLinks.add(link));
                logger.info(`${this.name}: Found ${links.length} links on ${saleUrl}, total: ${productLinks.size}`);
                
                // Stop if we have enough
                if (productLinks.size >= this.maxItems) break;
                
                await this.randomDelay(1000, 2000);
            }

            const uniqueLinks = Array.from(productLinks).slice(0, this.maxItems);
            logger.info(`${this.name}: Will visit ${uniqueLinks.length} product pages`);

            if (uniqueLinks.length === 0) {
                logger.warn(`${this.name}: No product links found! Check page structure.`);
                
                // Debug: take screenshot
                try {
                    await page.screenshot({ path: 'zara-debug.png' });
                    logger.info(`${this.name}: Debug screenshot saved to zara-debug.png`);
                } catch (e) {}
                
                await this.closeBrowser();
                return { success: false, error: 'No products found', items: [] };
            }

            // Step 2: Visit each product page
            let successCount = 0;
            for (let i = 0; i < uniqueLinks.length; i++) {
                const productUrl = uniqueLinks[i];
                logger.info(`${this.name}: [${i + 1}/${uniqueLinks.length}] Visiting product page...`);
                
                const details = await this.getProductDetails(page, productUrl);
                
                if (details && details.currentPrice) {
                    // Extract name from URL if needed
                    let name = details.name;
                    if (!name) {
                        const urlMatch = productUrl.match(/\/([^\/]+)-p\d+\.html/);
                        if (urlMatch) {
                            name = urlMatch[1]
                                .replace(/-/g, ' ')
                                .replace(/\b\w/g, l => l.toUpperCase());
                        }
                    }

                    allItems.push({
                        name: name || 'Produit Zara',
                        currentPrice: details.currentPrice,
                        originalPrice: details.originalPrice,
                        discount: details.discount,
                        image: details.image,
                        link: productUrl,
                        brand: 'Zara',
                        category: 'fashion'
                    });
                    
                    successCount++;
                    logger.info(`${this.name}: ✅ ${name}: ${details.currentPrice}${details.originalPrice ? ' (was ' + details.originalPrice + ')' : ''}`);
                }
                
                await this.randomDelay(400, 800);
            }

            await page.close();
            await this.closeBrowser();
            
            logger.info(`${this.name}: Got ${successCount}/${uniqueLinks.length} products with prices`);
            
            // Format deals
            const items = allItems.map(item => this.formatDeal(item)).filter(item => item.name);

            return {
                success: items.length > 0,
                store: this.name,
                source: 'zara',
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

module.exports = ZaraAdapter;
