/**
 * Clean Non-Sale Deals
 * Removes deals that no longer have a valid discount (expired sales)
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanNonSaleDeals() {
  console.log('🧹 Cleaning deals without valid discounts...\n');

  try {
    // Fetch all deals
    console.log('📥 Fetching all deals...');
    const { data: deals, error } = await supabase
      .from('deals')
      .select('id, title, price, original_price, discount, source')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    console.log(`📊 Total deals in database: ${deals.length}\n`);

    // Find deals to remove
    const toDelete = [];
    const toKeep = [];

    for (const deal of deals) {
      const shouldDelete = 
        // No discount at all
        !deal.discount || 
        // Discount too small (< 10%)
        deal.discount < 10 ||
        // Invalid pricing (original < current)
        (deal.original_price && deal.original_price < deal.price) ||
        // Suspicious discount (> 95%)
        deal.discount > 95;

      if (shouldDelete) {
        toDelete.push(deal);
      } else {
        toKeep.push(deal);
      }
    }

    console.log(`✅ Valid deals (with 10%+ discount): ${toKeep.length}`);
    console.log(`❌ Invalid deals (to delete): ${toDelete.length}\n`);

    if (toDelete.length === 0) {
      console.log('✨ No deals to delete. Database is clean!');
      return;
    }

    // Show samples of what will be deleted
    console.log('🗑️  Sample of deals to delete:');
    toDelete.slice(0, 10).forEach((d, i) => {
      console.log(`   ${i + 1}. [${d.source}] ${d.title.substring(0, 50)}...`);
      console.log(`      Price: ${d.price} MAD | Original: ${d.original_price} | Discount: ${d.discount}%`);
    });
    console.log('');

    // Delete in batches
    const batchSize = 50;
    const ids = toDelete.map(d => d.id);
    let deleted = 0;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const { error: deleteError } = await supabase
        .from('deals')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error(`❌ Error deleting batch ${i / batchSize + 1}:`, deleteError.message);
      } else {
        deleted += batch.length;
        console.log(`✓ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} deals`);
      }
    }

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║     🧹 CLEANUP COMPLETE                ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║  ✅ Kept:    ${toKeep.length.toString().padEnd(4)} deals with valid sales  ║`);
    console.log(`║  ❌ Deleted: ${deleted.toString().padEnd(4)} expired/invalid deals ║`);
    console.log('╚════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanNonSaleDeals();
