/**
 * L'HAMZA F SEL'A - Scraper Manager
 * 
 * Manages concurrent scraping with p-limit
 * Controls CPU usage by limiting simultaneous scrapers
 */

const logger = require('../logger');

// Dynamic import for p-limit (ESM module)
let pLimit;

class ScraperManager {
    constructor(options = {}) {
        this.concurrency = options.concurrency || 3;
        this.adapters = new Map();
        this.results = new Map();
        this.limit = null;
        this.initialized = false;
    }

    // Initialize p-limit (async due to ESM)
    async init() {
        if (this.initialized) return;
        
        // Dynamic import for ESM module
        const pLimitModule = await import('p-limit');
        pLimit = pLimitModule.default;
        this.limit = pLimit(this.concurrency);
        this.initialized = true;
        
        logger.info('ScraperManager initialized', { concurrency: this.concurrency });
    }

    // Register an adapter
    registerAdapter(adapter) {
        const info = adapter.getInfo();
        this.adapters.set(info.name, adapter);
        logger.info(`Registered adapter: ${info.name}`, { category: info.category });
    }

    // Register multiple adapters
    registerAdapters(adapters) {
        for (const adapter of adapters) {
            this.registerAdapter(adapter);
        }
    }

    // Get all registered adapters
    getAdapters() {
        return Array.from(this.adapters.values());
    }

    // Get adapter by name
    getAdapter(name) {
        return this.adapters.get(name);
    }

    // Scrape single adapter with concurrency limit
    async scrapeAdapter(adapterName, url = null) {
        await this.init();
        
        const adapter = this.adapters.get(adapterName);
        if (!adapter) {
            const error = new Error(`Adapter not found: ${adapterName}`);
            logger.error(`Failed: ${adapterName}`, { error: error.message });
            return { success: false, error: error.message, items: [] };
        }

        return this.limit(async () => {
            logger.info(`Starting scrape: ${adapterName}`);
            const startTime = Date.now();
            
            try {
                // This call is now more resilient due to changes in BaseAdapter
                const result = await adapter.scrapeWithRetry(url);
                const duration = Date.now() - startTime;
                
                this.results.set(adapterName, {
                    ...result,
                    duration,
                    timestamp: new Date().toISOString()
                });

                if (result.success) {
                    logger.info(`Completed: ${adapterName}`, {
                        items: result.items?.length || 0,
                        duration: `${duration}ms`
                    });
                } else {
                    // Log the graceful failure captured by the adapter
                    logger.warn(`Failed gracefully: ${adapterName}`, {
                        error: result.error?.message,
                        duration: `${duration}ms`
                    });
                }

                return result;
            } catch (error) {
                // This block catches UNEXPECTED errors if scrapeWithRetry itself fails.
                const duration = Date.now() - startTime;
                logger.error(`CRITICAL FAILURE: ${adapterName}`, { 
                    error: error.message,
                    duration: `${duration}ms`,
                    stack: error.stack
                });
                return { success: false, error: `Critical failure: ${error.message}`, items: [] };
            }
        });
    }

    // Scrape multiple adapters with true resilience using Promise.allSettled
    async scrapeMultiple(adapterNames, urls = {}) {
        await this.init();
        
        const tasks = adapterNames.map(name => {
            const url = urls[name] || null;
            return this.scrapeAdapter(name, url);
        });

        // Promise.allSettled waits for all promises to resolve or reject.
        const results = await Promise.allSettled(tasks);
        
        const combined = {
            success: true, // The overall process succeeded, even if some adapters failed
            totalItems: 0,
            byAdapter: {},
            allItems: []
        };

        results.forEach((result, index) => {
            const adapterName = adapterNames[index];
            
            if (result.status === 'fulfilled') {
                const adapterResult = result.value;
                combined.byAdapter[adapterName] = {
                    success: adapterResult.success,
                    itemCount: adapterResult.items?.length || 0,
                    error: adapterResult.error ? adapterResult.error.message : null
                };
                if (adapterResult.success) {
                    combined.totalItems += adapterResult.items?.length || 0;
                    combined.allItems.push(...(adapterResult.items || []));
                }
            } else {
                // This happens if scrapeAdapter itself had a catastrophic, unhandled error
                logger.error(`CRITICAL MANAGER FAILURE: The promise for adapter ${adapterName} was rejected.`, {
                    reason: result.reason
                });
                combined.byAdapter[adapterName] = {
                    success: false,
                    itemCount: 0,
                    error: `Catastrophic failure: ${result.reason?.message || 'Unknown'}`
                };
            }
        });

        return combined;
    }

    // Scrape all registered adapters
    async scrapeAll() {
        const adapterNames = Array.from(this.adapters.keys());
        return this.scrapeMultiple(adapterNames);
    }

    // Scrape by category
    async scrapeByCategory(category) {
        const adapters = Array.from(this.adapters.entries())
            .filter(([_, adapter]) => adapter.category === category)
            .map(([name, _]) => name);

        if (adapters.length === 0) {
            logger.warn(`No adapters found for category: ${category}`);
            return { success: true, totalItems: 0, byAdapter: {}, allItems: [] };
        }

        return this.scrapeMultiple(adapters);
    }

    // Get scraping stats
    getStats() {
        const stats = {
            totalAdapters: this.adapters.size,
            concurrency: this.concurrency,
            adapters: []
        };

        for (const [name, adapter] of this.adapters) {
            const result = this.results.get(name);
            stats.adapters.push({
                name,
                ...adapter.getInfo(),
                lastResult: result ? {
                    success: result.success,
                    itemCount: result.items?.length || 0,
                    duration: result.duration,
                    timestamp: result.timestamp
                } : null
            });
        }

        return stats;
    }

    // Close all browsers
    async closeAll() {
        for (const adapter of this.adapters.values()) {
            try {
                await adapter.closeBrowser();
            } catch (e) {
                // Ignore close errors
            }
        }
        logger.info('All adapter browsers closed');
    }
}

// Singleton instance
const scraperManager = new ScraperManager({
    concurrency: parseInt(process.env.SCRAPER_CONCURRENCY) || 3
});

module.exports = {
    ScraperManager,
    scraperManager
};
