/**
 * L'HAMZA F SEL'A - Image Validator
 * Tests all image URLs in database and removes broken ones
 * 
 * Usage: node scripts/validate-images.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Test if image URL is valid
async function testImageUrl(url) {
    if (!url) return false;
    
    // Skip obviously bad URLs
    if (url.includes('placeholder') || 
        url.includes('loader') || 
        url.includes('data:image/gif') ||
        url.includes('spinner')) {
        return false;
    }
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        clearTimeout(timeout);
        
        // Check if it's an image
        const contentType = response.headers.get('content-type') || '';
        const isImage = contentType.startsWith('image/') || response.ok;
        
        return response.ok && isImage;
    } catch (error) {
        return false;
    }
}

async function validateImages() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   🖼️  L\'HAMZA F SEL\'A - Image Validator                         ║');
    console.log('║   Testing all image URLs in database...                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    // Get all deals with images
    const { data: deals, error } = await supabase
        .from('deals')
        .select('id, title, image, source')
        .not('image', 'is', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Database error:', error.message);
        process.exit(1);
    }

    console.log(`📊 Found ${deals.length} deals with images\n`);

    let valid = 0;
    let invalid = 0;
    let fixed = 0;
    const brokenBySource = {};

    // Process in batches of 10 for speed
    const batchSize = 10;
    
    for (let i = 0; i < deals.length; i += batchSize) {
        const batch = deals.slice(i, i + batchSize);
        
        const results = await Promise.all(
            batch.map(async (deal) => {
                const isValid = await testImageUrl(deal.image);
                return { deal, isValid };
            })
        );

        for (const { deal, isValid } of results) {
            if (isValid) {
                valid++;
                process.stdout.write('✅');
            } else {
                invalid++;
                process.stdout.write('❌');
                
                // Track by source
                brokenBySource[deal.source] = (brokenBySource[deal.source] || 0) + 1;
                
                // Set image to null in database
                const { error: updateError } = await supabase
                    .from('deals')
                    .update({ image: null })
                    .eq('id', deal.id);
                
                if (!updateError) {
                    fixed++;
                }
            }
        }
        
        // Progress
        const progress = Math.round(((i + batch.length) / deals.length) * 100);
        process.stdout.write(` ${progress}%\r\n`);
    }

    // Summary
    console.log('\n\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    🖼️  VALIDATION COMPLETE                      ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║   ✅ Valid Images:    ${valid}`.padEnd(65) + '║');
    console.log(`║   ❌ Broken Images:   ${invalid}`.padEnd(65) + '║');
    console.log(`║   🔧 Fixed (set null): ${fixed}`.padEnd(65) + '║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log('║   Broken by Source:'.padEnd(65) + '║');
    
    for (const [source, count] of Object.entries(brokenBySource)) {
        console.log(`║     ${source}: ${count}`.padEnd(65) + '║');
    }
    
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    process.exit(0);
}

validateImages();
