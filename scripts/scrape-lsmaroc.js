/**
 * L'HAMZA F SEL'A - LS Maroc Standalone Scraper
 *
 * Usage: node scripts/scrape-lsmaroc.js
 *
 * Uses the Shopify /products.json API — no Playwright, no browser.
 * Fast and reliable. Saves discounted deals to Supabase.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const LSMarocAdapter = require('../src/adapters/LSMarocAdapter');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

console.log(`
╔══════════════════════════════════════════════════════╗
║  🖤 L'HAMZA - LS Maroc Scraper                       ║
║  Strategy: Shopify JSON API (no browser needed)      ║
╚══════════════════════════════════════════════════════╝
`);

async function saveToSupabase(deals) {
    console.log(`\n💾 Saving ${deals.length} deals to Supabase...`);
    let saved = 0, updated = 0, errors = 0;

    for (const deal of deals) {
        try {
            const record = {
                external_id: `lsmaroc-${Buffer.from(deal.name + deal.link).toString('base64').substring(0, 20)}`,
                title: deal.name || deal.title,
                brand: deal.brand || 'LS Maroc',
                price: deal.price,
                original_price: deal.originalPrice || null,
                discount: deal.discount || 0,
                currency: 'MAD',
                image: deal.image || null,
                url: deal.link || deal.url,
                source: 'lsmaroc',
                category: 'fashion',
                condition: 'new',
                in_stock: true,
                location: 'Morocco',
                scraped_at: new Date().toISOString()
            };

            // Upsert by URL
            const { data: existing } = await supabase
                .from('deals')
                .select('id')
                .eq('url', record.url)
                .single();

            if (existing) {
                const { error } = await supabase
                    .from('deals')
                    .update({
                        price: record.price,
                        original_price: record.original_price,
                        discount: record.discount,
                        scraped_at: record.scraped_at
                    })
                    .eq('id', existing.id);
                if (!error) updated++; else errors++;
            } else {
                const { error } = await supabase.from('deals').insert(record);
                if (!error) saved++; else { errors++; if (error) console.error('  Insert error:', error.message); }
            }
        } catch (e) {
            errors++;
        }
    }

    console.log(`   ✅ New: ${saved} | 🔄 Updated: ${updated} | ❌ Errors: ${errors}`);
}

async function main() {
    const adapter = new LSMarocAdapter();
    const result = await adapter.scrape();

    if (!result.success || result.items.length === 0) {
        console.log('⚠️  No deals found:', result.error || 'empty result');
        process.exit(0);
    }

    console.log(`\n📊 Found ${result.items.length} discounted deals`);
    console.log('\n📋 Sample deals:');
    result.items.slice(0, 5).forEach((d, i) => {
        console.log(`   ${i + 1}. ${d.name?.slice(0, 45)}`);
        console.log(`      ${d.price} MAD (was ${d.originalPrice}) — ${d.discount}% off | ${d.brand}`);
    });

    await saveToSupabase(result.items);
    console.log('\n✅ LS Maroc scrape complete!\n');
}

main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(0);
});
