/**
 * Quick stats check
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkStats() {
    const { data: deals, error } = await supabase.from('deals').select('source, discount');
    
    if (error) {
        console.log('Error:', error.message);
        return;
    }
    
    const stats = {};
    deals.forEach(d => {
        if (!stats[d.source]) stats[d.source] = { total: 0, withDiscount: 0 };
        stats[d.source].total++;
        if (d.discount >= 10) stats[d.source].withDiscount++;
    });
    
    console.log('\n📊 إحصائيات الديلات:\n');
    console.log('Source'.padEnd(15) + 'Total'.padEnd(10) + 'With 10%+ Discount');
    console.log('─'.repeat(45));
    
    let totalDeals = 0;
    let totalWithDiscount = 0;
    
    Object.entries(stats).sort((a,b) => b[1].total - a[1].total).forEach(([source, s]) => {
        console.log(source.padEnd(15) + String(s.total).padEnd(10) + s.withDiscount);
        totalDeals += s.total;
        totalWithDiscount += s.withDiscount;
    });
    
    console.log('─'.repeat(45));
    console.log('TOTAL'.padEnd(15) + String(totalDeals).padEnd(10) + totalWithDiscount);
    console.log('\n');
}

checkStats();
