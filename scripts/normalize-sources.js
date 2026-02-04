require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function fix() {
    console.log('🔧 Normalizing sources...\n');
    
    // Delete remaining Electroplanet
    const { count: epCount } = await supabase
        .from('deals')
        .delete({ count: 'exact' })
        .ilike('source', '%electroplanet%');
    console.log('Deleted Electroplanet:', epCount || 0);
    
    // Normalize sources - lowercase
    const updates = [
        { old: 'Nike', new: 'nike' },
        { old: 'Zara', new: 'zara' },
        { old: 'Jumia', new: 'jumia' },
        { old: 'Kitea', new: 'kitea' },
        { old: 'Adidas', new: 'adidas' }
    ];
    
    for (const u of updates) {
        const { count } = await supabase
            .from('deals')
            .update({ source: u.new })
            .eq('source', u.old);
        console.log('Normalized', u.old, '->', u.new);
    }
    
    // Final count by source
    const { data: allDeals } = await supabase
        .from('deals')
        .select('source');
    
    const sourceCounts = {};
    allDeals?.forEach(d => {
        sourceCounts[d.source] = (sourceCounts[d.source] || 0) + 1;
    });

    console.log('\n📊 Final counts:');
    Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([source, count]) => {
            console.log('   ' + source + ': ' + count);
        });
    
    console.log('\n✅ Total:', allDeals?.length || 0);
}
fix();
