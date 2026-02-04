/**
 * L'HAMZA - Fix Adidas URLs
 * Converts AJAX/quickview URLs to proper product page URLs
 * 
 * Usage: node scripts/fix-adidas-urls.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function createSlug(name) {
    if (!name) return 'product';
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
}

function extractPidFromUrl(url) {
    if (!url) return null;
    // Extract PID from AJAX URL like: ...&pid=JM9179&...
    const match = url.match(/[?&]pid=([A-Z0-9]+)/i);
    return match ? match[1] : null;
}

function buildProperUrl(pid, title) {
    const slug = createSlug(title);
    return `https://www.adidas.co.ma/fr/${slug}/${pid}.html`;
}

async function fixAdidasUrls() {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║ 🔧 Fix Adidas URLs (AJAX → Product Page)                  ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Get all Adidas deals with bad URLs
    const { data: deals, error } = await supabase
        .from('deals')
        .select('id, title, url')
        .eq('source', 'adidas')
        .or('url.ilike.%demandware%,url.ilike.%ajax%,url.ilike.%QuickView%');

    if (error) {
        console.error('❌ Error fetching deals:', error.message);
        return;
    }

    console.log(`📦 Found ${deals?.length || 0} Adidas deals with bad URLs\n`);

    if (!deals || deals.length === 0) {
        console.log('✅ All URLs are already correct!');
        return;
    }

    let fixed = 0;
    let failed = 0;

    for (const deal of deals) {
        const pid = extractPidFromUrl(deal.url);
        
        if (!pid) {
            console.log(`⚠️ Could not extract PID from: ${deal.url}`);
            failed++;
            continue;
        }

        const newUrl = buildProperUrl(pid, deal.title);
        
        const { error: updateError } = await supabase
            .from('deals')
            .update({ url: newUrl })
            .eq('id', deal.id);

        if (updateError) {
            console.log(`❌ Failed to update ${deal.title}: ${updateError.message}`);
            failed++;
        } else {
            fixed++;
            if (fixed <= 10) {
                console.log(`✅ Fixed: ${deal.title?.slice(0, 40)}...`);
                console.log(`   Old: ${deal.url.slice(0, 60)}...`);
                console.log(`   New: ${newUrl}\n`);
            } else if (fixed % 50 === 0) {
                console.log(`   ... fixed ${fixed} so far ...`);
            }
        }
    }

    console.log('\n==================== SUMMARY ====================');
    console.log(`✅ Fixed:  ${fixed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('=================================================\n');
}

fixAdidasUrls().catch(console.error);
