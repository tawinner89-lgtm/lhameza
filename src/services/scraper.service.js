/**
 * Scraper Service
 * Manages scraping operations with PARALLEL execution
 * Uses Queue Service for 4x parallel scraping
 * Saves to Supabase cloud database
 */

const logger = require('../utils/logger');
const supabaseService = require('./supabase.service');
const { queueService, PRIORITY } = require('./queue.service');

class ScraperService {
    constructor() {
        this.lastRun = null;
        this.runHistory = [];
    }

    /**
     * Initialize the service
     */
    async initialize() {
        await supabaseService.initialize();
        logger.info('🚀 Scraper Service initialized with parallel queue (concurrency: 4)');
    }

    /**
     * Get scraper status (includes queue status)
     */
    getStatus() {
        const queueStatus = queueService.getStatus();
        return {
            queue: queueStatus,
            lastRun: this.lastRun,
            recentRuns: this.runHistory.slice(-10)
        };
    }

    /**
     * Run a specific adapter (adds to queue)
     * @param {string} adapterName - Name of adapter
     * @param {object} options - Options including priority
     */
    async runAdapter(adapterName, options = {}) {
        const { createAdapter, ADAPTERS_CONFIG } = require('../adapters');
        
        if (!ADAPTERS_CONFIG[adapterName]) {
            throw new Error(`Unknown adapter: ${adapterName}`);
        }

        // Make sure Supabase is initialized
        await supabaseService.initialize();

        const adapter = createAdapter(adapterName);
        
        // Add to queue - will run in parallel with other jobs
        const job = queueService.addJob(adapter, {
            priority: options.priority,
            maxRetries: options.maxRetries || 3
        });

        logger.info(`📥 Adapter queued: ${adapterName}`, { 
            jobId: job.id,
            priority: job.priority,
            queueLength: queueService.queue.length
        });

        return {
            queued: true,
            jobId: job.id,
            adapter: adapterName,
            priority: job.priority,
            queuePosition: queueService.queue.length
        };
    }

    /**
     * Run a specific adapter and wait for result (blocking)
     */
    async runAdapterSync(adapterName) {
        const { createAdapter, ADAPTERS_CONFIG } = require('../adapters');
        
        if (!ADAPTERS_CONFIG[adapterName]) {
            throw new Error(`Unknown adapter: ${adapterName}`);
        }

        await supabaseService.initialize();
        
        const adapter = createAdapter(adapterName);
        const startTime = Date.now();

        try {
            logger.info(`🔄 Running adapter sync: ${adapterName}`);
            const result = await adapter.scrapeWithRetry();
            
            let added = 0;
            let updated = 0;
            
            if (result.success && result.items?.length > 0) {
                // Filter: only save deals with a real discount (>= 10% and <= 85%)
                // Discounts > 85% are almost always a scraping error (e.g. discount badge
                // number being picked up as the sale price).
                const suspiciousItems = result.items.filter(
                    item => item.discount != null && item.discount > 85
                );
                for (const item of suspiciousItems) {
                    logger.warn(`⚠️ SUSPICIOUS PRICE SKIPPED — discount=${item.discount}% name="${item.name}" price=${item.price} original=${item.originalPrice} source=${item.source}`);
                }

                const validItems = result.items.filter(
                    item => item.discount != null && item.discount >= 10 && item.discount <= 85
                );
                const skipped = result.items.length - validItems.length;
                if (skipped > 0) {
                    logger.info(`🚫 Skipped ${skipped} items (no/low discount <10% or suspicious >85%)`);
                }

                // Save to Supabase in batches — track newly added deals for Telegram
                const newlyAdded = [];
                const batchSize = 5;
                for (let i = 0; i < validItems.length; i += batchSize) {
                    const batch = validItems.slice(i, i + batchSize);
                    const results = await Promise.all(
                        batch.map(item => supabaseService.addDeal(item))
                    );
                    for (let j = 0; j < results.length; j++) {
                        const r = results[j];
                        if (r?.added) {
                            added++;
                            // Attach the Supabase id so the notifier can track it
                            newlyAdded.push({ ...batch[j], id: r.id });
                        }
                        if (r?.updated) updated++;
                    }
                }

                // Remove deals from this source that were NOT refreshed in this run
                // (scraped_at < startTime means they weren't touched = they're gone from the site)
                const runStart = new Date(startTime).toISOString();
                const actualSource = validItems[0]?.source || adapterName;
                await supabaseService.removeStaleDeals(actualSource, runStart);

                // Auto-post new deals with >= 40% discount to Telegram
                if (newlyAdded.length > 0) {
                    try {
                        const { notifyNewDeals } = require('./telegram-notifier');
                        const tg = await notifyNewDeals(newlyAdded);
                        if (tg.sent > 0) {
                            logger.info(`📱 Telegram: ${tg.sent} deal(s) posted to channel`);
                        }
                    } catch (tgErr) {
                        logger.warn(`📱 Telegram notifier error: ${tgErr.message}`);
                    }
                }
            }

            const duration = Date.now() - startTime;
            const runRecord = {
                adapter: adapterName,
                success: result.success,
                itemsFound: result.items?.length || 0,
                itemsAdded: added,
                itemsUpdated: updated,
                duration,
                timestamp: new Date().toISOString()
            };

            // Log to Supabase
            await supabaseService.logScrape({
                source: adapterName,
                category: ADAPTERS_CONFIG[adapterName]?.category,
                itemsFound: result.items?.length || 0,
                itemsAdded: added,
                itemsUpdated: updated,
                duration,
                success: result.success
            });

            this.runHistory.push(runRecord);
            this.lastRun = runRecord;
            
            logger.info(`✅ Adapter completed: ${adapterName}`, runRecord);
            return runRecord;

        } catch (error) {
            logger.error(`❌ Adapter failed: ${adapterName}`, { error: error.message });
            
            await supabaseService.logScrape({
                source: adapterName,
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            });
            
            throw error;
        }
    }

    /**
     * Run multiple adapters IN PARALLEL using queue
     * @param {string[]} adapterNames - Array of adapter names
     * @param {object} options - Options
     */
    async runAdaptersParallel(adapterNames, options = {}) {
        const { createAdapter, ADAPTERS_CONFIG } = require('../adapters');
        
        await supabaseService.initialize();
        
        const jobs = [];
        
        for (const name of adapterNames) {
            if (!ADAPTERS_CONFIG[name]) {
                logger.warn(`Unknown adapter skipped: ${name}`);
                continue;
            }
            
            const adapter = createAdapter(name);
            const job = queueService.addJob(adapter, options);
            jobs.push({ name, jobId: job.id });
        }

        logger.info(`📥 ${jobs.length} adapters queued for parallel execution`, {
            adapters: jobs.map(j => j.name),
            concurrency: queueService.concurrency
        });

        return {
            queued: jobs.length,
            jobs,
            queueStatus: queueService.getStatus()
        };
    }

    /**
     * Run ALL adapters in parallel
     */
    async runAllAdapters(options = {}) {
        const { ADAPTERS_CONFIG } = require('../adapters');
        const adapterNames = Object.keys(ADAPTERS_CONFIG);
        
        logger.info(`🚀 Starting ALL ${adapterNames.length} adapters in parallel mode`);
        
        return this.runAdaptersParallel(adapterNames, options);
    }

    /**
     * Run adapters by category
     */
    async runAdaptersByCategory(category, options = {}) {
        const { ADAPTERS_CONFIG } = require('../adapters');
        
        const adapterNames = Object.entries(ADAPTERS_CONFIG)
            .filter(([_, config]) => config.category === category)
            .map(([name]) => name);
        
        if (adapterNames.length === 0) {
            throw new Error(`No adapters found for category: ${category}`);
        }
        
        logger.info(`🚀 Starting ${adapterNames.length} ${category} adapters in parallel`);
        
        return this.runAdaptersParallel(adapterNames, options);
    }

    /**
     * Wait for all queued jobs to complete
     */
    async waitForAll() {
        logger.info('⏳ Waiting for all jobs to complete...');
        const results = await queueService.waitForAll();
        logger.info(`✅ All jobs completed: ${results.length} total`);
        return results;
    }

    /**
     * Get queue status
     */
    getQueueStatus() {
        return queueService.getStatus();
    }

    /**
     * Pause queue
     */
    pauseQueue() {
        queueService.pause();
        return { paused: true };
    }

    /**
     * Resume queue
     */
    resumeQueue() {
        queueService.resume();
        return { paused: false };
    }

    /**
     * Clear pending jobs
     */
    clearQueue() {
        queueService.clear();
        return { cleared: true };
    }

    /**
     * Set concurrency level (1-10)
     */
    setConcurrency(level) {
        return queueService.setConcurrency(level);
    }

    /**
     * Get available adapters
     */
    getAvailableAdapters() {
        const { ADAPTERS_CONFIG } = require('../adapters');
        const { ADAPTER_PRIORITIES } = require('./queue.service');
        
        return Object.entries(ADAPTERS_CONFIG).map(([key, config]) => ({
            name: key,
            category: config.category,
            country: config.country,
            emoji: config.emoji,
            priority: ADAPTER_PRIORITIES[key] ?? PRIORITY.NORMAL
        }));
    }
}

// Export singleton instance
module.exports = new ScraperService();
