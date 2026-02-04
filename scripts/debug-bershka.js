/**
 * Debug Bershka page structure
 */
const { chromium } = require('playwright');

async function debug() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    console.log('Opening Bershka...');
    await page.goto('https://www.bershka.com/ma/femme/soldes-c1010378508.html', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
    });
    
    // Accept cookies
    try {
        const btn = await page.$('#onetrust-accept-btn-handler');
        if (btn) await btn.click();
    } catch(e) {}
    
    await page.waitForTimeout(5000);
    
    // Scroll
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(1500);
    }
    
    // Get links
    const links = await page.evaluate(() => {
        const allLinks = [];
        document.querySelectorAll('a[href]').forEach(a => {
            if (a.href.includes('bershka.com') && 
                !a.href.includes('login') && 
                !a.href.includes('newsletter')) {
                allLinks.push(a.href);
            }
        });
        return [...new Set(allLinks)];
    });
    
    console.log('\n📋 Bershka links found:');
    links.slice(0, 20).forEach((l, i) => console.log(`${i + 1}. ${l}`));
    
    console.log(`\n📊 Total: ${links.length} links`);
    
    // Find product pattern
    const productLinks = links.filter(l => l.match(/-c\d+\.html/) || l.match(/-l\d+/) || l.match(/-p\d+/));
    console.log(`\n🎯 Links with patterns (-c, -l, -p): ${productLinks.length}`);
    productLinks.slice(0, 10).forEach(l => console.log(`   ${l}`));
    
    // Check for price elements
    const priceEls = await page.evaluate(() => {
        const els = document.querySelectorAll('[class*="price"], [class*="money"]');
        return Array.from(els).slice(0, 10).map(el => ({
            tag: el.tagName,
            classes: el.className,
            text: el.textContent?.trim()?.slice(0, 100)
        }));
    });
    
    console.log('\n📋 Price elements:');
    priceEls.forEach((el, i) => {
        console.log(`${i + 1}. <${el.tag}> class="${el.classes}"`);
        console.log(`   Text: "${el.text}"`);
    });
    
    await page.waitForTimeout(60000);
    await browser.close();
}

debug();
