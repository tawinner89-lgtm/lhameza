/**
 * L'HAMZA F SEL'A - Adidas Adapter
 * 
 * Scrapes sports fashion from Adidas with scroll-based loading
 * Category: Fashion/Sports
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class AdidasAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'Adidas',
            baseUrl: 'https://www.adidas.co.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'fashion',
            emoji: '👟',
            minDiscount: 10,
            maxItems: 500, // Increased for pagination
            timeout: 90000
        });

        // Adidas Morocco - Sale pages (correct URLs)
        this.saleUrls = [
            'https://www.adidas.co.ma/fr/men-sale',
            'https://www.adidas.co.ma/fr/women-sale',
            'https://www.adidas.co.ma/fr/kids-sale'
        ];
        
        // MANUAL MODE: Let user browse first page, then auto-paginate
        this.manualMode = true;
        this.manualWaitTime = 45000; // Wait 45 seconds for user to scroll first page
        
        // Pagination settings
        this.pageSize = 48; // Products per page
        this.maxPages = 10; // Max pages to scrape (10 x 48 = 480 products max)
    }

    // Override to use visible browser and stealth
    async initBrowser() {
        if (this.browser) return;

        const { chromium } = require('playwright-extra');
        const stealth = require('puppeteer-extra-plugin-stealth')();
        chromium.use(stealth);
        
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

        logger.info(`${this.name}: Browser initialized (stealth mode)`);
    }

    // Adidas uses infinite scroll with "Load More" button
    async loadAllProducts(page) {
        let loadMoreCount = 0;
        const maxLoads = 10;

        // First scroll to trigger lazy loading
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy({ top: 800, behavior: 'smooth' }));
            await this.randomDelay(800, 1500);
        }

        // Look for load more button
        while (loadMoreCount < maxLoads) {
            const loadMoreBtn = await page.$('button[data-auto-id="pagination-load-more"], .load-more-btn, [class*="load-more"]');
            
            if (!loadMoreBtn) {
                // Try scrolling to trigger more loading
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await this.randomDelay(2000, 3000);
                
                const newBtn = await page.$('button[data-auto-id="pagination-load-more"], .load-more-btn');
                if (!newBtn) break;
            }

            try {
                await loadMoreBtn.click();
                await this.randomDelay(2000, 4000);
                loadMoreCount++;
                
                const itemCount = await page.evaluate(() => 
                    document.querySelectorAll('[data-auto-id="glass-product-card"], .product-card, .plp-grid__column').length
                );
                logger.info(`${this.name}: Load more ${loadMoreCount}/${maxLoads} - Found ${itemCount} items`);
            } catch (e) {
                break;
            }
        }

        // Final scroll
        await this.scrollPage(page, 5);
    }

    // Extract products from current page - IMPROVED for Adidas Morocco 2024+
    async extractProducts(page) {
        return await page.evaluate(() => {
            const products = [];
            
            // Helper to extract numeric price from text
            const parsePrice = (text) => {
                if (!text) return null;
                // Remove "MAD", spaces, and parse number
                const cleaned = text.replace(/MAD/gi, '').replace(/\s+/g, '').replace(',', '.');
                const num = parseFloat(cleaned);
                return isNaN(num) ? null : num;
            };
            
            // Multiple selectors for Adidas cards (structure can vary)
            const cardSelectors = [
                'div.product[data-pid]',
                '[data-auto-id="glass-product-card"]',
                '.product-card',
                '.plp-grid__column > div',
                'article[class*="product"]'
            ];
            
            let cards = [];
            for (const sel of cardSelectors) {
                cards = document.querySelectorAll(sel);
                if (cards.length > 0) break;
            }
            
            cards.forEach(card => {
                try {
                    const pid = card.getAttribute('data-pid') || card.getAttribute('data-product-id') || '';
                    
                    // NAME - multiple selectors
                    const nameSelectors = ['.pdp-link a.link', '.product-name', 'h3', '[class*="product-title"]', '[class*="ProductCard-title"]', 'a.link'];
                    let name = '';
                    for (const sel of nameSelectors) {
                        const el = card.querySelector(sel);
                        if (el?.textContent?.trim()) {
                            name = el.textContent.trim();
                            break;
                        }
                    }
                    
                    // LINK - Get the REAL product page URL (not AJAX/quickview)
                    let link = '';
                    const linkEl = card.querySelector('a.link[href*="/fr/"], a[href*=".html"], a[href*="/product/"]');
                    if (linkEl?.href && linkEl.href.includes('.html')) {
                        link = linkEl.href;
                    } else {
                        // Construct URL from PID and name if we can't find direct link
                        // Format: https://www.adidas.co.ma/fr/product-name-slug/PID.html
                        if (pid) {
                            // Create a slug from name
                            const slug = (name || 'product')
                                .toLowerCase()
                                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/-+/g, '-')
                                .replace(/^-|-$/g, '')
                                .slice(0, 50);
                            link = `https://www.adidas.co.ma/fr/${slug}/${pid}.html`;
                        }
                    }
                    
                    // IMAGE - multiple selectors
                    const imgSelectors = ['img.tile-image', 'img[class*="product"]', 'picture img', 'img'];
                    let image = '';
                    for (const sel of imgSelectors) {
                        const el = card.querySelector(sel);
                        if (el?.src && !el.src.includes('data:')) {
                            image = el.src;
                            break;
                        } else if (el?.getAttribute('data-src')) {
                            image = el.getAttribute('data-src');
                            break;
                        }
                    }
                    
                    // DISCOUNT BADGE
                    const discountSelectors = ['.percentageoff span', '.badge-discount', '[class*="discount"]', '[class*="badge"]'];
                    let discountBadge = '';
                    for (const sel of discountSelectors) {
                        const el = card.querySelector(sel);
                        if (el?.textContent?.includes('%')) {
                            discountBadge = el.textContent.trim();
                            break;
                        }
                    }
                    
                    // PRICES - More robust extraction
                    let currentPrice = null;
                    let originalPrice = null;
                    
                    // Try to find specific price elements first
                    const salePriceSelectors = ['.sales .value', '.sale-price', '[class*="gl-price-item--sale"]', '[class*="sale"] .value', '.price-sales'];
                    const origPriceSelectors = ['.strike-through .value', 'del', 's', '[class*="crossed"]', '[class*="original"]', '.price-standard'];
                    
                    // Current/Sale price
                    for (const sel of salePriceSelectors) {
                        const el = card.querySelector(sel);
                        if (el?.textContent) {
                            currentPrice = parsePrice(el.textContent);
                            if (currentPrice) break;
                        }
                    }
                    
                    // Original price
                    for (const sel of origPriceSelectors) {
                        const el = card.querySelector(sel);
                        if (el?.textContent) {
                            originalPrice = parsePrice(el.textContent);
                            if (originalPrice) break;
                        }
                    }
                    
                    // Fallback: Get all prices from price container
                    if (!currentPrice) {
                        const priceContainer = card.querySelector('.price, [class*="price"]');
                        if (priceContainer) {
                            const priceText = priceContainer.textContent || '';
                            // Extract all numbers that look like prices (3-5 digits)
                            const priceMatches = priceText.match(/[\d\s,.]+/g);
                            if (priceMatches) {
                                const prices = priceMatches
                                    .map(p => parsePrice(p))
                                    .filter(p => p && p >= 100 && p <= 10000) // Valid price range for Adidas MAD
                                    .sort((a, b) => a - b); // Sort ascending
                                
                                if (prices.length >= 2) {
                                    currentPrice = prices[0]; // Lower price = sale price
                                    originalPrice = prices[prices.length - 1]; // Higher price = original
                                } else if (prices.length === 1) {
                                    currentPrice = prices[0];
                                }
                            }
                        }
                    }
                    
                    // Calculate discount if we have both prices
                    let discount = null;
                    if (discountBadge) {
                        const match = discountBadge.match(/-?(\d+)\s*%/);
                        if (match) discount = parseInt(match[1]);
                    }
                    if (!discount && originalPrice && currentPrice && originalPrice > currentPrice) {
                        discount = Math.round((1 - currentPrice / originalPrice) * 100);
                    }
                    
                    // Only add if we have valid data
                    if (name && name.length > 3 && currentPrice && currentPrice > 0) {
                        products.push({
                            name,
                            currentPrice: currentPrice.toString(),
                            originalPrice: originalPrice ? originalPrice.toString() : '',
                            discountBadge,
                            discount,
                            image,
                            link,
                            pid
                        });
                    }
                } catch (e) {
                    // Skip this card on error
                }
            });
            
            return products;
        });
    }

    async scrape(url = null) {
        const baseUrl = url || this.saleUrls[0];
        const allItems = [];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            // ===== PAGE 1: Manual Mode =====
            logger.info(`${this.name}: 📄 Page 1/${this.maxPages} - Manual mode`);
            logger.info(`${this.name}: Scraping`, { url: baseUrl });
            
            await page.goto(baseUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: this.timeout 
            });
            
            await this.handleCookieConsent(page);
            
            // Manual mode for first page
            logger.info(`${this.name}: 🖐️ MANUAL MODE - Browser is open!`);
            logger.info(`${this.name}: 👆 Please scroll down to load ALL products on this page...`);
            logger.info(`${this.name}: ⏰ Waiting ${this.manualWaitTime / 1000} seconds...`);
            
            await new Promise(resolve => setTimeout(resolve, this.manualWaitTime));
            
            logger.info(`${this.name}: ✅ Capturing page 1 products...`);
            
            // Extract from first page
            const page1Items = await this.extractProducts(page);
            allItems.push(...page1Items);
            logger.info(`${this.name}: 📦 Page 1: Found ${page1Items.length} items`);
            
            // ===== PAGES 2+: Auto Pagination =====
            if (page1Items.length >= this.pageSize * 0.8) { // If page 1 is mostly full, there are more pages
                logger.info(`${this.name}: 🔄 Starting auto-pagination...`);
                
                for (let pageNum = 2; pageNum <= this.maxPages; pageNum++) {
                    const start = (pageNum - 1) * this.pageSize;
                    const pageUrl = `${baseUrl}?start=${start}&sz=${this.pageSize}`;
                    
                    logger.info(`${this.name}: 📄 Page ${pageNum}/${this.maxPages}`, { url: pageUrl });
                    
                    try {
                        await page.goto(pageUrl, { 
                            waitUntil: 'domcontentloaded', 
                            timeout: this.timeout 
                        });
                        
                        // Wait for products to load
                        await this.randomDelay(3000, 5000);
                        
                        // Scroll to load lazy images
                        for (let i = 0; i < 3; i++) {
                            await page.evaluate(() => window.scrollBy({ top: 800, behavior: 'smooth' }));
                            await this.randomDelay(500, 1000);
                        }
                        
                        const pageItems = await this.extractProducts(page);
                        
                        if (pageItems.length === 0) {
                            logger.info(`${this.name}: ⏹️ No more products found. Stopping pagination.`);
                            break;
                        }
                        
                        allItems.push(...pageItems);
                        logger.info(`${this.name}: 📦 Page ${pageNum}: Found ${pageItems.length} items (Total: ${allItems.length})`);
                        
                        // Random delay between pages
                        await this.randomDelay(2000, 4000);
                        
                    } catch (e) {
                        logger.warn(`${this.name}: Error on page ${pageNum}: ${e.message}`);
                        break;
                    }
                }
            }

            await page.close();
            await this.closeBrowser();
            
            // Filter out null/invalid items first
            const validItems = allItems.filter(item => item && item.name && item.name.length > 2 && item.currentPrice);
            
            logger.info(`${this.name}: Valid items with price: ${validItems.length}`);
            
            // Deduplicate by name
            const uniqueItems = [...new Map(validItems.map(item => [item.name, item])).values()];
            
            logger.info(`${this.name}: After deduplication: ${uniqueItems.length}`);
            
            // Format items
            const items = uniqueItems
                .slice(0, this.maxItems)
                .map(item => {
                    try {
                        return this.formatDeal({
                            ...item,
                            brand: 'Adidas',
                            category: 'fashion'
                        });
                    } catch (e) {
                        logger.warn(`${this.name}: Error formatting item: ${e.message}`);
                        return null;
                    }
                })
                .filter(item => item && item.name && item.price);
            
            // Filter only items with discount >= minDiscount
            const withDiscount = items.filter(item => (item.discount || 0) >= this.minDiscount);
            
            logger.info(`${this.name}: Total ${items.length} items, ${withDiscount.length} with discount >= ${this.minDiscount}%`);
            
            return {
                success: withDiscount.length > 0,
                store: this.name,
                source: 'adidas',
                itemCount: withDiscount.length,
                items: withDiscount
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }
}

module.exports = AdidasAdapter;
