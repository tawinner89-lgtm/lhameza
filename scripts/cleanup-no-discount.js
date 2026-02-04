/**
 * L'HAMZA - Cleanup deals without discount
 * Removes deals that have no discount (discount = 0 or null)
 * 
 * Usage: node scripts/cleanup-no-discount.js
 *        node scripts/cleanup-no-discount.js --source nike
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const MIN_DISCOUNT = 10;

async function cleanup() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   🧹 L\'HAMZA - Cleanup Deals Without Discount                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    // Check for --source argument
    const args = process.argv.slice(2);
    const sourceArg = args.find(a => a.startsWith('--source'));
    const source = sourceArg ? sourceArg.split('=')[1] || args[args.indexOf('--source') + 1] : null;

    // Find deals with no/low discount
    let query = supabase
        .from('deals')
        .select('id, title, source, discount, price, original_price')
        .or(`discount.is.null,discount.lt.${MIN_DISCOUNT}`);
    
    if (source) {
        query = query.eq('source', source.toLowerCase());
        console.log(`🔍 Looking for ${source} deals with discount < ${MIN_DISCOUNT}%...\n`);
    } else {
        console.log(`🔍 Looking for ALL deals with discount < ${MIN_DISCOUNT}%...\n`);
    }

    const { data: deals, error } = await query;

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (!deals || deals.length === 0) {
        console.log('✅ No deals to clean up! All deals have sufficient discount.\n');
        return;
    }

    console.log(`📦 Found ${deals.length} deals with no/low discount:\n`);
    
    // Show preview
    const preview = deals.slice(0, 10);
    preview.forEach(d => {
        const disc = d.discount || 0;
        console.log(`   • [${d.source}] ${disc}% - ${d.title?.substring(0, 40)}...`);
    });
    if (deals.length > 10) {
        console.log(`   ... and ${deals.length - 10} more\n`);
    }

    // Delete them
    console.log(`\n🗑️ Deleting ${deals.length} deals...`);
    
    const ids = deals.map(d => d.id);
    const { error: deleteError } = await supabase
        .from('deals')
        .delete()
        .in('id', ids);

    if (deleteError) {
        console.error('❌ Delete error:', deleteError.message);
        return;
    }

    console.log(`\n✅ Deleted ${deals.length} deals without proper discount!`);
    console.log('\n');
}

cleanup().catch(console.error);
