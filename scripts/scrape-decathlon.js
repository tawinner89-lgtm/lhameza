#!/usr/bin/env node
/**
 * L'HAMZA F SEL'A - Decathlon Morocco Scraper
 * Scrapes https://www.decathlon.ma/5080-promotions
 *
 * Usage:
 *   node scripts/scrape-decathlon.js
 *   node scripts/scrape-decathlon.js --all      # scrape all sale pages
 */

require('dotenv').config();
const scraperService = require('../src/services/scraper.service');

const runAll = process.argv.includes('--all');

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  ⚽ L\'HAMZA — Decathlon Morocco Scraper               ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    try {
        await scraperService.initialize();
        const result = await scraperService.runAdapterSync('decathlon');

        console.log('\n╔══════════════════════════════════════════════════════╗');
        console.log('║  📊 Results                                           ║');
        console.log('╠══════════════════════════════════════════════════════╣');
        console.log(`║  Found:   ${String(result.itemsFound).padEnd(42)}║`);
        console.log(`║  New:     ${String(result.itemsAdded).padEnd(42)}║`);
        console.log(`║  Updated: ${String(result.itemsUpdated).padEnd(42)}║`);
        console.log(`║  Status:  ${String(result.success ? '✅ Success' : '❌ Failed').padEnd(42)}║`);
        console.log('╚══════════════════════════════════════════════════════╝\n');

        if (!result.success) console.warn('⚠️  Decathlon scraper completed with errors.');
        process.exit(0); // Always exit 0 so the bat pipeline continues
    } catch (err) {
        console.error('❌ Fatal error:', err.message);
        process.exit(0); // Don't block the pipeline
    }
}

main();
