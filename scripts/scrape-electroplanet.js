#!/usr/bin/env node
/**
 * L'HAMZA F SEL'A - Electroplanet Morocco Scraper
 * Scrapes https://www.electroplanet.ma/depliant/depliant-electroplanet.html
 *         https://www.electroplanet.ma/promotions
 *
 * Usage:
 *   node scripts/scrape-electroplanet.js
 */

require('dotenv').config();
const scraperService = require('../src/services/scraper.service');

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  💻 L\'HAMZA — Electroplanet Morocco Scraper           ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    try {
        await scraperService.initialize();
        const result = await scraperService.runAdapterSync('electroplanet');

        console.log('\n╔══════════════════════════════════════════════════════╗');
        console.log('║  📊 Results                                           ║');
        console.log('╠══════════════════════════════════════════════════════╣');
        console.log(`║  Found:   ${String(result.itemsFound).padEnd(42)}║`);
        console.log(`║  New:     ${String(result.itemsAdded).padEnd(42)}║`);
        console.log(`║  Updated: ${String(result.itemsUpdated).padEnd(42)}║`);
        console.log(`║  Status:  ${String(result.success ? '✅ Success' : '❌ Failed').padEnd(42)}║`);
        console.log('╚══════════════════════════════════════════════════════╝\n');

        if (!result.success) console.warn('⚠️  Electroplanet scraper completed with errors.');
        process.exit(0); // Always exit 0 so the bat pipeline continues
    } catch (err) {
        console.error('❌ Fatal error:', err.message);
        process.exit(0); // Don't block the pipeline
    }
}

main();
