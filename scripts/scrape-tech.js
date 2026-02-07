/**
 * L'HAMZA F SEL'A - Tech Scraper 💻
 * Scrapes tech deals from Jumia & Electroplanet
 * 
 * Usage: node scripts/scrape-tech.js
 */

require('dotenv').config();
const JumiaAdapter = require('../src/adapters/JumiaAdapter');
const supabaseService = require('../src/services/supabase.service');

const TECH_URLS = {
  jumia: [
    // Computers & Laptops
    'https://www.jumia.ma/ordinateurs-portables/',
    'https://www.jumia.ma/ordinateurs/',
    'https://www.jumia.ma/catalog/?q=laptop',
    'https://www.jumia.ma/catalog/?q=macbook',
    // Phones & Tablets
    'https://www.jumia.ma/telephones-tablettes/',
    'https://www.jumia.ma/catalog/?q=iphone',
    'https://www.jumia.ma/catalog/?q=samsung+galaxy',
    'https://www.jumia.ma/catalog/?q=ipad',
    // Gaming
    'https://www.jumia.ma/catalog/?q=playstation',
    'https://www.jumia.ma/catalog/?q=xbox',
    'https://www.jumia.ma/catalog/?q=nintendo',
    // Electronics
    'https://www.jumia.ma/electronique/',
    'https://www.jumia.ma/catalog/?q=tv',
    'https://www.jumia.ma/catalog/?q=headphones',
    'https://www.jumia.ma/catalog/?q=speakers',
    // Accessories
    'https://www.jumia.ma/catalog/?q=airpods',
    'https://www.jumia.ma/catalog/?q=smartwatch',
    'https://www.jumia.ma/catalog/?q=power+bank',
  ]
};

async function saveItems(items, totalStats) {
  for (const item of items) {
    // Force category to tech
    item.category = 'tech';
    
    const saveResult = await supabaseService.addDeal(item);
    if (saveResult.added) {
      totalStats.added++;
    } else if (saveResult.updated) {
      totalStats.updated++;
    }
  }
}

async function scrapeJumia(totalStats) {
  console.log('\n📦 JUMIA TECH');
  console.log('═'.repeat(60) + '\n');
  
  const adapter = new JumiaAdapter();
  
  for (const url of TECH_URLS.jumia) {
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
  console.log('║   💻 L\'HAMZA F SEL\'A - Tech Scraper                            ║');
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
