/**
 * L'HAMZA F SEL'A - Nike SOLD Scraper (FR Version) 👟
 * 
 * Scrapes from: https://www.nike.com/fr/w?q=sold&vst=sold
 * - Intercepts Nike's internal API for reliable product data + images
 * - Falls back to DOM scraping if API interception fails
 * - Converts EUR → MAD (1 EUR ≈ 11 MAD)
 * - Saves to Supabase
 * 
 * Usage: node scripts/scrape-nike-sold.js
 * Options:
 *   --max 200     Max products to scrape (default: 200)
 *   --delete      Delete old Nike deals before scraping
 */

require('dotenv').config();
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
const NIKE_SOLD_URL = 'https://www.nike.com/fr/w?q=sold&vst=sold';
const EUR_TO_MAD = 10.8;  // 1 EUR ≈ 10.8 MAD (Feb 2026)
const MIN_DISCOUNT = 10;
const args = process.argv.slice(2);
const MAX_PRODUCTS = parseInt(args.find((a, i) => args[i - 1] === '--max') || '200');
const DELETE_OLD = args.includes('--delete');

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║  👟 L'HAMZA F SEL'A - Nike SOLD Scraper (FR)                         ║
╠═══════════════════════════════════════════════════════════════════════╣
║  URL:          ${NIKE_SOLD_URL}
║  Max Products: ${MAX_PRODUCTS}
║  Min Discount: ${MIN_DISCOUNT}%
║  EUR → MAD:    1€ = ${EUR_TO_MAD} MAD
║  Delete old:   ${DELETE_OLD ? 'YES' : 'NO'}
╚═══════════════════════════════════════════════════════════════════════╝
`);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 1000, max = 2500) {
    return delay(Math.floor(Math.random() * (max - min + 1)) + min);
}

// ═══════════════════════════════════════════
// PRICE PARSER (handles EUR format: "59,99 €")
// ═══════════════════════════════════════════
function parseEurPrice(text) {
    if (!text) return null;
    // Match patterns like: 59,99 €  |  59.99€  |  59,99€  |  119,99 €
    const match = text.match(/([\d]+[.,]?\d*)\s*€/);
    if (!match) return null;
    const price = parseFloat(match[1].replace(',', '.'));
    return isNaN(price) ? null : price;
}

function eurToMad(eurPrice) {
    if (!eurPrice) return null;
    return Math.round(eurPrice * EUR_TO_MAD);
}

// ═══════════════════════════════════════════
// METHOD 1: API Interception (most reliable)
// ═══════════════════════════════════════════
async function scrapeViaAPI(page) {
    console.log('\n📡 Method 1: API Interception...\n');
    
    const apiProducts = [];
    let debugLogged = false;
    
    // Intercept Nike's internal API responses
    page.on('response', async (response) => {
        const url = response.url();
        
        // Nike's API endpoints for product data
        const isProductAPI = 
            url.includes('api.nike.com') ||
            url.includes('unite.nike.com') ||
            url.includes('nikecloud.com') ||
            url.includes('/product_feed/') ||
            url.includes('/products/') ||
            url.includes('/graphql') ||
            url.includes('cic/browse');
        
        if (!isProductAPI) return;
        
        try {
            const contentType = response.headers()['content-type'] || '';
            if (!contentType.includes('json')) return;
            
            const json = await response.json();
            
            // DEBUG: Log the API response structure (first time only)
            if (!debugLogged) {
                debugLogged = true;
                console.log(`\n   🔍 DEBUG: API Response URL: ${url.substring(0, 100)}`);
                console.log(`   🔍 DEBUG: Top-level keys: ${Object.keys(json).join(', ')}`);
                
                // Deep-inspect to find product arrays
                function findArrays(obj, path = '', depth = 0) {
                    if (depth > 4) return;
                    if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
                        const sampleKeys = Object.keys(obj[0]).slice(0, 10).join(', ');
                        console.log(`   🔍 DEBUG: Found array at "${path}" (${obj.length} items) keys: [${sampleKeys}]`);
                        
                        // Log first product's image-related fields
                        const first = obj[0];
                        const imgFields = Object.keys(first).filter(k => 
                            k.toLowerCase().includes('image') || 
                            k.toLowerCase().includes('img') || 
                            k.toLowerCase().includes('squarish') ||
                            k.toLowerCase().includes('portrait') ||
                            k.toLowerCase().includes('media') ||
                            k.toLowerCase().includes('url') ||
                            k.toLowerCase().includes('colorway')
                        );
                        if (imgFields.length > 0) {
                            console.log(`   🔍 DEBUG: Image-related fields: ${imgFields.join(', ')}`);
                            imgFields.forEach(f => {
                                const val = first[f];
                                if (typeof val === 'string') {
                                    console.log(`   🔍 DEBUG:   ${f} = "${val.substring(0, 120)}"`);
                                } else if (val && typeof val === 'object') {
                                    console.log(`   🔍 DEBUG:   ${f} = ${JSON.stringify(val).substring(0, 200)}`);
                                }
                            });
                        }
                        
                        // Also log ALL keys of first item for full visibility
                        console.log(`   🔍 DEBUG: First item ALL keys: ${Object.keys(first).join(', ')}`);
                        
                        // Log a compact version of the first product
                        const compact = {};
                        for (const k of Object.keys(first)) {
                            const v = first[k];
                            if (v === null || v === undefined) continue;
                            if (typeof v === 'string') compact[k] = v.substring(0, 80);
                            else if (typeof v === 'number' || typeof v === 'boolean') compact[k] = v;
                            else if (typeof v === 'object') compact[k] = `[${Array.isArray(v) ? 'Array:' + v.length : 'Object:' + Object.keys(v).length}]`;
                        }
                        console.log(`   🔍 DEBUG: First product compact: ${JSON.stringify(compact, null, 2).substring(0, 1000)}`);
                    }
                    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                        for (const key of Object.keys(obj)) {
                            findArrays(obj[key], path ? `${path}.${key}` : key, depth + 1);
                        }
                    }
                }
                findArrays(json);
            }
            
            // Nike uses multiple API response structures
            const productArrays = [];
            
            // Structure 1: hydratedProducts
            if (json.hydratedProducts?.length) {
                productArrays.push(json.hydratedProducts);
            }
            // Structure 2: objects
            if (json.objects?.length) {
                productArrays.push(json.objects);
            }
            // Structure 3: data.products
            if (json.data?.products?.products?.length) {
                productArrays.push(json.data.products.products);
            }
            if (json.data?.products?.length) {
                productArrays.push(json.data.products);
            }
            // Structure 4: products directly
            if (json.products?.length) {
                productArrays.push(json.products);
            }
            // Structure 5: wall (Nike Browse API)
            if (json.wall?.length) {
                productArrays.push(json.wall);
            }
            // Structure 6: filteredProductsCount + productGroupings
            if (json.productGroupings?.length) {
                for (const group of json.productGroupings) {
                    if (group.products?.length) {
                        productArrays.push(group.products);
                    }
                }
            }
            
            for (const products of productArrays) {
                for (const p of products) {
                    const product = extractFromAPIProduct(p);
                    if (product) {
                        apiProducts.push(product);
                    }
                }
                if (products.length > 0) {
                    console.log(`   📦 API: Got ${products.length} products (total: ${apiProducts.length})`);
                }
            }
        } catch (e) {
            // Not JSON or parse error - skip silently
        }
    });
    
    // Navigate to the page
    try {
        await page.goto(NIKE_SOLD_URL, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });
    } catch (e) {
        console.log(`   ⚠️ Page load timeout (continuing anyway): ${e.message}`);
    }
    
    // Handle cookie consent
    try {
        await delay(3000);
        const cookieBtn = await page.$('button:has-text("Accepter"), button:has-text("Accept"), [data-testid="dialog-accept-button"]');
        if (cookieBtn) {
            console.log('   🍪 Accepting cookies...');
            await cookieBtn.click();
            await delay(2000);
        }
    } catch (e) {}
    
    // Wait for initial load
    console.log('   ⏳ Waiting for initial API responses...');
    await delay(8000);
    
    // Scroll to trigger more API calls - scroll A LOT to load many products
    console.log('   📜 Scrolling to load more products (aggressive)...');
    let lastCount = apiProducts.length;
    let noChangeCount = 0;
    
    for (let i = 0; i < 150; i++) {
        // Alternate between fast and slow scrolls
        if (i % 3 === 0) {
            await page.evaluate(() => window.scrollBy({ top: 2000, behavior: 'instant' }));
            await delay(800);
        } else {
            await page.evaluate(() => window.scrollBy({ top: 1200, behavior: 'smooth' }));
            await delay(1500 + Math.random() * 1000);
        }
        
        // Every 10 scrolls, scroll back up a bit then down (triggers lazy loading)
        if (i > 0 && i % 15 === 0) {
            await page.evaluate(() => window.scrollBy({ top: -500, behavior: 'smooth' }));
            await delay(500);
            await page.evaluate(() => window.scrollBy({ top: 1500, behavior: 'smooth' }));
            await delay(1000);
        }
        
        if (apiProducts.length > lastCount) {
            noChangeCount = 0;
            if (i % 5 === 0) {
                console.log(`   Scroll ${i}/150 — ${apiProducts.length} products (+${apiProducts.length - lastCount})`);
            }
            lastCount = apiProducts.length;
        } else {
            noChangeCount++;
            if (noChangeCount >= 15) {
                console.log(`   ✅ No new products after 15 scrolls — done at scroll ${i}`);
                break;
            }
        }
        
        if (apiProducts.length >= MAX_PRODUCTS * 2) {
            console.log(`   ✅ Reached enough API products: ${apiProducts.length}`);
            break;
        }
    }
    
    // Final wait for API responses
    await delay(5000);
    
    return apiProducts;
}

function extractFromAPIProduct(p) {
    try {
        // Extract name
        const name = p.title || p.name || p.productName || p.subtitle;
        if (!name) return null;
        
        // Extract prices (Nike API gives prices in the local currency)
        let currentPrice = null;
        let originalPrice = null;
        
        // Multiple price structures
        if (p.price?.currentPrice != null) {
            currentPrice = p.price.currentPrice;
            originalPrice = p.price.fullPrice || p.price.msrp;
        } else if (p.currentPrice != null) {
            currentPrice = p.currentPrice;
            originalPrice = p.fullPrice || p.originalPrice || p.msrp;
        } else if (p.prices?.currentPrice != null) {
            currentPrice = p.prices.currentPrice;
            originalPrice = p.prices.fullPrice;
        }
        
        if (!currentPrice) return null;
        
        // Calculate discount
        let discount = 0;
        if (originalPrice && originalPrice > currentPrice) {
            discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
        } else if (p.discount) {
            discount = typeof p.discount === 'string' ? parseInt(p.discount) : p.discount;
        }
        
        if (discount < MIN_DISCOUNT || discount > 95) return null;
        
        // Extract image — Nike API provides various image formats
        let image = null;
        if (p.images?.squarishURL) {
            image = p.images.squarishURL;
        } else if (p.images?.portraitURL) {
            image = p.images.portraitURL;
        } else if (p.colorwayImages?.squarishURL) {
            image = p.colorwayImages.squarishURL;
        } else if (p.squarishURL) {
            image = p.squarishURL;
        } else if (p.portraitURL) {
            image = p.portraitURL;
        } else if (p.imageUrl) {
            image = p.imageUrl;
        } else if (typeof p.images === 'string') {
            image = p.images;
        } else if (Array.isArray(p.images) && p.images[0]) {
            image = typeof p.images[0] === 'string' ? p.images[0] : p.images[0].url;
        } else if (p.media?.images?.[0]) {
            image = p.media.images[0].url || p.media.images[0];
        }
        
        // Clean up image URL
        if (image) {
            if (image.startsWith('//')) image = 'https:' + image;
            // Ensure high quality
            if (image.includes('nike.com') && image.includes('t_default')) {
                image = image.replace('t_default', 't_PDP_1728_v1');
            }
        }
        
        // Build product URL
        const styleColor = p.styleColor || p.colorwayId || p.productId || p.id;
        const slug = p.slug || (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '');
        let url = p.pdpUrl || p.url || p.productUrl;
        if (!url && styleColor) {
            url = `https://www.nike.com/fr/t/${slug}-${styleColor}`;
        }
        if (url && !url.startsWith('http')) {
            url = 'https://www.nike.com' + url;
        }
        // Make sure URL is French version
        if (url && !url.includes('/fr/')) {
            url = url.replace('nike.com/t/', 'nike.com/fr/t/');
        }
        
        return {
            name,
            currentPriceEUR: currentPrice,
            originalPriceEUR: originalPrice,
            discount,
            image,
            url,
            styleColor,
            brand: 'Nike'
        };
    } catch (e) {
        return null;
    }
}

// ═══════════════════════════════════════════
// METHOD 2: DOM Scraping (fallback)
// ═══════════════════════════════════════════
async function scrapeViaDOM(page) {
    console.log('\n🔍 Method 2: DOM Scraping...\n');
    
    // Extra scrolling to load more products in DOM
    console.log('   📜 Extra DOM scrolling to load more cards...');
    for (let i = 0; i < 60; i++) {
        await page.evaluate(() => window.scrollBy({ top: 1500, behavior: 'instant' }));
        await delay(800 + Math.random() * 700);
        
        if (i % 10 === 0) {
            const cardCount = await page.evaluate(() => 
                document.querySelectorAll('a[href*="/t/"]').length
            );
            console.log(`   DOM scroll ${i}/60 — ${cardCount} product links found`);
        }
    }
    // Scroll back to top to ensure all images are loaded
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(2000);
    
    // Take a screenshot for debugging
    try {
        await page.screenshot({ path: 'nike-debug.png', fullPage: false });
        console.log('   📸 Screenshot saved: nike-debug.png');
    } catch (e) {}
    
    // Log what we see on the page
    const pageInfo = await page.evaluate(() => {
        const allImgs = document.querySelectorAll('img');
        const nikeImgs = Array.from(allImgs).filter(img => 
            (img.src && img.src.includes('nike.com')) || 
            (img.getAttribute('data-src') && img.getAttribute('data-src').includes('nike.com'))
        );
        
        return {
            totalImages: allImgs.length,
            nikeImages: nikeImgs.length,
            sampleImgSrcs: nikeImgs.slice(0, 5).map(img => ({
                src: img.src?.substring(0, 120),
                dataSrc: img.getAttribute('data-src')?.substring(0, 120),
                alt: img.alt?.substring(0, 50),
                parentTag: img.parentElement?.tagName
            })),
            allLinks: document.querySelectorAll('a').length,
            productLinks: document.querySelectorAll('a[href*="/t/"]').length
        };
    });
    
    console.log(`   📊 Page info: ${pageInfo.totalImages} images, ${pageInfo.nikeImages} nike images, ${pageInfo.productLinks} product links`);
    if (pageInfo.sampleImgSrcs.length > 0) {
        console.log('   📸 Sample Nike images on page:');
        pageInfo.sampleImgSrcs.forEach((img, i) => {
            console.log(`      ${i + 1}. src: ${img.src}`);
            if (img.dataSrc) console.log(`         data-src: ${img.dataSrc}`);
        });
    }
    
    const products = await page.evaluate(() => {
        const items = [];
        
        // Nike product card selectors (2025/2026 layout)
        const cardSelectors = [
            '[data-testid="product-card"]',
            '.product-card',
            '[class*="product-card"]',
            'article[class*="product"]',
            'div[class*="ProductCard"]',
            // Broader selectors
            'a[href*="/t/"]'
        ];
        
        let cards = [];
        for (const sel of cardSelectors) {
            cards = document.querySelectorAll(sel);
            if (cards.length > 3) break;
        }
        
        // If still no cards, try to find product containers by looking at link groups
        if (cards.length === 0) {
            // Find all product links and get their parent containers
            const productLinks = document.querySelectorAll('a[href*="/t/"]');
            const containers = new Set();
            productLinks.forEach(link => {
                // Go up 2-3 levels to find the product card container
                let parent = link.parentElement;
                for (let i = 0; i < 3 && parent; i++) {
                    if (parent.querySelector('img') && parent.textContent.includes('€')) {
                        containers.add(parent);
                        break;
                    }
                    parent = parent.parentElement;
                }
            });
            cards = Array.from(containers);
        }
        
        cards.forEach(card => {
            try {
                // Name - try multiple approaches
                let name = null;
                const nameSelectors = [
                    '[class*="product-card__title"]',
                    '[data-testid*="title"]', 
                    'h3', 'h2',
                    '[class*="ProductCard__Title"]',
                    '[class*="product-name"]',
                    '[class*="title"]'
                ];
                for (const sel of nameSelectors) {
                    const el = card.querySelector(sel);
                    if (el?.textContent?.trim().length > 2) {
                        name = el.textContent.trim();
                        break;
                    }
                }
                if (!name || name.length < 3) return;
                
                // Prices - get all price-like text
                let currentPriceText = null;
                let originalPriceText = null;
                
                // Get ALL text content and find EUR prices
                const cardText = card.textContent || '';
                const allPrices = cardText.match(/[\d]+[.,]\d{2}\s*€/g);
                
                if (allPrices && allPrices.length >= 2) {
                    // First price = current (sale), second = original
                    currentPriceText = allPrices[0];
                    originalPriceText = allPrices[1];
                } else if (allPrices && allPrices.length === 1) {
                    currentPriceText = allPrices[0];
                }
                
                // Discount text
                let discountText = null;
                const discMatch = cardText.match(/(\d+)\s*%\s*(de réduction|off|reduction)/i);
                if (discMatch) discountText = discMatch[1];
                
                // IMAGE — Try EVERYTHING to get the image
                let image = null;
                
                // Try 1: Direct img tags
                const allImgs = card.querySelectorAll('img');
                for (const img of allImgs) {
                    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                    if (src && src.includes('static.nike.com') && !src.includes('data:')) {
                        image = src;
                        break;
                    }
                }
                
                // Try 2: Any img with src
                if (!image) {
                    for (const img of allImgs) {
                        const src = img.src;
                        if (src && src.startsWith('http') && !src.includes('data:') && !src.includes('svg')) {
                            image = src;
                            break;
                        }
                    }
                }
                
                // Try 3: srcset
                if (!image) {
                    for (const img of allImgs) {
                        const srcset = img.getAttribute('srcset');
                        if (srcset) {
                            const firstUrl = srcset.split(',')[0]?.trim().split(' ')[0];
                            if (firstUrl && firstUrl.startsWith('http')) {
                                image = firstUrl;
                                break;
                            }
                        }
                    }
                }
                
                // Try 4: Background image
                if (!image) {
                    const bgEls = card.querySelectorAll('[style*="background"]');
                    for (const el of bgEls) {
                        const bgMatch = el.style.backgroundImage?.match(/url\("?([^")\s]+)"?\)/);
                        if (bgMatch && bgMatch[1].startsWith('http')) {
                            image = bgMatch[1];
                            break;
                        }
                    }
                }
                
                // Link
                let url = null;
                const linkEl = card.querySelector('a[href*="/t/"]') || card.querySelector('a[href*="/fr/"]');
                if (linkEl) {
                    url = linkEl.href;
                } else if (card.tagName === 'A') {
                    url = card.href;
                }
                
                items.push({
                    name,
                    currentPriceText,
                    originalPriceText,
                    discountText,
                    image,
                    url
                });
            } catch (e) {}
        });
        
        return items;
    });
    
    console.log(`   📦 DOM: Found ${products.length} products`);
    
    // Log sample with image info
    products.slice(0, 3).forEach((p, i) => {
        console.log(`      ${i + 1}. ${p.name?.substring(0, 40)} | img: ${p.image ? '✅ ' + p.image.substring(0, 60) : '❌ null'}`);
    });
    
    // Parse prices
    return products.map(p => {
        const currentPriceEUR = parseEurPrice(p.currentPriceText);
        const originalPriceEUR = parseEurPrice(p.originalPriceText);
        let discount = p.discountText ? parseInt(p.discountText) : 0;
        
        if (!discount && originalPriceEUR && currentPriceEUR && originalPriceEUR > currentPriceEUR) {
            discount = Math.round(((originalPriceEUR - currentPriceEUR) / originalPriceEUR) * 100);
        }
        
        return {
            name: p.name,
            currentPriceEUR,
            originalPriceEUR,
            discount,
            image: p.image,
            url: p.url,
            brand: 'Nike'
        };
    }).filter(p => p.currentPriceEUR && p.discount >= MIN_DISCOUNT);
}

// ═══════════════════════════════════════════
// FORMAT DEAL FOR SUPABASE
// ═══════════════════════════════════════════
function formatDeal(product) {
    if (!product.name || !product.currentPriceEUR) return null;
    
    const priceMAD = eurToMad(product.currentPriceEUR);
    const originalPriceMAD = eurToMad(product.originalPriceEUR);
    
    if (!priceMAD) return null;
    
    // Build external ID
    const externalId = product.styleColor 
        ? `nike-${product.styleColor}` 
        : `nike-${Buffer.from(product.name).toString('base64').substring(0, 20)}`;
    
    return {
        external_id: externalId,
        brand: 'Nike',
        title: product.name,
        price: priceMAD,
        original_price: originalPriceMAD || null,
        discount: product.discount || null,
        currency: 'MAD',
        image: product.image || null,
        url: product.url || null,
        source: 'nike',
        category: 'fashion',
        condition: 'new',
        in_stock: true,
        location: 'Morocco'
    };
}

// ═══════════════════════════════════════════
// SAVE TO SUPABASE
// ═══════════════════════════════════════════
async function saveToSupabase(deals) {
    console.log(`\n💾 Saving ${deals.length} deals to Supabase...`);
    
    let saved = 0, updated = 0, errors = 0;

    for (const deal of deals) {
        try {
            // Skip deals without a URL
            if (!deal.url) {
                console.log(`   ⚠️ Skipping deal without URL: ${deal.title?.substring(0, 30)}`);
                errors++;
                continue;
            }
            
            // Check if exists by URL
            let existing = null;
            try {
                const { data } = await supabase
                    .from('deals')
                    .select('id')
                    .eq('url', deal.url)
                    .maybeSingle();
                existing = data;
            } catch (e) {
                // URL check failed, try title match
                try {
                    const { data } = await supabase
                        .from('deals')
                        .select('id')
                        .ilike('title', deal.title)
                        .eq('source', 'nike')
                        .maybeSingle();
                    existing = data;
                } catch (e2) {}
            }

            if (existing) {
                const { error } = await supabase
                    .from('deals')
                    .update({
                        price: deal.price,
                        original_price: deal.original_price,
                        discount: deal.discount,
                        image: deal.image || undefined,
                        in_stock: deal.in_stock,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
                
                if (!error) {
                    updated++;
                } else {
                    console.log(`   ❌ Update error for "${deal.title?.substring(0, 30)}": ${error.message}`);
                    errors++;
                }
            } else {
                // Calculate hamza score
                let hamzaScore = 5;
                if (deal.discount >= 50) hamzaScore += 3;
                else if (deal.discount >= 30) hamzaScore += 2;
                else if (deal.discount >= 15) hamzaScore += 1;
                hamzaScore += 0.5; // Nike brand bonus
                hamzaScore = Math.min(10, hamzaScore);
                
                const insertData = {
                    ...deal,
                    hamza_score: hamzaScore,
                    is_hamza_deal: hamzaScore >= 7,
                    is_super_hamza: hamzaScore > 8,
                    scraped_at: new Date().toISOString()
                };
                
                const { error } = await supabase.from('deals').insert(insertData);
                if (!error) {
                    saved++;
                } else {
                    console.log(`   ❌ Insert error for "${deal.title?.substring(0, 30)}": ${error.message}`);
                    errors++;
                }
            }
        } catch (e) {
            console.log(`   ❌ Error: ${e.message}`);
            errors++;
        }
    }

    return { saved, updated, errors };
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
async function main() {
    const startTime = Date.now();
    
    // Delete old deals if requested
    if (DELETE_OLD) {
        console.log('🗑️  Deleting old Nike deals...');
        const { data } = await supabase.from('deals').select('id').eq('source', 'nike');
        if (data?.length) {
            await supabase.from('deals').delete().eq('source', 'nike');
            console.log(`   ✅ Deleted ${data.length} old Nike deals\n`);
        } else {
            console.log('   No old Nike deals to delete\n');
        }
    }
    
    // Launch browser
    console.log('🌐 Launching browser...');
    const browser = await chromium.launch({
        headless: false,
        slowMo: 50,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox'
        ]
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris'
    });
    
    const page = await context.newPage();
    
    try {
        // ── Method 1: API Interception ──
        let products = await scrapeViaAPI(page);
        console.log(`\n📊 API Interception result: ${products.length} products`);
        
        // ── Method 2: DOM Scraping (ALWAYS run to get images) ──
        console.log('\n   📸 Running DOM scraping to get images...');
        const domProducts = await scrapeViaDOM(page);
        console.log(`   📊 DOM scraping result: ${domProducts.length} products`);
        
        // Merge: fill in missing images from DOM products
        if (domProducts.length > 0) {
            // Build a map of DOM products by name for matching
            const domByName = new Map();
            for (const dp of domProducts) {
                if (dp.name) {
                    domByName.set(dp.name.toLowerCase().trim(), dp);
                }
            }
            
            // Fill in images for API products that have no image
            for (const p of products) {
                if (!p.image && p.name) {
                    const domMatch = domByName.get(p.name.toLowerCase().trim());
                    if (domMatch?.image) {
                        p.image = domMatch.image;
                    }
                }
            }
            
            // If API got 0 products, use DOM products entirely
            if (products.length === 0) {
                products = domProducts;
            } else {
                // Add DOM-only products not in API results
                const apiNames = new Set(products.map(p => p.name?.toLowerCase().trim()));
                for (const dp of domProducts) {
                    if (!apiNames.has(dp.name?.toLowerCase().trim())) {
                        products.push(dp);
                    }
                }
            }
        }
        
        // Deduplicate by name
        const uniqueMap = new Map();
        for (const p of products) {
            const key = p.name?.toLowerCase() || p.url;
            if (!uniqueMap.has(key) || (p.image && !uniqueMap.get(key).image)) {
                uniqueMap.set(key, p);
            }
        }
        let uniqueProducts = Array.from(uniqueMap.values());
        
        console.log(`\n📊 Unique products: ${uniqueProducts.length}`);
        
        // ── Skip products already in DB ──
        console.log('   🔍 Checking which products are already in database...');
        const { data: existingDeals } = await supabase
            .from('deals')
            .select('url, title')
            .eq('source', 'nike');
        
        const existingUrls = new Set((existingDeals || []).map(d => d.url).filter(Boolean));
        const existingTitles = new Set((existingDeals || []).map(d => d.title?.toLowerCase().trim()).filter(Boolean));
        
        const beforeCount = uniqueProducts.length;
        uniqueProducts = uniqueProducts.filter(p => {
            if (p.url && existingUrls.has(p.url)) return false;
            if (p.name && existingTitles.has(p.name.toLowerCase().trim())) return false;
            return true;
        });
        
        console.log(`   📊 Skipped ${beforeCount - uniqueProducts.length} already in DB, ${uniqueProducts.length} new products`);
        
        // Format deals — ONLY keep products with image AND url
        const deals = uniqueProducts
            .map(formatDeal)
            .filter(d => d !== null && d.image && d.url && d.url !== 'undefined')
            .slice(0, MAX_PRODUCTS);
        
        const withImages = deals.filter(d => d.image);
        const withoutImages = deals.filter(d => !d.image);
        
        console.log(`\n📋 Valid deals: ${deals.length}`);
        console.log(`   🖼️  With images: ${withImages.length}`);
        console.log(`   ❌ Without images: ${withoutImages.length}`);
        
        if (deals.length > 0) {
            // Show sample
            console.log('\n📋 Sample deals:');
            deals.slice(0, 8).forEach((d, i) => {
                const hasImg = d.image ? '🖼️' : '❌';
                console.log(`   ${hasImg} ${i + 1}. ${d.title?.slice(0, 50)}`);
                console.log(`      ${d.price} MAD (was ${d.original_price} MAD) — ${d.discount}% off`);
                if (d.image) console.log(`      Image: ${d.image.substring(0, 80)}...`);
            });
            
            // Save to Supabase
            const { saved, updated, errors } = await saveToSupabase(deals);
            
            // Summary
            const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
            
            console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                    👟 NIKE SCRAPE COMPLETE                            ║
╠═══════════════════════════════════════════════════════════════════════╣
║   📦 Total Products:    ${deals.length.toString().padEnd(45)}║
║   🖼️  With Images:      ${withImages.length.toString().padEnd(45)}║
║   ✨ New Deals:         ${saved.toString().padEnd(45)}║
║   🔄 Updated:           ${updated.toString().padEnd(45)}║
║   ❌ Errors:            ${errors.toString().padEnd(45)}║
║   ⏱️  Duration:         ${duration} minutes${' '.repeat(Math.max(0, 38 - duration.length))}║
╚═══════════════════════════════════════════════════════════════════════╝
`);
        } else {
            console.log('\n⚠️ No valid deals found!');
            console.log('   This might be a scraping issue. Try:');
            console.log('   1. Run with browser visible to check for CAPTCHA');
            console.log('   2. Check if Nike changed their page structure');
            console.log('   3. Try a different VPN/proxy\n');
        }
        
    } catch (error) {
        console.error('\n💥 Fatal error:', error.message);
        console.error(error.stack);
    } finally {
        await browser.close();
    }
    
    process.exit(0);
}

if (require.main === module) {
    main().catch(console.error);
}
