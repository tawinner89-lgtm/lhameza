/**
 * L'HAMZA F SEL'A - Base Adapter Class
 * 
 * Single, unified adapter base with:
 * - Circuit breaker pattern
 * - Retry with exponential backoff
 * - Rate limiting
 * - Metrics collection
 * - Human-like behavior
 */

const { chromium } = require('playwright');
const logger = require('../utils/logger');
const AdapterError = require('../utils/AdapterError');

// ==========================================
// User Agents Pool
// ==========================================
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

// ==========================================
// Circuit Breaker
// ==========================================
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 60000;
        this.failures = 0;
        this.lastFailure = null;
        this.state = 'CLOSED';
    }

    recordSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    recordFailure() {
        this.failures++;
        this.lastFailure = Date.now();
        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }

    canExecute() {
        if (this.state === 'CLOSED') return true;
        if (this.state === 'OPEN' && Date.now() - this.lastFailure >= this.resetTimeout) {
            this.state = 'HALF_OPEN';
            return true;
        }
        return this.state === 'HALF_OPEN';
    }
}

// ==========================================
// Base Adapter Class
// ==========================================
class BaseAdapter {
    constructor(config = {}) {
        // Basic config
        this.name = config.name || 'BaseAdapter';
        this.baseUrl = config.baseUrl || '';
        this.currency = config.currency || 'MAD';
        this.country = config.country || 'MA';
        this.category = config.category || 'general';
        this.emoji = config.emoji || '🛒';
        
        // Scraping config
        this.minDiscount = config.minDiscount || 0;
        this.maxItems = config.maxItems || 50;
        this.timeout = config.timeout || 60000;
        this.retries = config.retries || 3;
        this.minDelay = config.minDelay || 1000;
        this.maxDelay = config.maxDelay || 3000;
        
        // Browser state
        this.browser = null;
        this.context = null;
        this.proxyUrl = process.env.PROXY_URL || null;
        
        // Circuit breaker
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 3,
            resetTimeout: 5 * 60 * 1000
        });
        
        // Metrics
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalItems: 0,
            avgResponseTime: 0,
            lastRun: null
        };
    }

    // ==========================================
    // Browser Management
    // ==========================================

    getRandomUserAgent() {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    }

    async initBrowser(options = {}) {
        if (this.browser) return;

        const launchOptions = {
            headless: options.headless !== false,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        };

        if (this.proxyUrl) {
            launchOptions.proxy = { server: this.proxyUrl };
        }

        this.browser = await chromium.launch(launchOptions);
        
        this.context = await this.browser.newContext({
            userAgent: this.getRandomUserAgent(),
            viewport: { width: 1366, height: 768 },
            locale: 'fr-MA',
            timezoneId: 'Africa/Casablanca',
            geolocation: { latitude: 33.5731, longitude: -7.5898 },
            permissions: ['geolocation']
        });

        logger.info(`${this.name}: Browser initialized`);
    }

    async closeBrowser() {
        try {
            if (this.context) {
                await this.context.close();
                this.context = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            logger.info(`${this.name}: Browser closed`);
        } catch (error) {
            logger.warn(`${this.name}: Error closing browser`, { error: error.message });
        }
    }

    // ==========================================
    // Navigation & Helpers
    // ==========================================

    async randomDelay(min = null, max = null) {
        const minMs = min || this.minDelay;
        const maxMs = max || this.maxDelay;
        const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        await new Promise(r => setTimeout(r, delay));
    }

    async scrollPage(page, scrolls = 5) {
        for (let i = 0; i < scrolls; i++) {
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            await page.evaluate(() => window.scrollBy({ top: 600, behavior: 'smooth' }));
            await this.randomDelay(500, 1000);
            
            const newHeight = await page.evaluate(() => document.body.scrollHeight);
            if (newHeight === currentHeight) break;
        }
    }

    async handleCookieConsent(page) {
        const selectors = [
            '#onetrust-accept-btn-handler',
            'button[id*="accept"]',
            'button[class*="accept"]',
            'button:has-text("Accepter")',
            'button:has-text("Accept")',
            '.cookie-accept',
            '#cookie-accept'
        ];

        for (const selector of selectors) {
            try {
                const button = await page.$(selector);
                if (button) {
                    await button.click();
                    await this.randomDelay(500, 1000);
                    return true;
                }
            } catch (e) {
                continue;
            }
        }
        return false;
    }

    // ==========================================
    // Data Processing
    // ==========================================

    parsePrice(priceStr) {
        if (!priceStr) return null;
        const cleaned = priceStr.replace(/[^\d.,]/g, '').replace(',', '.');
        const price = parseFloat(cleaned);
        return isNaN(price) ? null : price;
    }

    extractDiscount(text) {
        if (!text) return null;
        const match = text.match(/-?(\d+)\s*%/);
        return match ? parseInt(match[1]) : null;
    }

    calculateDiscount(originalPrice, currentPrice) {
        if (!originalPrice || !currentPrice || originalPrice <= currentPrice) return null;
        return Math.round((1 - currentPrice / originalPrice) * 100);
    }

    generateId(item) {
        const str = `${this.name}-${item.name || ''}-${item.price || Date.now()}`;
        return Buffer.from(str).toString('base64').substring(0, 24);
    }

    formatDeal(rawItem) {
        const currentPrice = this.parsePrice(rawItem.currentPrice || rawItem.price);
        let originalPrice = this.parsePrice(rawItem.originalPrice);
        
        // Extract discount from badge or raw value
        let discount = rawItem.discount || this.extractDiscount(rawItem.discountBadge);
        
        // If we have discount but no original price, calculate it
        if (discount && currentPrice && !originalPrice) {
            // originalPrice = currentPrice / (1 - discount/100)
            originalPrice = Math.round(currentPrice / (1 - discount / 100));
        }
        
        // If we have original price but no discount, calculate it
        if (!discount && originalPrice && currentPrice && originalPrice > currentPrice) {
            discount = this.calculateDiscount(originalPrice, currentPrice);
        }

        if (!rawItem.name || rawItem.name.length < 3) return null;
        if (!currentPrice) return null;

        return {
            externalId: this.generateId(rawItem),
            brand: rawItem.brand || this.name,
            brandEmoji: this.emoji,
            name: rawItem.name,
            title: rawItem.name,
            price: currentPrice,
            originalPrice: originalPrice && originalPrice > currentPrice ? originalPrice : null,
            discount: discount,
            discountFormatted: discount ? `-${discount}%` : null,
            currency: this.currency,
            image: rawItem.image,
            link: rawItem.link,
            url: rawItem.link,
            source: this.name.toLowerCase().replace(/\s+/g, ''),
            category: rawItem.category || this.category,
            condition: rawItem.condition || 'new',
            inStock: rawItem.inStock !== false,
            location: rawItem.location || 'Morocco',
            rating: rawItem.rating || null,
            reviews: rawItem.reviews || null,
            scrapedAt: new Date().toISOString()
        };
    }

    // ==========================================
    // Scraping Methods
    // ==========================================

    async scrape(url = null) {
        throw new Error(`${this.name}: scrape() must be implemented`);
    }

    async scrapeWithRetry(url = null) {
        if (!this.circuitBreaker.canExecute()) {
            const error = new AdapterError('Circuit breaker is open', this.name);
            logger.warn(error.message, { adapter: this.name });
            return { success: false, error, items: [] };
        }

        this.metrics.lastRun = new Date().toISOString();
        let lastError = null;
        
        for (let attempt = 1; attempt <= this.retries; attempt++) {
            try {
                logger.info(`${this.name}: Scrape attempt ${attempt}/${this.retries}`);
                const start = Date.now();
                
                // We expect the concrete scrape() method to return the result directly
                // or throw an error on failure.
                const result = await this.scrape(url);
                
                this.circuitBreaker.recordSuccess();
                this.metrics.successfulRequests++;
                this.metrics.totalItems += result.items?.length || 0;
                this.metrics.avgResponseTime = Date.now() - start;
                return result;

            } catch (error) {
                // Standardize the error using our custom class
                lastError = (error instanceof AdapterError) 
                    ? error 
                    : new AdapterError(error.message, this.name, { stack: error.stack });
                
                this.metrics.failedRequests++;
                logger.warn(`${this.name}: Attempt ${attempt} failed`, { 
                    error: lastError.message, 
                    adapter: lastError.adapterName 
                });
            }

            if (attempt < this.retries) {
                const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
                await this.randomDelay(delay, delay + 1000);
            }
        }

        this.circuitBreaker.recordFailure();
        logger.error(`${this.name}: All attempts failed`, { 
            error: lastError.message, 
            adapter: this.name 
        });
        
        return { success: false, error: lastError, items: [] };
    }

    getMetrics() {
        return {
            ...this.metrics,
            circuitState: this.circuitBreaker.state,
            name: this.name
        };
    }

    getInfo() {
        return {
            name: this.name,
            baseUrl: this.baseUrl,
            category: this.category,
            currency: this.currency,
            emoji: this.emoji
        };
    }
}

module.exports = BaseAdapter;
