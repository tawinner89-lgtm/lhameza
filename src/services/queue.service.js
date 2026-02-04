/**
 * Queue Service
 * Manages scraping jobs with priority queue
 * OPTIMIZED: 4x parallel scraping with Supabase integration
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const supabaseService = require('./supabase.service');

/**
 * Job priorities - Important scrapers run first
 */
const PRIORITY = {
    CRITICAL: 0,  // Jumia, Marjane (high traffic sites)
    HIGH: 1,      // Fashion brands (Zara, H&M, etc.)
    NORMAL: 5,    // Regular scrapers
    LOW: 10       // Less important/slow scrapers
};

/**
 * Adapter priority mapping - smart scheduling
 */
const ADAPTER_PRIORITIES = {
    // Critical - Most popular sites in Morocco
    'jumia': PRIORITY.CRITICAL,
    'marjane': PRIORITY.CRITICAL,
    'electroplanet': PRIORITY.CRITICAL,
    
    // High - Fashion (frequent updates)
    'zara': PRIORITY.HIGH,
    'bershka': PRIORITY.HIGH,
    'pullbear': PRIORITY.HIGH,
    'lcwaikiki': PRIORITY.HIGH,
    'hmizate': PRIORITY.HIGH,
    
    // Normal
    'nike': PRIORITY.NORMAL,
    'adidas': PRIORITY.NORMAL,
    'decathlon': PRIORITY.NORMAL,
    'kitea': PRIORITY.NORMAL,
    'ultrapc': PRIORITY.NORMAL,
    'yvesrocher': PRIORITY.NORMAL,
    
    // Low - Slower or less important
    'bim': PRIORITY.LOW,
    'moteur': PRIORITY.LOW
};

/**
 * Scraping job
 */
class ScrapingJob {
    constructor(adapter, options = {}) {
        this.id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.adapter = adapter;
        this.adapterName = adapter.name || adapter.constructor?.name || 'unknown';
        // Auto-assign priority based on adapter name
        this.priority = options.priority ?? ADAPTER_PRIORITIES[this.adapterName.toLowerCase()] ?? PRIORITY.NORMAL;
        this.status = 'pending';
        this.createdAt = new Date();
        this.startedAt = null;
        this.completedAt = null;
        this.result = null;
        this.error = null;
        this.retries = 0;
        this.maxRetries = options.maxRetries || 3;
        this.itemsAdded = 0;
        this.itemsUpdated = 0;
    }

    get duration() {
        if (!this.startedAt) return 0;
        const end = this.completedAt || new Date();
        return end - this.startedAt;
    }

    toJSON() {
        return {
            id: this.id,
            adapter: this.adapterName,
            priority: this.priority,
            status: this.status,
            createdAt: this.createdAt.toISOString(),
            startedAt: this.startedAt?.toISOString(),
            completedAt: this.completedAt?.toISOString(),
            duration: this.duration,
            retries: this.retries,
            itemsFound: this.result?.items?.length || 0,
            itemsAdded: this.itemsAdded,
            itemsUpdated: this.itemsUpdated,
            error: this.error?.message
        };
    }
}

/**
 * Queue Service - Optimized for parallel scraping
 */
class QueueService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // 4 parallel scrapers for optimal performance
        this.concurrency = options.concurrency || 4;
        this.queue = [];
        this.activeJobs = new Map();
        this.completedJobs = [];
        this.maxCompletedHistory = options.maxHistory || 100;
        this.isProcessing = false;
        this.isPaused = false;
        this.stats = {
            totalProcessed: 0,
            totalItems: 0,
            totalDuration: 0,
            successRate: 0
        };
    }

    /**
     * Add job to queue
     * @param {Object} adapter - Adapter instance
     * @param {Object} options - Job options
     * @returns {ScrapingJob}
     */
    addJob(adapter, options = {}) {
        const job = new ScrapingJob(adapter, options);
        
        // Insert based on priority (lower number = higher priority)
        const insertIndex = this.queue.findIndex(j => j.priority > job.priority);
        if (insertIndex === -1) {
            this.queue.push(job);
        } else {
            this.queue.splice(insertIndex, 0, job);
        }
        
        logger.info('Job added to queue', { 
            jobId: job.id, 
            adapter: job.adapterName,
            queueLength: this.queue.length 
        });
        
        this.emit('jobAdded', job);
        this.processQueue();
        
        return job;
    }

    /**
     * Add multiple jobs
     * @param {Array} adapters 
     * @param {Object} options 
     * @returns {Array<ScrapingJob>}
     */
    addJobs(adapters, options = {}) {
        return adapters.map(adapter => this.addJob(adapter, options));
    }

    /**
     * Process queue
     */
    async processQueue() {
        if (this.isPaused || this.isProcessing) return;
        if (this.activeJobs.size >= this.concurrency) return;
        if (this.queue.length === 0) return;

        this.isProcessing = true;

        while (
            !this.isPaused && 
            this.activeJobs.size < this.concurrency && 
            this.queue.length > 0
        ) {
            const job = this.queue.shift();
            this.executeJob(job);
        }

        this.isProcessing = false;
    }

    /**
     * Execute a job - saves results to Supabase
     * @param {ScrapingJob} job 
     */
    async executeJob(job) {
        job.status = 'running';
        job.startedAt = new Date();
        this.activeJobs.set(job.id, job);
        
        this.emit('jobStarted', job);
        logger.info(`🚀 Job started [${this.activeJobs.size}/${this.concurrency} active]`, { 
            jobId: job.id, 
            adapter: job.adapterName,
            priority: job.priority
        });

        try {
            const result = await job.adapter.scrapeWithRetry();
            
            job.result = result;
            job.completedAt = new Date();
            
            if (result.success && result.items?.length > 0) {
                // Save items to Supabase in parallel batches
                const saveResults = await this.saveItemsToSupabase(result.items, job.adapterName);
                job.itemsAdded = saveResults.added;
                job.itemsUpdated = saveResults.updated;
                job.status = 'completed';
                
                this.emit('jobCompleted', job);
                logger.info(`✅ Job completed`, { 
                    jobId: job.id, 
                    adapter: job.adapterName,
                    itemsFound: result.items.length,
                    itemsAdded: job.itemsAdded,
                    itemsUpdated: job.itemsUpdated,
                    duration: `${(job.duration / 1000).toFixed(1)}s`
                });
                
                // Update stats
                this.stats.totalProcessed++;
                this.stats.totalItems += result.items.length;
                this.stats.totalDuration += job.duration;
            } else if (result.success) {
                job.status = 'completed';
                logger.info(`⚠️ Job completed but no items found`, { 
                    jobId: job.id, 
                    adapter: job.adapterName
                });
            } else {
                job.status = 'failed';
                this.emit('jobFailed', job);
                logger.warn(`❌ Job failed`, { 
                    jobId: job.id, 
                    adapter: job.adapterName,
                    error: result.error 
                });
            }
            
            // Log to Supabase
            await this.logJobToSupabase(job);
            
        } catch (error) {
            job.status = 'failed';
            job.error = error;
            job.completedAt = new Date();
            
            this.emit('jobFailed', job);
            logger.error(`💥 Job error`, { 
                jobId: job.id, 
                adapter: job.adapterName,
                error: error.message 
            });
            
            // Log error to Supabase
            await this.logJobToSupabase(job);
            
            // Retry logic with exponential backoff
            if (job.retries < job.maxRetries) {
                job.retries++;
                job.status = 'pending';
                
                // Exponential backoff delay
                const delay = Math.pow(2, job.retries) * 1000;
                setTimeout(() => {
                    this.queue.unshift(job);
                    this.processQueue();
                }, delay);
                
                logger.info(`🔄 Job queued for retry in ${delay/1000}s`, { 
                    jobId: job.id, 
                    retry: `${job.retries}/${job.maxRetries}`
                });
            }
        } finally {
            this.activeJobs.delete(job.id);
            this.completedJobs.push(job);
            
            // Trim history
            while (this.completedJobs.length > this.maxCompletedHistory) {
                this.completedJobs.shift();
            }
            
            // Update success rate
            const completed = this.completedJobs.filter(j => j.status === 'completed').length;
            this.stats.successRate = Math.round((completed / this.completedJobs.length) * 100);
            
            // Continue processing queue
            this.processQueue();
        }
    }

    /**
     * Save items to Supabase in optimized batches
     */
    async saveItemsToSupabase(items, source) {
        let added = 0;
        let updated = 0;
        
        // Process in parallel batches of 5
        const batchSize = 5;
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const results = await Promise.all(
                batch.map(item => supabaseService.addDeal({ ...item, source }))
            );
            
            for (const result of results) {
                if (result?.added) added++;
                if (result?.updated) updated++;
            }
        }
        
        return { added, updated };
    }

    /**
     * Log job result to Supabase
     */
    async logJobToSupabase(job) {
        try {
            await supabaseService.logScrape({
                source: job.adapterName,
                itemsFound: job.result?.items?.length || 0,
                itemsAdded: job.itemsAdded || 0,
                itemsUpdated: job.itemsUpdated || 0,
                duration: job.duration,
                success: job.status === 'completed',
                error: job.error?.message
            });
        } catch (err) {
            logger.warn('Failed to log job to Supabase', { error: err.message });
        }
    }

    /**
     * Pause queue processing
     */
    pause() {
        this.isPaused = true;
        this.emit('paused');
        logger.info('Queue paused');
    }

    /**
     * Resume queue processing
     */
    resume() {
        this.isPaused = false;
        this.emit('resumed');
        logger.info('Queue resumed');
        this.processQueue();
    }

    /**
     * Clear pending jobs
     */
    clear() {
        const count = this.queue.length;
        this.queue = [];
        this.emit('cleared', count);
        logger.info('Queue cleared', { jobsRemoved: count });
    }

    /**
     * Get queue status with detailed stats
     */
    getStatus() {
        const completed = this.completedJobs.filter(j => j.status === 'completed').length;
        const failed = this.completedJobs.filter(j => j.status === 'failed').length;
        
        return {
            isPaused: this.isPaused,
            pending: this.queue.length,
            active: this.activeJobs.size,
            activeJobs: Array.from(this.activeJobs.values()).map(j => j.adapterName),
            completed,
            failed,
            concurrency: this.concurrency,
            stats: {
                ...this.stats,
                avgDuration: this.stats.totalProcessed > 0 
                    ? Math.round(this.stats.totalDuration / this.stats.totalProcessed / 1000) 
                    : 0,
                avgItemsPerJob: this.stats.totalProcessed > 0 
                    ? Math.round(this.stats.totalItems / this.stats.totalProcessed) 
                    : 0
            }
        };
    }

    /**
     * Set concurrency level
     */
    setConcurrency(level) {
        this.concurrency = Math.max(1, Math.min(level, 10)); // Between 1-10
        logger.info(`Concurrency set to ${this.concurrency}`);
        this.processQueue(); // Start more jobs if possible
        return this.concurrency;
    }

    /**
     * Get job by ID
     * @param {string} jobId 
     */
    getJob(jobId) {
        // Check active jobs
        if (this.activeJobs.has(jobId)) {
            return this.activeJobs.get(jobId);
        }
        
        // Check pending jobs
        const pending = this.queue.find(j => j.id === jobId);
        if (pending) return pending;
        
        // Check completed jobs
        return this.completedJobs.find(j => j.id === jobId);
    }

    /**
     * Get all jobs
     */
    getAllJobs() {
        return {
            pending: this.queue.map(j => j.toJSON()),
            active: Array.from(this.activeJobs.values()).map(j => j.toJSON()),
            completed: this.completedJobs.map(j => j.toJSON())
        };
    }

    /**
     * Wait for all jobs to complete
     */
    async waitForAll() {
        return new Promise(resolve => {
            const checkComplete = () => {
                if (this.queue.length === 0 && this.activeJobs.size === 0) {
                    resolve(this.completedJobs);
                } else {
                    setTimeout(checkComplete, 1000);
                }
            };
            checkComplete();
        });
    }
}

// Export singleton and classes
const queueService = new QueueService({ concurrency: 4 });

module.exports = {
    QueueService,
    ScrapingJob,
    PRIORITY,
    ADAPTER_PRIORITIES,
    queueService
};
