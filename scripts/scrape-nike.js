/**
 * L'HAMZA F SEL'A - Nike Scraper 👟
 * Scrapes Nike deals from nike.com/fr (Morocco redirects to France)
 * 
 * Usage: node scripts/scrape-nike.js
 */

require('dotenv').config();
const NikeAdapter = require('../src/adapters/NikeAdapter');
const supabaseService = require('../src/services/supabase.service');

// Optional: override Nike start URL(s)
// Usage: node scripts/scrape-nike.js --url "https://www.nike.com/fr/w?q=sold&vst=sold"
const args = process.argv.slice(2);
const getArg = (name) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const overrideUrl = getArg('url');

async function scrapeNike() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   👟 L\'HAMZA F SEL\'A - Nike Scraper                            ║');
    console.log('║   Scraping: Nike France (Morocco prices)                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    const startTime = Date.now();
    let totalFound = 0;
    let totalAdded = 0;
    let totalUpdated = 0;

    try {
        // Initialize database
        await supabaseService.initialize();
        console.log('✅ Database connected\n');

        // Create Nike adapter
        const adapter = new NikeAdapter();

        // If user provided a URL, force NikeAdapter to use it (instead of promotions pages)
        if (overrideUrl) {
            adapter.saleUrls = [overrideUrl];
            console.log('🔗 Using custom Nike URL:');
            console.log(`   - ${overrideUrl}\n`);
        }
        
        console.log('🔍 Scraping Nike promotions...\n');
        console.log('   URLs:');
        (adapter.saleUrls || []).forEach(u => console.log(`   - ${u}`));
        console.log('');
        
        const result = await adapter.scrape();

        if (result.success && result.items?.length > 0) {
            // FILTER: Only items with discount >= 10%
            const MIN_DISCOUNT = 10;
            const itemsWithDiscount = result.items.filter(item => {
                const disc = item.discount || 0;
                return disc >= MIN_DISCOUNT;
            });
            
            console.log(`\n✅ Found ${result.items.length} Nike items`);
            console.log(`🔥 ${itemsWithDiscount.length} items with discount >= ${MIN_DISCOUNT}%\n`);
            
            if (itemsWithDiscount.length === 0) {
                console.log('⚠️ No items with sufficient discount found');
            }
            
            // Save to database - ONLY items with discount
            for (const item of itemsWithDiscount) {
                // Force category to fashion
                item.category = 'fashion';
                item.source = 'nike';
                
                try {
                    const saveResult = await supabaseService.addDeal(item);
                    if (saveResult.added) {
                        totalAdded++;
                        console.log(`   ✨ NEW: -${item.discount}% | ${item.title?.substring(0, 35)}...`);
                    } else if (saveResult.updated) {
                        totalUpdated++;
                    }
                } catch (e) {
                    // Skip duplicates
                }
            }
            
            totalFound = itemsWithDiscount.length;
        } else {
            console.log('⚠️ No items found or scrape failed');
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        }

    } catch (error) {
        console.error('\n💥 Fatal error:', error.message);
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    👟 NIKE SCRAPE COMPLETE                     ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║   📦 Total Found:   ${totalFound}`.padEnd(65) + '║');
    console.log(`║   ✨ New Deals:     ${totalAdded}`.padEnd(65) + '║');
    console.log(`║   🔄 Updated:       ${totalUpdated}`.padEnd(65) + '║');
    console.log(`║   ⏱️ Duration:      ${duration} minutes`.padEnd(65) + '║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    process.exit(0);
}

scrapeNike();
