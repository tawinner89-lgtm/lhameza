/**
 * L'HAMZA F SEL'A - Database Cleanup
 * Removes broken deals (bad URLs, no images, etc.)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function cleanup() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   🧹 L\'HAMZA F SEL\'A - Database Cleanup                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    let totalDeleted = 0;

    // 1. Delete Electroplanet deals (images don't work)
    console.log('🔍 Checking Electroplanet...');
    const { error: err1, count: electroDeleted } = await supabase
        .from('deals')
        .delete({ count: 'exact' })
        .eq('source', 'electroplanet');
    
    if (!err1) {
        console.log(`   ❌ Deleted ${electroDeleted || 0} Electroplanet deals (broken images)`);
        totalDeleted += electroDeleted || 0;
    }

    // 2. Delete Jumia deals with login redirect URLs
    console.log('🔍 Checking Jumia login URLs...');
    const { error: err2, count: loginDeleted } = await supabase
        .from('deals')
        .delete({ count: 'exact' })
        .like('url', '%customer/account/login%');
    
    if (!err2) {
        console.log(`   ❌ Deleted ${loginDeleted || 0} Jumia deals (login redirect URLs)`);
        totalDeleted += loginDeleted || 0;
    }

    // 3. Delete deals with empty/null URLs
    console.log('🔍 Checking empty URLs...');
    const { error: err3, count: emptyDeleted } = await supabase
        .from('deals')
        .delete({ count: 'exact' })
        .is('url', null);
    
    if (!err3) {
        console.log(`   ❌ Deleted ${emptyDeleted || 0} deals (null URLs)`);
        totalDeleted += emptyDeleted || 0;
    }

    // 4. Delete deals with empty string URLs
    const { error: err4, count: emptyStrDeleted } = await supabase
        .from('deals')
        .delete({ count: 'exact' })
        .eq('url', '');
    
    if (!err4) {
        console.log(`   ❌ Deleted ${emptyStrDeleted || 0} deals (empty URLs)`);
        totalDeleted += emptyStrDeleted || 0;
    }

    // 5. Get remaining stats
    const { count: remaining } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true });

    // 6. Get counts by source
    const { data: allDeals } = await supabase
        .from('deals')
        .select('source');
    
    const sourceCounts = {};
    allDeals?.forEach(d => {
        sourceCounts[d.source] = (sourceCounts[d.source] || 0) + 1;
    });

    // Summary
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    🧹 CLEANUP COMPLETE                         ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║   🗑️  Total Deleted:  ${totalDeleted}`.padEnd(65) + '║');
    console.log(`║   ✅ Remaining:       ${remaining}`.padEnd(65) + '║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log('║   📊 Deals by Source:'.padEnd(65) + '║');
    
    Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([source, count]) => {
            console.log(`║      ${source}: ${count}`.padEnd(65) + '║');
        });
    
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    process.exit(0);
}

cleanup();
