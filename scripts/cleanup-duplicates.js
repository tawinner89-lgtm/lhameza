/**
 * Cleanup Duplicates Script
 * Removes duplicate deals from Supabase database
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

async function cleanupDuplicates() {
    console.log('🧹 Starting duplicate cleanup...\n');
    
    try {
        // Get all deals
        const { data: deals, error } = await supabase
            .from('deals')
            .select('id, title, price, source, image, created_at')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        console.log(`📦 Total deals in database: ${deals.length}`);
        
        // Find duplicates based on title + price + source
        const seen = new Map();
        const duplicateIds = [];
        
        deals.forEach(deal => {
            // Create a unique key from title + price + source
            const key = `${deal.title?.toLowerCase().trim()}-${deal.price}-${deal.source}`;
            
            if (seen.has(key)) {
                // This is a duplicate - mark for deletion
                duplicateIds.push(deal.id);
            } else {
                seen.set(key, deal.id);
            }
        });
        
        console.log(`🔍 Found ${duplicateIds.length} duplicates to remove`);
        
        if (duplicateIds.length === 0) {
            console.log('✅ No duplicates found!');
            return;
        }
        
        // Delete duplicates in batches of 100
        const batchSize = 100;
        let deleted = 0;
        
        for (let i = 0; i < duplicateIds.length; i += batchSize) {
            const batch = duplicateIds.slice(i, i + batchSize);
            
            const { error: deleteError } = await supabase
                .from('deals')
                .delete()
                .in('id', batch);
            
            if (deleteError) {
                console.error(`❌ Error deleting batch: ${deleteError.message}`);
            } else {
                deleted += batch.length;
                console.log(`🗑️ Deleted ${deleted}/${duplicateIds.length} duplicates...`);
            }
        }
        
        console.log(`\n✅ Cleanup complete! Removed ${deleted} duplicates.`);
        
        // Get new count
        const { count } = await supabase
            .from('deals')
            .select('*', { count: 'exact', head: true });
        
        console.log(`📦 Remaining deals: ${count}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

cleanupDuplicates();
