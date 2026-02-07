/**
 * L'HAMZA - Check Nike Images in Database
 * Check if Nike products have images
 * 
 * Usage: node scripts/check-nike-images.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function checkNikeImages() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   👟 L\'HAMZA - Check Nike Images in Database                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    const { data: nikeDeals, error } = await supabase
        .from('deals')
        .select('id, title, image, url')
        .eq('source', 'nike')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    console.log(`📦 Total Nike products: ${nikeDeals?.length || 0}\n`);

    if (!nikeDeals || nikeDeals.length === 0) {
        console.log('⚠️ No Nike products found in database');
        return;
    }

    // Categorize by image status
    const withImage = nikeDeals.filter(d => d.image && d.image.length > 10);
    const withoutImage = nikeDeals.filter(d => !d.image || d.image.length <= 10);

    console.log(`✅ With images: ${withImage.length}`);
    console.log(`❌ Without images: ${withoutImage.length}\n`);

    if (withoutImage.length > 0) {
        console.log('❌ Nike products WITHOUT images:');
        withoutImage.forEach((d, i) => {
            console.log(`   ${i + 1}. ${d.title?.substring(0, 55)}...`);
            console.log(`      Image: ${d.image || 'NULL'}`);
            console.log(`      URL: ${d.url?.substring(0, 80)}...`);
            console.log('');
        });
    }

    if (withImage.length > 0) {
        console.log('\n✅ Nike products WITH images (sample):');
        withImage.slice(0, 5).forEach((d, i) => {
            console.log(`   ${i + 1}. ${d.title?.substring(0, 55)}...`);
            console.log(`      Image: ${d.image?.substring(0, 100)}...`);
            console.log('');
        });
    }

    console.log('\n');
}

checkNikeImages().catch(console.error);
