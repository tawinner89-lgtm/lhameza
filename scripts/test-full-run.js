/**
 * TEST SCRIPT: FULL SYSTEM RUN
 * --------------------------------
 * This script performs a full, end-to-end test of the scraping system.
 *
 * It does the following:
 * 1. Initializes all required services (Scraper, Database, Queue).
 * 2. Queues ALL available adapters to run in parallel.
 * 3. Shows real-time progress of the job queue every 5 seconds.
 * 4. Waits for all scraping jobs to complete.
 * 5. Reports final aggregated statistics, including:
 *    - Total items found, added, and updated.
 *    - A summary of any errors encountered.
 *    - A detailed breakdown of results for each adapter.
 */

require('dotenv').config();
const scraperService = require('../src/services/scraper.service');
const logger = require('../src/utils/logger');

// --- Configuration ---
const PROGRESS_UPDATE_INTERVAL = 5000; // 5 seconds

/**
 * Formats a duration in milliseconds into a human-readable string.
 * @param {number} ms - Duration in milliseconds.
 * @returns {string}
 */
const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60 * 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / (60 * 1000)).toFixed(2)}min`;
};

async function main() {
    let progressInterval;
    logger.info('╔════════════════════════════════════════════════════════╗');
    logger.info('║           🔥 SCRAPER SYSTEM - FULL END-TO-END TEST           ║');
    logger.info('╚════════════════════════════════════════════════════════╝');

    try {
        // 1. Initialize services
        logger.info('▶ Initializing services (Supabase, Queue)...');
        await scraperService.initialize();
        logger.info('✅ Services initialized.');

        // 2. Run all adapters in parallel
        logger.info(`▶ Queuing all adapters for parallel execution (concurrency: ${scraperService.getQueueStatus().concurrency})...`);
        const { queued, jobs } = await scraperService.runAllAdapters();
        logger.info(`✅ ${queued} adapters have been added to the queue.`);

        // 3. Show real-time progress
        progressInterval = setInterval(() => {
            const status = scraperService.getQueueStatus();
            logger.info(
                `[PROGRESS] Pending: ${status.pending}, Active: ${status.active}, Completed: ${status.completed}, Failed: ${status.failed} | Total: ${status.total}`
            );
        }, PROGRESS_UPDATE_INTERVAL);

        // 4. Wait for all jobs to complete
        logger.info('⏳ Waiting for all scraping jobs to finish. This may take a while...');
        const results = await scraperService.waitForAll();
        clearInterval(progressInterval); // Stop the progress updates
        logger.info('🏁 All jobs have finished.');

        // 5. Report final statistics
        logger.info('\n' + '═'.repeat(60));
        logger.info('📊 FINAL TEST REPORT');
        logger.info('═'.repeat(60));

        const finalStats = {
            totalItemsFound: 0,
            totalItemsAdded: 0,
            totalItemsUpdated: 0,
            totalDurationMs: 0,
            successfulAdapters: 0,
            failedAdapters: 0,
        };

        const errorDetails = [];
        const successDetails = [];

        results.forEach(job => {
            finalStats.totalDurationMs += job.duration;

            if (job.status === 'completed') {
                finalStats.successfulAdapters++;
                const itemsFound = job.result?.items?.length || 0;
                finalStats.totalItemsFound += itemsFound;
                finalStats.totalItemsAdded += job.itemsAdded;
                finalStats.totalItemsUpdated += job.itemsUpdated;
                successDetails.push({
                    adapter: job.adapterName,
                    itemsFound: itemsFound,
                    itemsAdded: job.itemsAdded,
                    itemsUpdated: job.itemsUpdated,
                    duration: job.duration,
                });
            } else { // status is 'failed'
                finalStats.failedAdapters++;
                errorDetails.push({
                    adapter: job.adapterName,
                    error: job.error?.message || 'Unknown error',
                    duration: job.duration,
                });
            }
        });

        logger.info('--- AGGREGATE STATS ---');
        logger.info(`✅ Successful Adapters: ${finalStats.successfulAdapters}`);
        logger.info(`❌ Failed Adapters:     ${finalStats.failedAdapters}`);
        logger.info(`⏱️ Total Scrape Time:   ${formatDuration(finalStats.totalDurationMs)} (sum of all jobs)`);
        logger.info(`🔎 Items Found:         ${finalStats.totalItemsFound}`);
        logger.info(`➕ Items Added (New):   ${finalStats.totalItemsAdded}`);
        logger.info(`🔄 Items Updated:       ${finalStats.totalItemsUpdated}`);
        
        if (finalStats.failedAdapters > 0) {
            logger.error('\n--- ERROR DETAILS ---');
            errorDetails.forEach(err => {
                logger.error(`- ❌ FAILED | ${err.adapter.padEnd(20)} | ${err.error} | ${formatDuration(err.duration)}`);
            });
        }
        
        logger.info('\n--- DETAILED ADAPTER BREAKDOWN ---');
        successDetails.sort((a,b) => b.itemsFound - a.itemsFound).forEach(res => {
            logger.info(
                `- ✅ SUCCESS | ${res.adapter.padEnd(20)} | Found: ${res.itemsFound}, Added: ${res.itemsAdded}, Updated: ${res.itemsUpdated} | ${formatDuration(res.duration)}`
            );
        });
        
        logger.info('═'.repeat(60));

        if (finalStats.failedAdapters > 0) {
            logger.warn('⚠️ Test finished with errors.');
            process.exit(1);
        } else {
            logger.info('🎉 Test completed successfully!');
            process.exit(0);
        }

    } catch (error) {
        if (progressInterval) clearInterval(progressInterval);
        logger.error('💥 A fatal error occurred during the test run:', error);
        process.exit(1);
    }
}

main();
