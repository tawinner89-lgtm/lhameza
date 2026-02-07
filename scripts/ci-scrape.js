#!/usr/bin/env node
/**
 * L'HAMZA F SEL'A - CI/CD Parallel Scraper
 * Optimized for GitHub Actions: runs adapters in parallel batches
 * 
 * Usage:
 *   node scripts/ci-scrape.js                    # All adapters
 *   node scripts/ci-scrape.js --category fashion # Only fashion
 *   node scripts/ci-scrape.js --adapters "jumia_tech,zara,nike"
 */

require('dotenv').config();
const scraperService = require('../src/services/scraper.service');

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name) => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
};

// ===========================
// ADAPTER GROUPS (by reliability on CI)
// ===========================

// Group 1: Reliable adapters (simple HTTP/DOM scraping, unlikely to be blocked)
const RELIABLE = [
    'jumia_tech',
    'jumia_fashion', 
    'jumia_home',
    'jumia_beauty',
    'jumia_brands',
    'electroplanet',
    'marjane',
    'kitea',
    'hmizate',
    'hmizate_beauty',
    'bim',
    'ultrapc',
    'hmall',
    'cosmetique',
    'yvesrocher',
];

// Group 2: Fashion brands (Playwright-heavy, may hit rate limits)
const FASHION_BRANDS = [
    'zara',
    'bershka',
    'pullbear',
    'lcwaikiki',
];

// Group 3: International brands (may block CI IPs)
const INTERNATIONAL = [
    'nike',
    'adidas',
    'decathlon',
];

// Category mapping
const CATEGORY_ADAPTERS = {
    tech: ['jumia_tech', 'electroplanet', 'ultrapc'],
    fashion: ['jumia_fashion', 'jumia_brands', 'zara', 'bershka', 'pullbear', 'lcwaikiki', 'nike', 'adidas'],
    home: ['jumia_home', 'marjane', 'kitea', 'bim'],
    beauty: ['jumia_beauty', 'hmizate_beauty', 'hmall', 'cosmetique', 'yvesrocher'],
    sports: ['decathlon'],
};

const ALL_ADAPTERS = [...RELIABLE, ...FASHION_BRANDS, ...INTERNATIONAL];

// ===========================
// PARALLEL EXECUTION ENGINE
// ===========================

const CONCURRENCY = 4; // Max parallel scrapers (GitHub Actions has 2 cores)

async function runBatch(adapterNames, batchLabel) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${batchLabel} (${adapterNames.length} adapters, ${CONCURRENCY} parallel)`);
    console.log(`${'═'.repeat(60)}`);

    const results = [];
    const queue = [...adapterNames];

    // Process in chunks of CONCURRENCY
    while (queue.length > 0) {
        const batch = queue.splice(0, CONCURRENCY);
        const batchPromises = batch.map(async (name) => {
            const start = Date.now();
            try {
                console.log(`  ▶️  Starting: ${name}`);
                const result = await scraperService.runAdapterSync(name);
                const duration = ((Date.now() - start) / 1000).toFixed(1);
                
                if (result.success) {
                    console.log(`  ✅ ${name}: ${result.itemsFound} found, ${result.itemsAdded} new (${duration}s)`);
                } else {
                    console.log(`  ⚠️  ${name}: Failed - ${result.error?.message || 'Unknown'} (${duration}s)`);
                }
                return { name, ...result, duration };
            } catch (error) {
                const duration = ((Date.now() - start) / 1000).toFixed(1);
                console.log(`  ❌ ${name}: Error - ${error.message} (${duration}s)`);
                return { name, success: false, error: error.message, itemsFound: 0, itemsAdded: 0, duration };
            }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' }));

        // Small delay between batches to be nice to servers
        if (queue.length > 0) {
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    return results;
}

// ===========================
// MAIN
// ===========================

async function main() {
    const startTime = Date.now();
    
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🔥 L\'HAMZA F SEL\'A - CI Parallel Scraper                    ║');
    console.log(`║  ${new Date().toISOString().padEnd(55)}   ║`);
    console.log(`║  Environment: ${process.env.CI ? 'GitHub Actions' : 'Local'}`.padEnd(63) + '║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    // Determine which adapters to run
    let adaptersToRun;
    const categoryArg = getArg('category');
    const adaptersArg = getArg('adapters');

    if (adaptersArg) {
        adaptersToRun = adaptersArg.split(',').map(s => s.trim());
        console.log(`\n📋 Running specific adapters: ${adaptersToRun.join(', ')}`);
    } else if (categoryArg && categoryArg !== 'all') {
        adaptersToRun = CATEGORY_ADAPTERS[categoryArg] || [];
        console.log(`\n📋 Running category "${categoryArg}": ${adaptersToRun.join(', ')}`);
    } else {
        adaptersToRun = ALL_ADAPTERS;
        console.log(`\n📋 Running ALL ${adaptersToRun.length} adapters`);
    }

    if (adaptersToRun.length === 0) {
        console.log('❌ No adapters to run!');
        process.exit(1);
    }

    // Initialize scraper service
    try {
        await scraperService.initialize();
    } catch (err) {
        console.error('❌ Failed to initialize scraper service:', err.message);
        process.exit(1);
    }

    // Split into groups based on what was requested
    const reliable = adaptersToRun.filter(a => RELIABLE.includes(a));
    const fashion = adaptersToRun.filter(a => FASHION_BRANDS.includes(a));
    const intl = adaptersToRun.filter(a => INTERNATIONAL.includes(a));
    // Anything else not in our groups
    const other = adaptersToRun.filter(a => !RELIABLE.includes(a) && !FASHION_BRANDS.includes(a) && !INTERNATIONAL.includes(a));

    const allResults = [];

    // Run groups sequentially, adapters within groups in parallel
    if (reliable.length > 0) {
        const results = await runBatch(reliable, '🟢 Group 1: Reliable Adapters');
        allResults.push(...results);
    }

    if (fashion.length > 0) {
        const results = await runBatch(fashion, '🟡 Group 2: Fashion Brands (Playwright)');
        allResults.push(...results);
    }

    if (intl.length > 0) {
        const results = await runBatch(intl, '🔴 Group 3: International Brands');
        allResults.push(...results);
    }

    if (other.length > 0) {
        const results = await runBatch(other, '⚪ Group 4: Other');
        allResults.push(...results);
    }

    // ===========================
    // SUMMARY
    // ===========================
    const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const successful = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;
    const totalFound = allResults.reduce((sum, r) => sum + (r.itemsFound || 0), 0);
    const totalAdded = allResults.reduce((sum, r) => sum + (r.itemsAdded || 0), 0);
    const totalUpdated = allResults.reduce((sum, r) => sum + (r.itemsUpdated || 0), 0);

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 SCRAPING SUMMARY                        ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  ✅ Successful: ${successful} / ${allResults.length} adapters`.padEnd(63) + '║');
    console.log(`║  ❌ Failed:     ${failed}`.padEnd(63) + '║');
    console.log(`║  📦 Found:      ${totalFound} deals`.padEnd(63) + '║');
    console.log(`║  ✨ New:        ${totalAdded} deals`.padEnd(63) + '║');
    console.log(`║  🔄 Updated:    ${totalUpdated} deals`.padEnd(63) + '║');
    console.log(`║  ⏱️  Duration:   ${totalDuration} minutes`.padEnd(63) + '║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    // Log failures for debugging
    const failures = allResults.filter(r => !r.success);
    if (failures.length > 0) {
        console.log('\n⚠️  Failed adapters:');
        failures.forEach(f => console.log(`   - ${f.name}: ${f.error}`));
    }

    // Exit with success even if some adapters fail (partial success is OK)
    const criticalFailRate = failed / allResults.length;
    process.exit(criticalFailRate > 0.7 ? 1 : 0);
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
