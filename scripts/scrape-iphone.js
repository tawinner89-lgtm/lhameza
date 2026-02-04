/**
 * L'HAMZA F SEL'A - iPhone Scraper 📱
 * Scrapes iPhone deals from Moroccan e-commerce sites
 * 
 * Usage: 
 *   node scripts/scrape-iphone.js           # All sites
 *   node scripts/scrape-iphone.js --jumia   # Jumia only
 */

require('dotenv').config();
const JumiaAdapter = require('../src/adapters/JumiaAdapter');
const supabaseService = require('../src/services/supabase.service');

// Parse command line arguments
const args = process.argv.slice(2);
const jumiaOnly = args.includes('--jumia');

// iPhone search URLs on Jumia
const IPHONE_URLS = [
    // Main iPhone searches
    'https://www.jumia.ma/catalog/?q=iphone',
    'https://www.jumia.ma/catalog/?q=iphone+15',
    'https://www.jumia.ma/catalog/?q=iphone+14',
    'https://www.jumia.ma/catalog/?q=iphone+13',
    'https://www.jumia.ma/catalog/?q=iphone+12',
    'https://www.jumia.ma/catalog/?q=iphone+11',
    // Pro models
    'https://www.jumia.ma/catalog/?q=iphone+pro+max',
    'https://www.jumia.ma/catalog/?q=iphone+15+pro',
    'https://www.jumia.ma/catalog/?q=iphone+14+pro',
    // Categories
    'https://www.jumia.ma/telephones-tablettes-apple-iphones/',
    // Accessories (optional)
    'https://www.jumia.ma/catalog/?q=airpods',
    'https://www.jumia.ma/catalog/?q=apple+watch'
];

// Helper function to save items
async function saveItems(items, totalStats) {
    for (const item of items) {
        // Force category to tech for iPhones
        item.category = 'tech';
        
        const saveResult = await supabaseService.addDeal(item);
        if (saveResult.added) {
            totalStats.added++;
        } else if (saveResult.updated) {
            totalStats.updated++;
        }
    }
    totalStats.found += items.length;
}

// Scrape Jumia for iPhones
async function scrapeJumiaIphones(totalStats) {
    console.log('\n📱 JUMIA - iPhone Deals');
    console.log('═'.repeat(60));
    
    const adapter = new JumiaAdapter('tech');
    
    for (const url of IPHONE_URLS) {
        const shortUrl = url.split('?')[1] || url.split('/').pop();
        console.log(`\n🔍 ${shortUrl}`);
        
        try {
            const result = await adapter.scrape(url);
            
            if (result.success && result.items?.length > 0) {
                // Filter to only iPhone-related items
                const iphoneItems = result.items.filter(item => {
                    const name = (item.title || item.name || '').toLowerCase();
                    return name.includes('iphone') || 
                           name.includes('airpod') || 
                           name.includes('apple watch') ||
                           name.includes('apple');
                });
                
                if (iphoneItems.length > 0) {
                    console.log(`   ✅ Found ${iphoneItems.length} Apple items`);
                    await saveItems(iphoneItems, totalStats);
                } else {
                    console.log(`   ⚠️ No Apple items in ${result.items.length} results`);
                }
            } else {
                console.log(`   ⚠️ No items found`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        // Wait between requests to avoid blocking
        await new Promise(r => setTimeout(r, 3000));
    }
}

// Main function
async function scrapeIphones() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   📱 L\'HAMZA F SEL\'A - iPhone Scraper                          ║');
    console.log('║   iPhone 11, 12, 13, 14, 15 + Pro + AirPods + Apple Watch      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const startTime = Date.now();
    const totalStats = { found: 0, added: 0, updated: 0 };

    try {
        // Initialize database
        await supabaseService.initialize();
        console.log('\n✅ Database connected');

        // Scrape Jumia
        await scrapeJumiaIphones(totalStats);

    } catch (error) {
        console.error('\n💥 Fatal error:', error.message);
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                   📱 iPHONE SCRAPE COMPLETE                    ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║   📦 Total Found:   ${totalStats.found}`.padEnd(65) + '║');
    console.log(`║   ✨ New Deals:     ${totalStats.added}`.padEnd(65) + '║');
    console.log(`║   🔄 Updated:       ${totalStats.updated}`.padEnd(65) + '║');
    console.log(`║   ⏱️ Duration:      ${duration} minutes`.padEnd(65) + '║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    process.exit(0);
}

scrapeIphones();
