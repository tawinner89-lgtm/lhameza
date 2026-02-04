/**
 * L'HAMZA F SEL'A - Adidas Scraper 👟
 * Scrapes Adidas deals from adidas.co.ma (Morocco)
 * 
 * Usage: node scripts/scrape-adidas.js
 */

require('dotenv').config();
const AdidasAdapter = require('../src/adapters/AdidasAdapter');
const supabaseService = require('../src/services/supabase.service');

const MIN_DISCOUNT = 10;

async function scrapeAdidas() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   👟 L\'HAMZA F SEL\'A - Adidas Morocco Scraper                  ║');
    console.log('║   Scraping: adidas.co.ma (Prix en MAD)                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    const startTime = Date.now();
    let totalFound = 0;
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    try {
        // Initialize database
        await supabaseService.initialize();
        console.log('✅ Database connected\n');

        // Create Adidas adapter
        const adapter = new AdidasAdapter();
        
        console.log('🔍 Scraping Adidas Morocco promotions...\n');
        console.log('   URLs:');
        console.log('   - adidas.co.ma/fr/men-sale');
        console.log('   - adidas.co.ma/fr/women-sale');
        console.log('   - adidas.co.ma/fr/kids-sale\n');
        
        const result = await adapter.scrape();

        if (result.success && result.items?.length > 0) {
            // FILTER: Only items with discount >= MIN_DISCOUNT
            const itemsWithDiscount = result.items.filter(item => {
                const disc = item.discount || 0;
                return disc >= MIN_DISCOUNT;
            });
            
            console.log(`\n✅ Found ${result.items.length} Adidas items`);
            console.log(`🔥 ${itemsWithDiscount.length} items with discount >= ${MIN_DISCOUNT}%\n`);
            
            if (itemsWithDiscount.length === 0) {
                console.log('⚠️ No items with sufficient discount found');
            }
            
            // Save to database - ONLY items with discount
            for (const item of itemsWithDiscount) {
                // Force category to fashion
                item.category = 'fashion';
                item.source = 'adidas';
                
                try {
                    const saveResult = await supabaseService.addDeal(item);
                    if (saveResult.added) {
                        totalAdded++;
                        console.log(`   ✨ NEW: -${item.discount}% | ${item.price} MAD | ${item.title?.substring(0, 30)}...`);
                    } else if (saveResult.updated) {
                        totalUpdated++;
                    }
                } catch (e) {
                    totalSkipped++;
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
    console.log('║                  👟 ADIDAS SCRAPE COMPLETE                     ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║   📦 Total avec solde: ${totalFound}`.padEnd(65) + '║');
    console.log(`║   ✨ Nouveaux deals:   ${totalAdded}`.padEnd(65) + '║');
    console.log(`║   🔄 Mis à jour:       ${totalUpdated}`.padEnd(65) + '║');
    console.log(`║   ⏱️ Durée:            ${duration} minutes`.padEnd(65) + '║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    process.exit(0);
}

scrapeAdidas();
