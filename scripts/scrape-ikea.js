/**
 * L'HAMZA F SEL'A - IKEA Morocco Scraper 🛋️
 * Scrapes home & furniture deals from IKEA Morocco
 *
 * Usage: node scripts/scrape-ikea.js [--minDiscount N]
 */

require('dotenv').config();
const IKEAAdapter = require('../src/adapters/IKEAAdapter');
const supabaseService = require('../src/services/supabase.service');

const args = process.argv.slice(2);
const getArg = (name, def) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
};
const MIN_DISCOUNT = parseInt(getArg('minDiscount', '10'));

async function saveItems(items, totalStats) {
    for (const item of items) {
        item.category = 'home';
        const saveResult = await supabaseService.addDeal(item);
        if (saveResult.added) totalStats.added++;
        else if (saveResult.updated) totalStats.updated++;
    }
}

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║   🛋️  L\'HAMZA F SEL\'A - IKEA Morocco Scraper                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const totalStats = { added: 0, updated: 0 };

    try {
        await supabaseService.initialize();
        console.log('✅ Database connected\n');

        const adapter = new IKEAAdapter();

        console.log('📦 IKEA MOROCCO');
        console.log('═'.repeat(60) + '\n');

        const result = await adapter.scrapeWithRetry();

        if (!result.success || !result.items || result.items.length === 0) {
            console.log('   ⚠️  No items found');
        } else {
            const validDeals = result.items.filter(
                item => item.discount != null && item.discount >= MIN_DISCOUNT
            );

            console.log(`   ✅ Found ${result.items.length} items (${validDeals.length} with valid discounts ≥${MIN_DISCOUNT}%)`);

            if (validDeals.length > 0) {
                // Log sample deals
                validDeals.slice(0, 5).forEach(d => {
                    const was = d.originalPrice ? ` (was ${d.originalPrice} MAD)` : '';
                    console.log(`   → ${d.name?.slice(0, 50)} — ${d.price} MAD${was} -${d.discount}%`);
                });
                await saveItems(validDeals, totalStats);
            }
        }

        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║   📊 SCRAPING COMPLETE                                         ║');
        console.log('╠════════════════════════════════════════════════════════════════╣');
        console.log(`║   ✅ New deals:     ${totalStats.added.toString().padStart(4)}                                       ║`);
        console.log(`║   🔄 Updated:       ${totalStats.updated.toString().padStart(4)}                                       ║`);
        console.log(`║   📦 Total:         ${(totalStats.added + totalStats.updated).toString().padStart(4)}                                       ║`);
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

main();
