/**
 * L'HAMZA - Fix Nike Images in Database
 * 
 * Checks each Nike deal's image URL and tries to fix broken ones
 * by constructing proper Nike CDN URLs from the product URL
 * 
 * Usage: node scripts/fix-nike-images.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║  👟 L'HAMZA - Fix Nike Images in Database                             ║
╚═══════════════════════════════════════════════════════════════════════╝
`);

// Quick check if an image URL actually returns a valid image
function checkImageUrl(url) {
    return new Promise((resolve) => {
        if (!url) { resolve(false); return; }
        
        try {
            const urlObj = new URL(url);
            const req = https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            }, (res) => {
                const contentType = res.headers['content-type'] || '';
                const contentLength = parseInt(res.headers['content-length'] || '0');
                
                // Valid if: image content type AND reasonable size (>5KB = real image, not placeholder)
                const isValid = contentType.startsWith('image/') && contentLength > 5000;
                
                res.destroy(); // Don't download the full image
                resolve(isValid);
            });
            
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
        } catch (e) {
            resolve(false);
        }
    });
}

async function main() {
    // Get all Nike deals
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
        console.log('⚠️ No Nike products found');
        return;
    }

    let fixed = 0;
    let alreadyGood = 0;
    let unfixable = 0;

    for (const deal of nikeDeals) {
        process.stdout.write(`   Checking: ${deal.title?.substring(0, 40).padEnd(42)} `);

        // Check current image
        if (deal.image) {
            const isValid = await checkImageUrl(deal.image);
            if (isValid) {
                console.log('✅ Image OK');
                alreadyGood++;
                continue;
            }
            console.log('❌ Image broken - trying to fix...');
        } else {
            console.log('⚠️ No image - trying to find one...');
        }

        // Try to construct a valid image URL from the product URL
        // Nike product URLs contain a style ID like: nike.com/t/product-name-ABCD1234
        let newImageUrl = null;

        if (deal.url) {
            // Extract style color from Nike URL
            // Pattern: /t/product-name-STYLEID
            const styleMatch = deal.url.match(/\/t\/[^\/]+-([A-Z0-9]{6,})/i);
            if (styleMatch) {
                const styleId = styleMatch[1];
                // Try Nike CDN URLs with different image IDs
                const candidates = [
                    `https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/${styleId}.png`,
                    `https://static.nike.com/a/images/t_PDP_1280_v1/f_auto/${styleId}.jpg`,
                ];

                for (const candidate of candidates) {
                    const isValid = await checkImageUrl(candidate);
                    if (isValid) {
                        newImageUrl = candidate;
                        break;
                    }
                }
            }
        }

        if (newImageUrl) {
            // Update in database
            const { error: updateError } = await supabase
                .from('deals')
                .update({ image: newImageUrl })
                .eq('id', deal.id);

            if (!updateError) {
                console.log(`      🔧 Fixed! New image: ${newImageUrl.substring(0, 60)}...`);
                fixed++;
            } else {
                console.log(`      ❌ DB update failed: ${updateError.message}`);
                unfixable++;
            }
        } else {
            console.log('      ❌ Could not find a working image URL');
            unfixable++;
        }
    }

    console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║  RESULTS                                                              ║
╠═══════════════════════════════════════════════════════════════════════╣
║   ✅ Already OK:  ${alreadyGood.toString().padEnd(50)}║
║   🔧 Fixed:       ${fixed.toString().padEnd(50)}║
║   ❌ Unfixable:   ${unfixable.toString().padEnd(50)}║
╚═══════════════════════════════════════════════════════════════════════╝
`);
}

main().catch(console.error);
