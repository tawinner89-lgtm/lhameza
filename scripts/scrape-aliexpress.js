/**
 * L'HAMZA F SEL'A - AliExpress Scraper 🛒
 * Scrapes trending/discounted AliExpress products for Morocco
 * Prices converted USD → MAD automatically
 *
 * Usage: node scripts/scrape-aliexpress.js
 */

require('dotenv').config();
const AliExpressAdapter = require('../src/adapters/AliExpressAdapter');
const supabaseService = require('../src/services/supabase.service');

const MIN_DISCOUNT = 10;

async function saveItems(items, totalStats) {
    for (const item of items) {
        const saveResult = await supabaseService.addDeal(item);
        if (saveResult.added) {
            totalStats.added++;
        } else if (saveResult.updated) {
            totalStats.updated++;
        }
    }
}

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║   🛒 L\'HAMZA F SEL\'A - AliExpress Scraper                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const totalStats = { added: 0, updated: 0 };

    try {
        await supabaseService.initialize();
        console.log('✅ Database connected\n');

        const adapter = new AliExpressAdapter();

        console.log('📦 ALIEXPRESS');
        console.log('═'.repeat(60) + '\n');

        const result = await adapter.scrapeWithRetry();

        if (!result.success || !result.items || result.items.length === 0) {
            console.log('   ⚠️  No items found');
        } else {
            // Filter: only deals with >= 10% discount
            const validDeals = result.items.filter(
                item => item.discount != null && item.discount >= MIN_DISCOUNT
            );

            console.log(`   ✅ Found ${result.items.length} items (${validDeals.length} with valid discounts ≥${MIN_DISCOUNT}%)`);

            if (validDeals.length > 0) {
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
