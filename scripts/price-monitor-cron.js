/**
 * Smart Price Monitor - Automated Scheduler
 * 
 * Runs the price monitor on a schedule using node-cron
 * Default: Every 2 hours
 * 
 * Usage: 
 *   npm run monitor        (runs continuously with cron)
 *   npm run monitor:once   (runs once and exits)
 * 
 * Environment Variables:
 *   CRON_SCHEDULE - Cron expression (default: "0 *\/2 * * *" = every 2 hours)
 *   MIN_PRICE_DROP_PERCENT - Minimum % drop to trigger alert (default: 10)
 */

require('dotenv').config();
const cron = require('node-cron');
const scraper = require('../src/scraper');
const telegram = require('../src/telegram');
const database = require('../src/database');
const logger = require('../src/logger');

// Configuration
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 */2 * * *'; // Every 2 hours
const MIN_PRICE_DROP_PERCENT = parseFloat(process.env.MIN_PRICE_DROP_PERCENT) || 10;
const TARGET_URL = process.env.TARGET_URL || 'https://www.amazon.com/s?k=laptop';

// Track run statistics
let runCount = 0;
let totalDealsFound = 0;
let lastRunTime = null;

/**
 * Main monitoring function
 */
async function runPriceMonitor() {
    runCount++;
    const startTime = new Date();
    
    console.log('\n' + '='.repeat(60));
    console.log(`🔍 PRICE MONITOR RUN #${runCount}`);
    console.log(`⏰ ${startTime.toISOString()}`);
    console.log('='.repeat(60) + '\n');

    try {
        // Initialize database if not already
        if (!database.initialized) {
            await database.initialize();
        }

        // Run scraper
        console.log('🌐 Scraping products...');
        const results = await scraper.scrape(TARGET_URL);

        if (!results.success || results.itemCount === 0) {
            console.log(`❌ Scraping failed: ${results.error || 'No items found'}`);
            logger.error('Scheduled scrape failed', { error: results.error });
            return;
        }

        console.log(`✅ Found ${results.itemCount} products`);

        // Process and analyze prices
        console.log('📊 Analyzing prices...');
        const priceAnalysis = await database.processScrapedItems(results.items);

        // Log results
        console.log(`\n📈 Results:`);
        console.log(`   New: ${priceAnalysis.summary.newProducts}`);
        console.log(`   Drops: ${priceAnalysis.summary.priceDrops}`);
        console.log(`   Updated: ${priceAnalysis.summary.updated}`);

        // Update stats
        totalDealsFound += priceAnalysis.summary.priceDrops;
        lastRunTime = startTime;

        // Save results
        await database.saveResults({
            ...results,
            priceAnalysis: priceAnalysis.summary,
            scheduledRun: true,
            runNumber: runCount
        });

        // Send notifications only if there are deals
        if (priceAnalysis.priceDrops.length > 0) {
            console.log(`\n🔥 ${priceAnalysis.priceDrops.length} DEAL(S) FOUND!`);
            
            for (const deal of priceAnalysis.priceDrops) {
                console.log(`   • ${deal.name?.substring(0, 40)}... - ${deal.priceInfo.priceChangePercent}% OFF`);
            }

            // Send Telegram alerts
            console.log('\n📱 Sending price drop alerts...');
            const alertResult = await telegram.sendPriceDropAlerts(priceAnalysis.priceDrops);
            console.log(`✅ Sent ${alertResult.sent} alert(s)`);
        } else {
            console.log('\n😴 No significant price drops this scan');
            // Optionally send a summary every 6 runs (12 hours)
            if (runCount % 6 === 0) {
                await telegram.sendMessage(
                    `📊 *12-Hour Status Update*\n\n` +
                    `✅ Monitor is running smoothly\n` +
                    `📦 Products tracked: ${(await database.getStats()).products.tracked}\n` +
                    `🔥 Deals found today: ${totalDealsFound}\n` +
                    `⏰ Next scan in 2 hours`
                );
            }
        }

        const duration = ((new Date() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ Completed in ${duration}s`);

    } catch (error) {
        console.error(`\n💥 Error: ${error.message}`);
        logger.error('Scheduled monitor error:', error);
        
        // Notify about errors
        await telegram.sendMessage(
            `⚠️ *Price Monitor Error*\n\n` +
            `Run #${runCount} failed\n` +
            `Error: \`${error.message}\`\n` +
            `Will retry on next schedule`
        );
    }
}

/**
 * Start the scheduled monitor
 */
async function startScheduler() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     🛒 SMART PRICE MONITOR - AUTOMATED SCHEDULER       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log(`📋 Configuration:`);
    console.log(`   Target URL: ${TARGET_URL}`);
    console.log(`   Schedule: ${CRON_SCHEDULE}`);
    console.log(`   Alert Threshold: ${MIN_PRICE_DROP_PERCENT}% drop`);
    console.log(`   Node-cron: Running\n`);

    // Validate cron expression
    if (!cron.validate(CRON_SCHEDULE)) {
        console.error('❌ Invalid cron expression:', CRON_SCHEDULE);
        process.exit(1);
    }

    // Initialize database
    await database.initialize();
    const stats = await database.getStats();
    console.log(`📊 Currently tracking ${stats.products.tracked} products\n`);

    // Send startup notification
    await telegram.sendMessage(
        `🚀 *Price Monitor Started*\n\n` +
        `📋 Schedule: Every 2 hours\n` +
        `📦 Tracking: ${stats.products.tracked} products\n` +
        `📉 Alert threshold: ${MIN_PRICE_DROP_PERCENT}% drop\n\n` +
        `_Monitoring has begun. You'll only receive alerts when real deals are found!_`
    );

    // Run immediately on startup
    console.log('🏃 Running initial scan...');
    await runPriceMonitor();

    // Schedule recurring runs
    console.log(`\n⏰ Scheduler active - next run based on: ${CRON_SCHEDULE}`);
    console.log('   Press Ctrl+C to stop\n');

    cron.schedule(CRON_SCHEDULE, async () => {
        await runPriceMonitor();
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Shutting down Price Monitor...');
        
        await telegram.sendMessage(
            `🛑 *Price Monitor Stopped*\n\n` +
            `📊 Total runs: ${runCount}\n` +
            `🔥 Deals found: ${totalDealsFound}\n` +
            `⏰ Stopped at: ${new Date().toISOString()}`
        );
        
        console.log('👋 Goodbye!');
        process.exit(0);
    });
}

// Check if running as "once" mode or continuous
const args = process.argv.slice(2);
if (args.includes('--once') || args.includes('-o')) {
    // Run once and exit
    console.log('🔍 Running single price check...\n');
    database.initialize()
        .then(() => runPriceMonitor())
        .then(() => {
            console.log('\n✅ Single run complete');
            process.exit(0);
        })
        .catch(err => {
            console.error('Error:', err);
            process.exit(1);
        });
} else {
    // Start continuous scheduler
    startScheduler().catch(err => {
        console.error('Failed to start scheduler:', err);
        process.exit(1);
    });
}
