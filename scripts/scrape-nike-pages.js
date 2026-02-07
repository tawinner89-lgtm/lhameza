/**
 * L'HAMZA F SEL'A - Nike Page-by-Page Scraper 👟
 * 
 * Strategy: Visit individual product pages to get images + prices
 * 1. Load Nike sold page → collect all unique product links
 * 2. Check which links are NOT already in our database
 * 3. Visit each new product page → extract image, name, price
 * 4. Save to Supabase
 * 
 * Usage: node scripts/scrape-nike-pages.js
 * Options:
 *   --max 80      Max NEW products to scrape (default: 80)
 *   --skip 0      Skip first N links (default: 0, useful for batching)
 */

require('dotenv').config();
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
// Multiple Nike promo URLs to get more products
const NIKE_URLS = [
    'https://www.nike.com/fr/w?q=sold&vst=sold',
    'https://www.nike.com/fr/w/hommes-promotions-13jrmznik1',
    'https://www.nike.com/fr/w/femmes-promotions-13jrmz5e1x6',
    'https://www.nike.com/fr/w/enfants-promotions-13jrmzv4dh',
];
const NIKE_SOLD_URL = NIKE_URLS[0]; // Primary URL
const EUR_TO_MAD = 10.8;
const MIN_DISCOUNT = 10;
const args = process.argv.slice(2);
const getArg = (name, def) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
};
const MAX_NEW = parseInt(getArg('max', '80'));
const SKIP = parseInt(getArg('skip', '0'));

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║  👟 L'HAMZA - Nike Page-by-Page Scraper                               ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Step 1: Collect product links from sold page                         ║
║  Step 2: Visit each product page for image + price                    ║
║  Max New: ${MAX_NEW}  |  Skip: ${SKIP}  |  Min Discount: ${MIN_DISCOUNT}%
╚═══════════════════════════════════════════════════════════════════════╝
`);

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min = 800, max = 1500) { return delay(Math.floor(Math.random() * (max - min) + min)); }

function parseEurPrice(text) {
    if (!text) return null;
    const match = text.match(/([\d]+[.,]\d{2})\s*€/);
    if (!match) return null;
    return parseFloat(match[1].replace(',', '.'));
}

// ═══════════════════════════════════════════
// STEP 1: Collect product links
// ═══════════════════════════════════════════
async function collectProductLinks(page) {
    console.log('\n📡 Step 1: Collecting product links from multiple Nike pages...\n');
    
    const allLinks = new Set();
    
    for (const nikeUrl of NIKE_URLS) {
        console.log(`   🔗 Loading: ${nikeUrl.substring(0, 70)}...`);
        
        try {
            await page.goto(nikeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await delay(3000);
        } catch (e) {
            console.log(`      ⚠️ Timeout, continuing...`);
        }
        
        // Accept cookies (first page only)
        try {
            const btn = await page.$('button:has-text("Accepter"), [data-testid="dialog-accept-button"]');
            if (btn) { await btn.click(); await delay(2000); }
        } catch (e) {}
        
        // Scroll to load product links
        let lastCount = 0;
        let noChange = 0;
        
        for (let i = 0; i < 80; i++) {
            await page.evaluate(() => window.scrollBy({ top: 2000, behavior: 'instant' }));
            await delay(500 + Math.random() * 500);
            
            if (i % 10 === 0) {
                const count = await page.evaluate(() => {
                    const links = new Set();
                    document.querySelectorAll('a[href*="/t/"]').forEach(a => {
                        if (a.href.includes('/t/') && !a.href.includes('/w/')) links.add(a.href);
                    });
                    return links.size;
                });
                
                if (count > lastCount) {
                    lastCount = count;
                    noChange = 0;
                } else {
                    noChange++;
                    if (noChange >= 3) break;
                }
            }
        }
        
        // Collect links from this page
        const pageLinks = await page.evaluate(() => {
            const linkSet = new Set();
            document.querySelectorAll('a[href*="/t/"]').forEach(a => {
                const href = a.href;
                if (href.includes('/t/') && !href.includes('/w/')) {
                    const cleanUrl = href.split('#')[0].split('?')[0];
                    linkSet.add(cleanUrl);
                }
            });
            return Array.from(linkSet);
        });
        
        const newCount = pageLinks.filter(l => !allLinks.has(l)).length;
        pageLinks.forEach(l => allLinks.add(l));
        console.log(`      📊 ${pageLinks.length} links (${newCount} new) — total: ${allLinks.size}`);
        
        await delay(2000);
    }
    
    console.log(`\n   📊 Total unique product links from all pages: ${allLinks.size}`);
    return Array.from(allLinks);
}

// ═══════════════════════════════════════════
// STEP 2: Visit product pages
// ═══════════════════════════════════════════
async function scrapeProductPage(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Wait for price to appear (Nike loads prices dynamically)
        try {
            await page.waitForSelector('[data-testid="currentPrice-container"], [class*="product-price"], [class*="Price"]', { timeout: 8000 });
        } catch (e) {
            // Price might not appear for some products
        }
        
        await delay(1500 + Math.random() * 1000);
        
        const data = await page.evaluate(() => {
            // Title
            let title = null;
            const titleSels = [
                'h1#pdp_product_title',
                'h1[data-testid="product_title"]',
                '[data-testid="product-title"]',
                'h1'
            ];
            for (const sel of titleSels) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim().length > 2) {
                    title = el.textContent.trim();
                    break;
                }
            }
            
            // Subtitle (product type)
            const subtitleEl = document.querySelector('[data-testid="product_sub_title"], h2.headline-5');
            const subtitle = subtitleEl?.textContent?.trim() || null;
            
            // Image — Nike PDP has high-quality hero images
            let image = null;
            const imgSels = [
                '[data-testid="HeroImg"] img',
                '[data-testid="HeroImg"] picture img',
                '[data-testid="Image-Container"] img',
                'picture img[src*="static.nike.com"]',
                'img[src*="static.nike.com"]'
            ];
            for (const sel of imgSels) {
                const el = document.querySelector(sel);
                if (el) {
                    const src = el.src || el.getAttribute('data-src');
                    if (src && src.includes('nike.com') && !src.includes('data:')) {
                        image = src;
                        break;
                    }
                    // Try srcset
                    const srcset = el.getAttribute('srcset');
                    if (srcset) {
                        const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
                        const nikeUrl = urls.find(u => u.includes('nike.com'));
                        if (nikeUrl) { image = nikeUrl; break; }
                    }
                }
            }
            
            // Prices — try MANY different selectors and approaches
            let currentPrice = null;
            let originalPrice = null;
            let discountText = null;
            
            // Method 1: Nike's standard price container
            const priceSelectors = [
                '[data-testid="currentPrice-container"]',
                '[data-testid="product-price"]',
                '[class*="product-price"]',
                '[class*="ProductPrice"]',
                '#price-container',
                '[class*="css-"] [class*="css-"]' // Nike uses generated CSS class names
            ];
            
            for (const sel of priceSelectors) {
                const container = document.querySelector(sel);
                if (container) {
                    const text = container.textContent;
                    const prices = text.match(/([\d]+[.,]\d{2})\s*€/g);
                    if (prices && prices.length >= 2) {
                        currentPrice = prices[0];
                        originalPrice = prices[1];
                        break;
                    } else if (prices && prices.length === 1) {
                        currentPrice = prices[0];
                    }
                }
            }
            
            // Method 2: Look for specific current/original price elements
            if (!currentPrice || !originalPrice) {
                // Current price (the discounted one, usually not struck through)
                const currentEl = document.querySelector(
                    '[data-testid="currentPrice-container"] div:first-child, ' +
                    '[class*="product-price"] [class*="is--current"], ' +
                    '[class*="product-price"] > div:first-child'
                );
                if (currentEl) {
                    const m = currentEl.textContent.match(/([\d]+[.,]\d{2})\s*€/);
                    if (m) currentPrice = m[0];
                }
                
                // Original price (struck through)
                const origEl = document.querySelector(
                    '[data-testid="initialPrice-container"] div, del, s, ' +
                    '[class*="line-through"], [class*="was-price"], ' +
                    '[class*="product-price"] [class*="is--old"]'
                );
                if (origEl) {
                    const m = origEl.textContent.match(/([\d]+[.,]\d{2})\s*€/);
                    if (m) originalPrice = m[0];
                }
            }
            
            // Method 3: Scan the entire right side panel for prices
            if (!currentPrice) {
                // Nike PDP: prices are usually in the right panel
                const rightPanel = document.querySelector(
                    '[class*="product-info"], [class*="buying-tools"], ' + 
                    '[class*="right-column"], [class*="sidebar"]'
                ) || document.body;
                
                const text = rightPanel.textContent;
                const allPrices = [...text.matchAll(/([\d]+[.,]\d{2})\s*€/g)];
                
                if (allPrices.length >= 2) {
                    // Usually: first = current price, second = original
                    currentPrice = allPrices[0][0];
                    originalPrice = allPrices[1][0];
                } else if (allPrices.length === 1) {
                    currentPrice = allPrices[0][0];
                }
            }
            
            // Method 4: Look for "réduction" text
            const reductionEl = document.querySelector('[class*="discount"], [class*="reduction"], [class*="savings"]');
            if (reductionEl) {
                const m = reductionEl.textContent.match(/(\d+)\s*%/);
                if (m) discountText = m[1];
            }
            
            // Also check body text for "% de réduction"
            if (!discountText) {
                const bodyText = document.body.textContent;
                const discMatch = bodyText.match(/(\d+)\s*%\s*de\s*r[ée]duction/i);
                if (discMatch) discountText = discMatch[1];
            }
            
            // DEBUG: log what we found
            const debugInfo = {
                foundTitle: !!title,
                foundImage: !!image,
                foundCurrentPrice: !!currentPrice,
                foundOriginalPrice: !!originalPrice,
                foundDiscount: !!discountText,
                priceAreaText: (document.querySelector('[data-testid="currentPrice-container"], [class*="product-price"]')?.textContent || 'NOT_FOUND').substring(0, 100)
            };
            
            return { title, subtitle, image, currentPrice, originalPrice, discountText, debugInfo };
        });
        
        return data;
    } catch (e) {
        return null;
    }
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
async function main() {
    const startTime = Date.now();
    
    // Get existing Nike URLs from database
    console.log('🔍 Loading existing Nike deals from database...');
    const { data: existingDeals } = await supabase
        .from('deals')
        .select('url, title')
        .eq('source', 'nike');
    
    const existingUrls = new Set((existingDeals || []).map(d => d.url).filter(Boolean));
    const existingTitles = new Set((existingDeals || []).map(d => d.title?.toLowerCase().trim()).filter(Boolean));
    console.log(`   📊 Already have ${existingUrls.size} Nike deals in database\n`);
    
    // Launch browser
    console.log('🌐 Launching browser...');
    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris'
    });
    
    const page = await context.newPage();
    
    try {
        // Step 1: Collect product links
        const allLinks = await collectProductLinks(page);
        
        // Filter out already scraped — match by EXACT URL only
        const newLinks = allLinks.filter(link => !existingUrls.has(link));
        
        console.log(`\n   ✅ ${allLinks.length} total links → ${newLinks.length} new (not in DB)`);
        
        // Apply skip and max
        const linksToScrape = newLinks.slice(SKIP, SKIP + MAX_NEW);
        console.log(`   📋 Will scrape ${linksToScrape.length} product pages (skip: ${SKIP}, max: ${MAX_NEW})\n`);
        
        if (linksToScrape.length === 0) {
            console.log('⚠️ No new products to scrape! All links are already in database.');
            await browser.close();
            process.exit(0);
        }
        
        // Step 2: Visit each product page
        const products = [];
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < linksToScrape.length; i++) {
            const link = linksToScrape[i];
            const progress = `[${i + 1}/${linksToScrape.length}]`;
            
            process.stdout.write(`   ${progress} Visiting: ${link.substring(link.lastIndexOf('/t/'), link.lastIndexOf('/t/') + 40)}... `);
            
            const data = await scrapeProductPage(page, link);
            
            // Debug: show what we got for first 5 products
            if (data && i < 5) {
                console.log('');
                console.log(`      DEBUG: title=${data.title?.substring(0, 30)} | price=${data.currentPrice} | orig=${data.originalPrice} | disc=${data.discountText}`);
                if (data.debugInfo) {
                    console.log(`      DEBUG: priceArea: "${data.debugInfo.priceAreaText}"`);
                }
            }
            
            if (data && data.title && data.currentPrice) {
                const currentPriceEUR = parseEurPrice(data.currentPrice);
                const originalPriceEUR = parseEurPrice(data.originalPrice);
                
                let discount = data.discountText ? parseInt(data.discountText) : 0;
                if (!discount && originalPriceEUR && currentPriceEUR && originalPriceEUR > currentPriceEUR) {
                    discount = Math.round(((originalPriceEUR - currentPriceEUR) / originalPriceEUR) * 100);
                }
                
                if (discount >= MIN_DISCOUNT && currentPriceEUR) {
                    const priceMAD = Math.round(currentPriceEUR * EUR_TO_MAD);
                    const originalPriceMAD = originalPriceEUR ? Math.round(originalPriceEUR * EUR_TO_MAD) : null;
                    
                    // Build full display title
                    const fullTitle = data.subtitle 
                        ? `${data.title} - ${data.subtitle}` 
                        : data.title;
                    
                    products.push({
                        title: fullTitle,
                        price: priceMAD,
                        originalPrice: originalPriceMAD,
                        discount,
                        image: data.image,
                        url: link,
                        brand: 'Nike'
                    });
                    
                    const imgIcon = data.image ? '🖼️' : '❌';
                    console.log(`${imgIcon} ${fullTitle.substring(0, 40)} | ${priceMAD} MAD | -${discount}%`);
                    successCount++;
                } else {
                    console.log(`⏭️ Low discount (${discount}%) or no price`);
                }
            } else {
                console.log('❌ Failed to extract data');
                failCount++;
            }
            
            // Rate limiting — be nice to Nike
            await randomDelay(500, 1200);
        }
        
        console.log(`\n📊 Results: ${successCount} valid, ${failCount} failed\n`);
        
        // Step 3: Save to Supabase
        if (products.length > 0) {
            console.log(`💾 Saving ${products.length} new Nike deals to Supabase...\n`);
            
            let saved = 0, errors = 0;
            
            for (const p of products) {
                // Calculate hamza score
                let hamzaScore = 5;
                if (p.discount >= 50) hamzaScore += 3;
                else if (p.discount >= 30) hamzaScore += 2;
                else if (p.discount >= 15) hamzaScore += 1;
                hamzaScore += 0.5; // Nike brand bonus
                hamzaScore = Math.min(10, hamzaScore);
                
                const deal = {
                    external_id: `nike-${Buffer.from(p.url).toString('base64').substring(0, 24)}`,
                    brand: 'Nike',
                    title: p.title,
                    price: p.price,
                    original_price: p.originalPrice,
                    discount: p.discount,
                    currency: 'MAD',
                    image: p.image,
                    url: p.url,
                    source: 'nike',
                    category: 'fashion',
                    condition: 'new',
                    in_stock: true,
                    location: 'Morocco',
                    hamza_score: hamzaScore,
                    is_hamza_deal: hamzaScore >= 7,
                    is_super_hamza: hamzaScore > 8,
                    scraped_at: new Date().toISOString()
                };
                
                const { error } = await supabase.from('deals').insert(deal);
                if (!error) {
                    saved++;
                    const imgIcon = p.image ? '🖼️' : '❌';
                    console.log(`   ${imgIcon} ✅ ${p.title.substring(0, 45)} | -${p.discount}%`);
                } else {
                    errors++;
                    if (!error.message?.includes('duplicate')) {
                        console.log(`   ❌ Error: ${error.message?.substring(0, 60)}`);
                    }
                }
            }
            
            const withImages = products.filter(p => p.image).length;
            const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
            
            console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                    👟 NIKE PAGE SCRAPE COMPLETE                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║   📋 Pages Visited:    ${linksToScrape.length.toString().padEnd(45)}║
║   📦 Valid Products:   ${products.length.toString().padEnd(45)}║
║   🖼️  With Images:     ${withImages.toString().padEnd(45)}║
║   ✨ Saved to DB:      ${saved.toString().padEnd(45)}║
║   ❌ Errors:           ${errors.toString().padEnd(45)}║
║   ⏱️  Duration:        ${duration} min${' '.repeat(Math.max(0, 40 - duration.length))}║
║   📊 Total Nike in DB: ${(existingUrls.size + saved).toString().padEnd(45)}║
╚═══════════════════════════════════════════════════════════════════════╝
`);
        } else {
            console.log('⚠️ No valid products to save');
        }
        
    } catch (error) {
        console.error('\n💥 Fatal error:', error.message);
    } finally {
        await browser.close();
    }
    
    process.exit(0);
}

main().catch(console.error);
