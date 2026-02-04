/**
 * Analyze all deals in database
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function analyze() {
    console.log('\n=== DATABASE ANALYSIS ===\n');
    
    const { data: all } = await supabase
        .from('deals')
        .select('source, discount, original_price, price, title');
    
    const stats = {};
    
    all?.forEach(d => {
        if (!stats[d.source]) {
            stats[d.source] = { total: 0, withDiscount: 0, noDiscount: 0, examples: [] };
        }
        stats[d.source].total++;
        
        if (d.discount && d.discount > 0) {
            stats[d.source].withDiscount++;
        } else {
            stats[d.source].noDiscount++;
            if (stats[d.source].examples.length < 2) {
                stats[d.source].examples.push({
                    title: d.title?.substring(0, 35),
                    price: d.price,
                    orig: d.original_price,
                    disc: d.discount
                });
            }
        }
    });
    
    console.log('Source'.padEnd(15) + 'Total'.padEnd(8) + 'Promo'.padEnd(8) + 'No Promo');
    console.log('-'.repeat(45));
    
    let totalAll = 0, totalWithDisc = 0, totalNoDisc = 0;
    
    Object.entries(stats).sort((a,b) => b[1].total - a[1].total).forEach(([source, s]) => {
        console.log(
            source.padEnd(15) + 
            String(s.total).padEnd(8) + 
            String(s.withDiscount).padEnd(8) + 
            s.noDiscount
        );
        totalAll += s.total;
        totalWithDisc += s.withDiscount;
        totalNoDisc += s.noDiscount;
    });
    
    console.log('-'.repeat(45));
    console.log('TOTAL'.padEnd(15) + String(totalAll).padEnd(8) + String(totalWithDisc).padEnd(8) + totalNoDisc);
    
    console.log('\n=== ITEMS WITHOUT DISCOUNT ===\n');
    Object.entries(stats).forEach(([source, s]) => {
        if (s.noDiscount > 0) {
            console.log(source + ' (' + s.noDiscount + ' items):');
            s.examples.forEach(ex => {
                console.log('  - ' + ex.title + ' | ' + ex.price + ' MAD');
            });
        }
    });
    
    console.log('\n=== RECOMMENDATION ===');
    console.log('DELETE items without discount:', totalNoDisc);
    console.log('KEEP items with discount:', totalWithDisc);
}

analyze();
