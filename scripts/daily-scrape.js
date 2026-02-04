/**
 * L'HAMZA F SEL'A - Daily Scraping Script
 * Run this twice a day from your PC to keep deals fresh!
 * 
 * Usage: node scripts/daily-scrape.js
 */

require('dotenv').config();
const scraperService = require('../src/services/scraper.service');
const logger = require('../src/utils/logger');

// Adapters to run (you can customize this list)
// Check src/adapters/index.js for available adapter names
const ADAPTERS_TO_RUN = [
    // Tech
    'jumia_tech',
    'electroplanet',
    
    // Fashion
    'jumia_fashion',
    'zara',
    
    // Home
    'marjane',
    
    // Sports
    'decathlon'
];

// Beauty/Makeup Adapters (run separately with: node scripts/scrape-beauty.js)
// 'jumia_beauty'   - Jumia Makeup
// 'yvesrocher'     - Yves Rocher
// 'hmall'          - Hmall.ma (Marjane Beauty) 💄 NEW!
// 'cosmetique'     - Cosmetique.ma 💋 NEW!

const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60 * 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / (60 * 1000)).toFixed(1)}min`;
};

async function runDailyScrape() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   🔥 L\'HAMZA F SEL\'A - Daily Scraping                          ║');
    console.log('║   Started at: ' + new Date().toLocaleString().padEnd(40) + '   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    const startTime = Date.now();
    const results = [];

    try {
        await scraperService.initialize();

        for (const adapterName of ADAPTERS_TO_RUN) {
            console.log(`\n▶️ Running: ${adapterName.toUpperCase()}`);
            console.log('─'.repeat(50));

            try {
                const result = await scraperService.runAdapterSync(adapterName);
                results.push(result);

                if (result.success) {
                    console.log(`✅ ${adapterName}: ${result.itemsFound} found, ${result.itemsAdded} added, ${result.itemsUpdated} updated`);
                } else {
                    console.log(`❌ ${adapterName}: Failed - ${result.error?.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.log(`❌ ${adapterName}: Error - ${error.message}`);
                results.push({ adapter: adapterName, success: false, error });
            }

            // Delay between adapters
            await new Promise(r => setTimeout(r, 5000));
        }

    } catch (error) {
        console.error('💥 Fatal error:', error.message);
    }

    // Summary
    const totalDuration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalItems = results.reduce((sum, r) => sum + (r.itemsFound || 0), 0);
    const totalAdded = results.reduce((sum, r) => sum + (r.itemsAdded || 0), 0);

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                       📊 SUMMARY                               ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║   ✅ Successful:  ${successful}/${results.length} adapters`.padEnd(65) + '║');
    console.log(`║   📦 Total Items: ${totalItems} found, ${totalAdded} new`.padEnd(65) + '║');
    console.log(`║   ⏱️ Duration:    ${formatDuration(totalDuration)}`.padEnd(65) + '║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    process.exit(failed > 0 ? 1 : 0);
}

runDailyScrape();
