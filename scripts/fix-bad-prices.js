/**
 * L'HAMZA F SEL'A - Fix Bad Prices
 *
 * Finds and deletes deals where discount > 85% (almost certainly
 * caused by the ZaraAdapter bug picking up the discount badge number
 * as the sale price).
 *
 * Run: node scripts/fix-bad-prices.js
 * Run (dry-run): node scripts/fix-bad-prices.js --dry-run
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const dryRun = process.argv.includes('--dry-run');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function fixBadPrices() {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   🔧 L\'HAMZA F SEL\'A - Fix Bad Prices                    ║');
    console.log(`║   Mode: ${dryRun ? 'DRY-RUN (no changes)                       ' : 'LIVE (will delete bad deals)             '}║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    // 1. Find deals with impossible discounts (> 85%)
    console.log('🔍 Finding deals with discount > 85%...');
    const { data: badDeals, error: fetchErr } = await supabase
        .from('deals')
        .select('id, title, source, price, original_price, discount, url')
        .gt('discount', 85)
        .order('discount', { ascending: false });

    if (fetchErr) {
        console.error('❌ Failed to fetch deals:', fetchErr.message);
        process.exit(1);
    }

    if (!badDeals || badDeals.length === 0) {
        console.log('✅ No deals with suspicious discounts (>85%) found!');
    } else {
        console.log(`\n⚠️  Found ${badDeals.length} deal(s) with suspicious discounts:\n`);
        for (const d of badDeals) {
            console.log(`   [${d.source}] "${d.title}"`);
            console.log(`      price=${d.price} | original_price=${d.original_price} | discount=${d.discount}%`);
            console.log(`      url=${d.url}`);
            console.log('');
        }

        if (!dryRun) {
            const ids = badDeals.map(d => d.id);
            const { error: delErr, count } = await supabase
                .from('deals')
                .delete({ count: 'exact' })
                .in('id', ids);

            if (delErr) {
                console.error('❌ Delete failed:', delErr.message);
            } else {
                console.log(`🗑️  Deleted ${count ?? badDeals.length} bad deal(s).`);
            }
        } else {
            console.log('ℹ️  Dry-run mode — nothing deleted. Run without --dry-run to delete.');
        }
    }

    // 2. Look up "PANTALON FLUIDE STRAIGHT FIT" specifically
    console.log('\n🔍 Looking up "PANTALON FLUIDE STRAIGHT FIT" in Supabase...');
    const { data: pantalon, error: pantErr } = await supabase
        .from('deals')
        .select('id, title, source, price, original_price, discount, url, scraped_at')
        .ilike('title', '%pantalon fluide%');

    if (pantErr) {
        console.error('❌ Lookup failed:', pantErr.message);
    } else if (!pantalon || pantalon.length === 0) {
        console.log('   ℹ️  Deal not found in database (may have been cleaned already or never inserted).');
    } else {
        console.log(`\n   Found ${pantalon.length} matching deal(s):\n`);
        for (const d of pantalon) {
            const realDiscount = d.original_price && d.price
                ? Math.round((1 - d.price / d.original_price) * 100)
                : null;
            console.log(`   title:          ${d.title}`);
            console.log(`   source:         ${d.source}`);
            console.log(`   price:          ${d.price} MAD`);
            console.log(`   original_price: ${d.original_price} MAD`);
            console.log(`   discount (DB):  ${d.discount}%`);
            console.log(`   discount (calc):${realDiscount}%`);
            console.log(`   scraped_at:     ${d.scraped_at}`);
            console.log(`   url:            ${d.url}`);
            console.log('');
        }
    }

    // 3. Summary stats
    const { count: total } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true });

    const { count: highDiscount } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .gt('discount', 85);

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   📊 DB Summary (after cleanup)                          ║');
    console.log(`║   Total deals:              ${String(total ?? '?').padEnd(27)}║`);
    console.log(`║   Remaining bad (>85% off): ${String(highDiscount ?? '?').padEnd(27)}║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    process.exit(0);
}

fixBadPrices().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
