/**
 * L'HAMZA F SEL'A - Home/Maison Scraper 🏠
 * Scrapes home & furniture deals from Jumia, Kitea, Marjane
 * 
 * Usage: node scripts/scrape-home.js
 */

require('dotenv').config();
const JumiaAdapter = require('../src/adapters/JumiaAdapter');
const supabaseService = require('../src/services/supabase.service');

const HOME_URLS = {
  jumia: [
    // Furniture
    'https://www.jumia.ma/maison-cuisine/',
    'https://www.jumia.ma/meubles/',
    'https://www.jumia.ma/catalog/?q=canape',
    'https://www.jumia.ma/catalog/?q=lit',
    'https://www.jumia.ma/catalog/?q=table',
    'https://www.jumia.ma/catalog/?q=chaise',
    'https://www.jumia.ma/catalog/?q=armoire',
    // Kitchen
    'https://www.jumia.ma/cuisine/',
    'https://www.jumia.ma/catalog/?q=vaisselle',
    'https://www.jumia.ma/catalog/?q=ustensiles',
    'https://www.jumia.ma/electromenager/',
    // Decoration
    'https://www.jumia.ma/decoration-maison/',
    'https://www.jumia.ma/catalog/?q=rideau',
    'https://www.jumia.ma/catalog/?q=tapis',
    'https://www.jumia.ma/catalog/?q=coussin',
    'https://www.jumia.ma/catalog/?q=lampe',
    // Bedding
    'https://www.jumia.ma/catalog/?q=draps',
    'https://www.jumia.ma/catalog/?q=couette',
    'https://www.jumia.ma/catalog/?q=oreiller',
    // Storage
    'https://www.jumia.ma/catalog/?q=rangement',
    'https://www.jumia.ma/catalog/?q=etagere',
  ]
};

async function saveItems(items, totalStats) {
  for (const item of items) {
    // Force category to home
    item.category = 'home';
    
    const saveResult = await supabaseService.addDeal(item);
    if (saveResult.added) {
      totalStats.added++;
    } else if (saveResult.updated) {
      totalStats.updated++;
    }
  }
}

async function scrapeJumia(totalStats) {
  console.log('\n📦 JUMIA HOME & MAISON');
  console.log('═'.repeat(60) + '\n');
  
  const adapter = new JumiaAdapter();
  
  for (const url of HOME_URLS.jumia) {
    console.log(`🔍 ${url}`);
    try {
      const result = await adapter.scrape(url);
      
      if (!result.success || !result.items || result.items.length === 0) {
        console.log(`   ⚠️  No items found`);
        continue;
      }
      
      const items = result.items;
      
      // Filter: Only deals with 10%+ discount
      const validDeals = items.filter(item => item.discount && item.discount >= 10);
      
      console.log(`   ✅ Found ${items.length} items (${validDeals.length} with valid discounts)`);
      
      if (validDeals.length > 0) {
        await saveItems(validDeals, totalStats);
      }
      
      // Sleep between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║   🏠 L\'HAMZA F SEL\'A - Home/Maison Scraper                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const totalStats = { added: 0, updated: 0 };

  try {
    // Connect to Supabase
    await supabaseService.initialize();
    console.log('✅ Database connected\n');

    // Scrape Jumia
    await scrapeJumia(totalStats);

    // Final stats
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
