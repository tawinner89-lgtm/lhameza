/**
 * L'HAMZA F SEL'A - Beauty/Makeup Scraper 💄
 * Scrapes makeup deals from multiple Moroccan beauty sites
 * 
 * Usage: 
 *   node scripts/scrape-beauty.js           # Jumia only
 *   node scripts/scrape-beauty.js --all     # All sites
 *   node scripts/scrape-beauty.js --hmall   # Hmall only
 *   node scripts/scrape-beauty.js --cosmetique  # Cosmetique.ma only
 */

require('dotenv').config();
const JumiaAdapter = require('../src/adapters/JumiaAdapter');
const HmallAdapter = require('../src/adapters/HmallAdapter');
const CosmetiqueAdapter = require('../src/adapters/CosmetiqueAdapter');
const supabaseService = require('../src/services/supabase.service');
const logger = require('../src/utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);
const runAll = args.includes('--all');
const runHmall = args.includes('--hmall');
const runCosmetique = args.includes('--cosmetique');
const runJumia = !runHmall && !runCosmetique; // Default to Jumia

// Jumia Makeup URLs
const JUMIA_BEAUTY_URLS = [
    // Main Categories
    'https://www.jumia.ma/maquillage/',
    // Top Brands 💄
    'https://www.jumia.ma/catalog/?q=maybelline',
    'https://www.jumia.ma/catalog/?q=loreal+paris',
    'https://www.jumia.ma/catalog/?q=essence+makeup',
    'https://www.jumia.ma/catalog/?q=garnier',
    'https://www.jumia.ma/catalog/?q=flormar',
    'https://www.jumia.ma/catalog/?q=mascara',
    'https://www.jumia.ma/catalog/?q=rouge+levres'
];

// Legacy variable for compatibility
const BEAUTY_URLS = JUMIA_BEAUTY_URLS;

// Helper function to save items to database
async function saveItems(items, totalStats) {
    for (const item of items) {
        item.category = 'beauty';
        const saveResult = await supabaseService.addDeal(item);
        if (saveResult.added) {
            totalStats.added++;
        } else if (saveResult.updated) {
            totalStats.updated++;
        }
    }
    totalStats.found += items.length;
}

// Scrape Jumia
async function scrapeJumia(totalStats) {
    console.log('\n📦 JUMIA BEAUTY');
    console.log('═'.repeat(60));
    
    const adapter = new JumiaAdapter('beauty');
    
    for (const url of JUMIA_BEAUTY_URLS) {
        console.log(`\n🔍 ${url}`);
        try {
            const result = await adapter.scrape(url);
            if (result.success && result.items?.length > 0) {
                console.log(`   ✅ Found ${result.items.length} items`);
                await saveItems(result.items, totalStats);
            } else {
                console.log(`   ⚠️ No items`);
            }
        } catch (error) {
            console.log(`   ❌ ${error.message}`);
        }
        await new Promise(r => setTimeout(r, 3000));
    }
}

// Scrape Hmall
async function scrapeHmall(totalStats) {
    console.log('\n📦 HMALL (Marjane Beauty)');
    console.log('═'.repeat(60));
    
    const adapter = new HmallAdapter('beauty');
    
    try {
        const result = await adapter.scrapeAll();
        if (result.success && result.items?.length > 0) {
            console.log(`   ✅ Found ${result.items.length} items`);
            await saveItems(result.items, totalStats);
        } else {
            console.log(`   ⚠️ No items found`);
        }
    } catch (error) {
        console.log(`   ❌ ${error.message}`);
    }
}

// Scrape Cosmetique.ma
async function scrapeCosmetique(totalStats) {
    console.log('\n📦 COSMETIQUE.MA');
    console.log('═'.repeat(60));
    
    const adapter = new CosmetiqueAdapter('beauty');
    
    try {
        const result = await adapter.scrapeAll();
        if (result.success && result.items?.length > 0) {
            console.log(`   ✅ Found ${result.items.length} items`);
            await saveItems(result.items, totalStats);
        } else {
            console.log(`   ⚠️ No items found`);
        }
    } catch (error) {
        console.log(`   ❌ ${error.message}`);
    }
}

// Main function
async function scrapeBeauty() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   💄 L\'HAMZA F SEL\'A - Beauty/Makeup Scraper                   ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    if (runAll) {
        console.log('║   Mode: ALL SITES (Jumia + Hmall + Cosmetique)                ║');
    } else if (runHmall) {
        console.log('║   Mode: HMALL ONLY                                            ║');
    } else if (runCosmetique) {
        console.log('║   Mode: COSMETIQUE.MA ONLY                                    ║');
    } else {
        console.log('║   Mode: JUMIA ONLY (default)                                  ║');
    }
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const startTime = Date.now();
    const totalStats = { found: 0, added: 0, updated: 0 };

    try {
        await supabaseService.initialize();
        console.log('\n✅ Database connected');

        // Run selected scrapers
        if (runAll || runJumia) {
            await scrapeJumia(totalStats);
        }
        
        if (runAll || runHmall) {
            await scrapeHmall(totalStats);
        }
        
        if (runAll || runCosmetique) {
            await scrapeCosmetique(totalStats);
        }

    } catch (error) {
        console.error('\n💥 Fatal error:', error.message);
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    💄 BEAUTY SCRAPE COMPLETE                   ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║   📦 Total Found:   ${totalStats.found}`.padEnd(65) + '║');
    console.log(`║   ✨ New Deals:     ${totalStats.added}`.padEnd(65) + '║');
    console.log(`║   🔄 Updated:       ${totalStats.updated}`.padEnd(65) + '║');
    console.log(`║   ⏱️ Duration:      ${duration} minutes`.padEnd(65) + '║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    process.exit(0);
}

scrapeBeauty();
