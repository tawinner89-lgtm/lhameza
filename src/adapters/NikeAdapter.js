/**
 * L'HAMZA F SEL'A - Nike Adapter
 * 
 * Scrapes deals directly from Nike website
 * Category: Fashion/Sports
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class NikeAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'Nike',
            baseUrl: 'https://www.nike.com',
            currency: 'MAD',
            country: 'MA',
            category: 'fashion',
            emoji: '👟',
            minDiscount: 10,
            maxItems: 50,
            timeout: 90000
        });

        // Nike FR sold page — 1900+ products on sale!
        this.saleUrls = [
            'https://www.nike.com/fr/w?q=sold&vst=sold'
        ];
        
        // EUR to MAD conversion rate
        this.eurToMad = 10.8;
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
            locale: 'fr-FR',
            timezoneId: 'Europe/Paris'
        });

        logger.info(`${this.name}: Browser initialized (visible mode)`);
    }

    async scrollToLoadProducts(page) {
        let previousHeight = 0;
        let scrollCount = 0;
        const maxScrolls = 15;

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
                window.scrollBy({ top: 800, behavior: 'smooth' });
            });

            await this.randomDelay(1000, 2000);
            scrollCount++;

            if (scrollCount % 5 === 0) {
                const itemCount = await page.evaluate(() => 
                    document.querySelectorAll('[data-testid="product-card"], .product-card').length
                );
                logger.info(`${this.name}: Scroll ${scrollCount}/${maxScrolls} - ${itemCount} products`);
            }
        }
    }

    async getProductDetails(page, productUrl) {
        try {
            await page.goto(productUrl, { 
                waitUntil: 'networkidle', 
                timeout: 30000 
            });
            
            await this.randomDelay(3000, 4000);

            // Handle cookie consent
            try {
                const cookieBtn = await page.$('#hf_cookie_text_modal_accept, button:has-text("Accepter"), [data-testid="dialog-accept-button"]');
                if (cookieBtn) {
                    await cookieBtn.click();
                    await this.randomDelay(1000, 2000);
                }
            } catch (e) {}

            // Wait for price to load
            try {
                await page.waitForSelector('[data-testid="currentPrice-container"], .product-price, [class*="product-price"]', { timeout: 10000 });
            } catch (e) {}

            const details = await page.evaluate(() => {
                let currentPrice = null;
                let originalPrice = null;
                let discount = null;
                let name = null;
                let image = null;

                // NAME - Multiple selectors for Nike
                const nameSelectors = [
                    'h1#pdp_product_title',
                    'h1[data-testid="product_title"]',
                    '[data-testid="product-title"]',
                    'h1.headline-2',
                    'h1.css-1iw142r',
                    'h1'
                ];
                for (const sel of nameSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.textContent.trim().length > 2) {
                        name = el.textContent.trim();
                        break;
                    }
                }

                // IMAGE - Try multiple sources
                const imgSelectors = [
                    '[data-testid="HeroImg"] img',
                    '.css-1fxh5tw img',
                    '[data-testid="Image-Container"] img',
                    'picture img',
                    'img[src*="static.nike.com"]',
                    'img[src*="nike.com"]',
                    '.product-gallery img',
                    '[class*="ProductImage"] img'
                ];
                for (const sel of imgSelectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        // Try src, data-src, srcset
                        let imgUrl = el.src || el.getAttribute('data-src');
                        if (!imgUrl || imgUrl.includes('data:')) {
                            const srcset = el.getAttribute('srcset');
                            if (srcset) {
                                imgUrl = srcset.split(',')[0]?.trim().split(' ')[0];
                            }
                        }
                        
                        if (imgUrl && !imgUrl.includes('data:')) {
                            // Ensure https and clean URL
                            if (imgUrl.startsWith('//')) {
                                imgUrl = 'https:' + imgUrl;
                            }
                            // Use high-res version
                            if (imgUrl.includes('t_PDP_')) {
                                imgUrl = imgUrl.replace(/t_PDP_[^/]+/, 't_PDP_1728_v1');
                            }
                            image = imgUrl;
                            break;
                        }
                    }
                }

                // PRICES - Nike 2024+ structure
                // Try to find price container first
                const priceContainerSelectors = [
                    '[data-testid="currentPrice-container"]',
                    '[data-testid="product-price"]',
                    '.product-price',
                    '[class*="ProductPrice"]'
                ];

                for (const sel of priceContainerSelectors) {
                    const container = document.querySelector(sel);
                    if (container) {
                        const text = container.textContent;
                        // Extract prices from text like "89,99 €" or "89,99 € 119,99 €"
                        const prices = text.match(/[\d.,]+\s*€/g);
                        if (prices && prices.length > 0) {
                            // If multiple prices, first is usually current, second is original
                            if (prices.length >= 2) {
                                currentPrice = prices[0];
                                originalPrice = prices[1];
                            } else {
                                currentPrice = prices[0];
                            }
                            break;
                        }
                    }
                }

                // Fallback: look for specific price elements
                if (!currentPrice) {
                    const currentEl = document.querySelector('[data-testid="currentPrice-container"] div, .css-b9fpep, .css-1emn094');
                    if (currentEl) {
                        const match = currentEl.textContent.match(/[\d.,]+\s*€/);
                        if (match) currentPrice = match[0];
                    }
                }

                if (!originalPrice) {
                    const origEl = document.querySelector('[data-testid="initialPrice-container"] div, .css-1lxspbu, del');
                    if (origEl) {
                        const match = origEl.textContent.match(/[\d.,]+\s*€/);
                        if (match) originalPrice = match[0];
                    }
                }

                // Calculate discount
                if (originalPrice && currentPrice) {
                    const orig = parseFloat(originalPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
                    const curr = parseFloat(currentPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
                    if (orig > curr && orig > 0) {
                        discount = Math.round((1 - curr / orig) * 100);
                    }
                }

                return { currentPrice, originalPrice, discount, name, image };
            });

            // Log what we found for debugging
            if (details.name || details.currentPrice) {
                console.log(`Nike page: name=${details.name}, price=${details.currentPrice}`);
            }

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
            
            // Collect product links
            const productLinks = new Set();
            
            for (const saleUrl of this.saleUrls) {
                logger.info(`${this.name}: Collecting from ${saleUrl}`);
                
                try {
                    await page.goto(saleUrl, { 
                        waitUntil: 'domcontentloaded', 
                        timeout: this.timeout 
                    });
                } catch (e) {
                    logger.warn(`${this.name}: Timeout on ${saleUrl}`);
                    continue;
                }

                // Handle cookie consent
                try {
                    const cookieBtn = await page.$('#hf_cookie_text_modal_accept, button:has-text("Accepter"), [data-testid="dialog-accept-button"]');
                    if (cookieBtn) {
                        await cookieBtn.click();
                        await this.randomDelay(1000, 2000);
                    }
                } catch (e) {}

                await this.randomDelay(3000, 5000);

                // Scroll to load products
                await this.scrollToLoadProducts(page);
                await this.randomDelay(2000, 3000);

                // Get product links
                const links = await page.evaluate(() => {
                    const linkSet = new Set();
                    
                    // Nike product cards
                    document.querySelectorAll('a[href*="/t/"], a[href*="/fr/t/"]').forEach(a => {
                        if (a.href && !a.href.includes('/w/') && !a.href.includes('/men/') && !a.href.includes('/women/')) {
                            linkSet.add(a.href);
                        }
                    });
                    
                    // Product card links
                    document.querySelectorAll('[data-testid="product-card"] a, .product-card a').forEach(a => {
                        if (a.href) linkSet.add(a.href);
                    });
                    
                    return Array.from(linkSet);
                });

                links.forEach(link => productLinks.add(link));
                logger.info(`${this.name}: Found ${links.length} links on ${saleUrl}, total: ${productLinks.size}`);
                
                if (productLinks.size >= this.maxItems) break;
                
                await this.randomDelay(1000, 2000);
            }

            const uniqueLinks = Array.from(productLinks).slice(0, this.maxItems);
            logger.info(`${this.name}: Will visit ${uniqueLinks.length} product pages`);

            if (uniqueLinks.length === 0) {
                // Try scraping from grid directly
                logger.info(`${this.name}: No links found, trying grid extraction`);
                
                const gridItems = await this.scrapeFromGrid(page);
                if (gridItems.length > 0) {
                    await this.closeBrowser();
                    return {
                        success: true,
                        store: this.name,
                        source: 'nike',
                        itemCount: gridItems.length,
                        items: gridItems
                    };
                }
                
                await this.closeBrowser();
                return { success: false, error: 'No products found', items: [] };
            }

            // Visit each product page
            let successCount = 0;
            for (let i = 0; i < uniqueLinks.length; i++) {
                const productUrl = uniqueLinks[i];
                logger.info(`${this.name}: [${i + 1}/${uniqueLinks.length}] Visiting product...`);
                
                const details = await this.getProductDetails(page, productUrl);
                
                if (details && details.currentPrice) {
                    let name = details.name;
                    if (!name) {
                        const urlMatch = productUrl.match(/\/t\/([^\/]+)/);
                        if (urlMatch) {
                            name = urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        }
                    }

                    allItems.push({
                        name: name || 'Nike Product',
                        currentPrice: details.currentPrice,
                        originalPrice: details.originalPrice,
                        discount: details.discount,
                        image: details.image,
                        link: productUrl,
                        brand: 'Nike',
                        category: 'fashion'
                    });
                    
                    successCount++;
                    logger.info(`${this.name}: ✅ ${name}: ${details.currentPrice}${details.originalPrice ? ' (was ' + details.originalPrice + ')' : ''}`);
                }
                
                await this.randomDelay(500, 1000);
            }

            await page.close();
            await this.closeBrowser();
            
            logger.info(`${this.name}: Got ${successCount}/${uniqueLinks.length} products`);
            
            const items = allItems.map(item => this.formatDeal(item)).filter(item => item.name);

            return {
                success: items.length > 0,
                store: this.name,
                source: 'nike',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }

    // Scrape directly from grid - more reliable for Nike
    async scrapeFromGrid(page) {
        const allItems = [];
        
        for (const saleUrl of this.saleUrls) {
            try {
                logger.info(`${this.name}: Scraping grid from ${saleUrl}`);
                
                await page.goto(saleUrl, { waitUntil: 'networkidle', timeout: 60000 });
                
                // Handle cookies
                try {
                    const cookieBtn = await page.$('#hf_cookie_text_modal_accept, button:has-text("Accepter")');
                    if (cookieBtn) {
                        await cookieBtn.click();
                        await this.randomDelay(1000, 2000);
                    }
                } catch (e) {}
                
                await this.randomDelay(3000, 5000);
                await this.scrollToLoadProducts(page);

                const items = await page.evaluate(() => {
                    const products = [];
                    
                    // Nike product card selectors
                    const cardSelectors = [
                        '[data-testid="product-card"]',
                        '.product-card',
                        '[class*="product-card"]',
                        'article[class*="product"]'
                    ];
                    
                    let cards = [];
                    for (const sel of cardSelectors) {
                        cards = document.querySelectorAll(sel);
                        if (cards.length > 0) break;
                    }
                    
                    cards.forEach(card => {
                        try {
                            // Name
                            const nameEl = card.querySelector('[class*="product-card__title"], [data-testid*="title"], h3, h2, [class*="ProductCard__Title"]');
                            const name = nameEl?.textContent?.trim();
                            
                            // Prices - look for all price-like elements
                            let currentPrice = null;
                            let originalPrice = null;
                            let discount = null;
                            
                            // Try multiple selectors for prices
                            const priceSelectors = [
                                '[class*="product-price"]',
                                '[data-testid*="price"]',
                                '[class*="Price"]',
                                '.price-wrapper',
                                '[class*="price"]'
                            ];
                            
                            for (const sel of priceSelectors) {
                                const priceContainer = card.querySelector(sel);
                                if (priceContainer) {
                                    const priceText = priceContainer.textContent;
                                    const prices = priceText.match(/[\d.,]+\s*€/g);
                                    if (prices && prices.length >= 2) {
                                        // First price is usually current, second is original
                                        currentPrice = prices[0];
                                        originalPrice = prices[1];
                                        break;
                                    } else if (prices && prices.length === 1) {
                                        currentPrice = prices[0];
                                    }
                                }
                            }
                            
                            // Look for separate original price element (strikethrough)
                            if (!originalPrice) {
                                const origEl = card.querySelector('del, [class*="line-through"], [class*="was-price"], [class*="original"]');
                                if (origEl) {
                                    const match = origEl.textContent.match(/[\d.,]+\s*€/);
                                    if (match) originalPrice = match[0];
                                }
                            }
                            
                            // Look for discount badge
                            const discountEl = card.querySelector('[class*="discount"], [class*="badge"], [class*="promo"]');
                            if (discountEl) {
                                const discMatch = discountEl.textContent.match(/-?\d+\s*%/);
                                if (discMatch) {
                                    discount = parseInt(discMatch[0].replace(/[^\d]/g, ''));
                                }
                            }
                            
                            // Calculate discount if we have both prices
                            if (!discount && originalPrice && currentPrice) {
                                const orig = parseFloat(originalPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
                                const curr = parseFloat(currentPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
                                if (orig > curr && orig > 0) {
                                    discount = Math.round((1 - curr / orig) * 100);
                                }
                            }
                            
                            // Image - get highest quality
                            let image = null;
                            const imgEl = card.querySelector('img[src*="nike"], img');
                            if (imgEl) {
                                // Try to get src first, then data-src
                                image = imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('srcset')?.split(' ')[0];
                                
                                // Clean up the image URL - prefer high-res versions
                                if (image && image.includes('nike.com')) {
                                    // Remove query params and use t_PDP_1728 for better quality
                                    if (image.includes('t_PDP_')) {
                                        image = image.replace(/t_PDP_[^/]+/, 't_PDP_1728_v1');
                                    }
                                    // Ensure https
                                    if (image.startsWith('//')) {
                                        image = 'https:' + image;
                                    }
                                }
                            }
                            
                            // Link
                            const linkEl = card.querySelector('a[href*="/t/"]');
                            const link = linkEl?.href;
                            
                            if (name && name.length > 2 && currentPrice) {
                                products.push({
                                    name,
                                    currentPrice,
                                    originalPrice,
                                    discount,
                                    image: image && !image.includes('data:') ? image : null,
                                    link,
                                    brand: 'Nike',
                                    category: 'fashion'
                                });
                            }
                        } catch (e) {}
                    });
                    
                    return products;
                });

                logger.info(`${this.name}: Found ${items.length} items from grid on ${saleUrl}`);
                allItems.push(...items);
                
                if (allItems.length >= this.maxItems) break;
                
            } catch (e) {
                logger.warn(`${this.name}: Grid scrape error on ${saleUrl}: ${e.message}`);
            }
        }

        // Deduplicate
        const unique = [...new Map(allItems.map(item => [item.name, item])).values()];
        
        // IMPORTANT: Filter only items WITH discount >= minDiscount
        const withDiscount = unique.filter(item => {
            const disc = item.discount || 0;
            return disc >= this.minDiscount;
        });
        
        logger.info(`${this.name}: Filtered ${unique.length} → ${withDiscount.length} items with discount >= ${this.minDiscount}%`);
        
        return withDiscount.slice(0, this.maxItems).map(item => this.formatDeal(item)).filter(item => item.name);
    }

    // Override main scrape to use grid method (more reliable for Nike)
    async scrape(url = null) {
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            // Use grid scraping for Nike (more reliable)
            const items = await this.scrapeFromGrid(page);
            
            await page.close();
            await this.closeBrowser();
            
            logger.info(`${this.name}: Total ${items.length} items from grid`);

            return {
                success: items.length > 0,
                store: this.name,
                source: 'nike',
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

module.exports = NikeAdapter;
