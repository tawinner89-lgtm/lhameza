/**
 * Fix Original Prices Script
 * Calculates and updates original prices for deals that have discount but no original price
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOriginalPrices() {
    console.log('🔧 Fixing original prices...\n');
    
    try {
        // Get deals with discount but no original price
        const { data: deals, error } = await supabase
            .from('deals')
            .select('id, price, discount, original_price')
            .gt('discount', 0)
            .is('original_price', null);
        
        if (error) throw error;
        
        console.log(`📦 Found ${deals.length} deals with discount but no original price`);
        
        if (deals.length === 0) {
            console.log('✅ No deals to fix!');
            return;
        }
        
        let updated = 0;
        
        for (const deal of deals) {
            // Calculate original price: originalPrice = currentPrice / (1 - discount/100)
            const originalPrice = Math.round(deal.price / (1 - deal.discount / 100));
            
            const { error: updateError } = await supabase
                .from('deals')
                .update({ original_price: originalPrice })
                .eq('id', deal.id);
            
            if (updateError) {
                console.error(`❌ Error updating deal ${deal.id}: ${updateError.message}`);
            } else {
                updated++;
            }
        }
        
        console.log(`\n✅ Updated ${updated} deals with calculated original prices!`);
        
        // Show sample
        const { data: sample } = await supabase
            .from('deals')
            .select('title, price, original_price, discount')
            .gt('original_price', 0)
            .limit(3);
        
        console.log('\n📊 Sample updated deals:');
        sample?.forEach(d => {
            console.log(`  - ${d.title?.substring(0, 40)}...`);
            console.log(`    💰 ${d.price} MAD (was ${d.original_price} MAD) -${d.discount}%`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

fixOriginalPrices();
