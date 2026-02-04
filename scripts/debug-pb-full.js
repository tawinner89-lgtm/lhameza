/**
 * Debug Pull&Bear - wait longer and trigger price loading
 */
const { chromium } = require('playwright');

async function debug() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 900 }
    });
    const page = await context.newPage();
    
    console.log('Opening page...');
    await page.goto('https://www.pullandbear.com/ma/homme/soldes/favoris-n7255', { 
        waitUntil: 'networkidle',  // Wait for network to be idle
        timeout: 90000 
    });
    
    // Accept cookies
    try {
        const btn = await page.$('#onetrust-accept-btn-handler');
        if (btn) await btn.click();
    } catch(e) {}
    
    console.log('Waiting 8 seconds for dynamic content...');
    await page.waitForTimeout(8000);
    
    // Scroll slowly and wait
    console.log('Scrolling slowly...');
    for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
        await page.waitForTimeout(2000);
    }
    
    // Move mouse over products to trigger hover states
    console.log('Hovering over products...');
    const tiles = await page.$$('.c-tile--product');
    for (let i = 0; i < Math.min(5, tiles.length); i++) {
        try {
            await tiles[i].hover();
            await page.waitForTimeout(1000);
        } catch(e) {}
    }
    
    // Wait more
    await page.waitForTimeout(3000);
    
    // Now check prices
    console.log('\n📋 Checking price containers...\n');
    const priceInfo = await page.evaluate(() => {
        const results = [];
        const tiles = document.querySelectorAll('.c-tile--product');
        
        tiles.forEach((tile, i) => {
            if (i >= 10) return;
            
            const priceContainer = tile.querySelector('.price-container');
            const allText = tile.textContent?.trim();
            
            // Look for any number patterns that could be prices
            const priceMatches = allText?.match(/\d+[\.,]?\d*\s*(MAD|DH|€)?/gi) || [];
            
            results.push({
                index: i,
                priceContainerHTML: priceContainer?.innerHTML?.slice(0, 200),
                priceContainerText: priceContainer?.textContent?.trim()?.slice(0, 100),
                fullText: allText?.slice(0, 150),
                foundNumbers: priceMatches.slice(0, 5)
            });
        });
        
        return results;
    });
    
    priceInfo.forEach(info => {
        console.log(`--- Product ${info.index + 1} ---`);
        console.log('Price container HTML:', info.priceContainerHTML || '(empty)');
        console.log('Price container text:', info.priceContainerText || '(empty)');
        console.log('Found numbers:', info.foundNumbers);
        console.log('');
    });
    
    // Check if there's any JSON data in the page
    console.log('\n📋 Looking for embedded JSON data...\n');
    const jsonData = await page.evaluate(() => {
        // Check for __NEXT_DATA__ or similar
        const scripts = document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]');
        const data = [];
        scripts.forEach(s => {
            try {
                const content = s.textContent?.slice(0, 500);
                if (content?.includes('price') || content?.includes('Price')) {
                    data.push(content);
                }
            } catch(e) {}
        });
        return data;
    });
    
    if (jsonData.length > 0) {
        console.log('Found JSON with price data:');
        jsonData.forEach(d => console.log(d.slice(0, 300)));
    } else {
        console.log('No embedded JSON data found with prices');
    }
    
    console.log('\n⏸️ Browser staying open for 60s for manual inspection...');
    await page.waitForTimeout(60000);
    await browser.close();
}

debug();
