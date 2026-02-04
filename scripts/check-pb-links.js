/**
 * Quick check of Pull&Bear links structure
 */
const { chromium } = require('playwright');

async function check() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    await page.goto('https://www.pullandbear.com/ma/homme/soldes/favoris-n7255', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
    });
    
    // Accept cookies
    try {
        const btn = await page.$('#onetrust-accept-btn-handler');
        if (btn) await btn.click();
    } catch(e) {}
    
    await page.waitForTimeout(5000);
    
    // Scroll a bit
    for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(1000);
    }
    
    // Get all links
    const links = await page.evaluate(() => {
        const allLinks = [];
        document.querySelectorAll('a[href]').forEach(a => {
            if (a.href.includes('pullandbear.com') && 
                !a.href.includes('login') && 
                !a.href.includes('newsletter')) {
                allLinks.push(a.href);
            }
        });
        return [...new Set(allLinks)];
    });
    
    console.log('\n📋 All Pull&Bear links on page:\n');
    links.slice(0, 30).forEach((link, i) => {
        console.log(`${i + 1}. ${link}`);
    });
    
    console.log(`\n📊 Total unique links: ${links.length}`);
    
    // Find patterns
    console.log('\n🔍 Link patterns:');
    const withP = links.filter(l => l.includes('-p') || l.includes('/p'));
    const withHtml = links.filter(l => l.includes('.html'));
    const withN = links.filter(l => l.match(/-n\d+/));
    
    console.log(`   Contains -p or /p: ${withP.length}`);
    console.log(`   Contains .html: ${withHtml.length}`);
    console.log(`   Contains -n[digits]: ${withN.length}`);
    
    if (withP.length > 0) {
        console.log('\n🎯 Links with -p or /p:');
        withP.slice(0, 10).forEach(l => console.log(`   ${l}`));
    }
    
    await page.waitForTimeout(60000);
    await browser.close();
}

check();
