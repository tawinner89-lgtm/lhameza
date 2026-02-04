/**
 * L'HAMZA - TikTok Auto Poster (USE AT YOUR OWN RISK!)
 * 
 * ⚠️ WARNING: This may violate TikTok's Terms of Service
 * ⚠️ Your account could be banned
 * 
 * How it works:
 * 1. Opens a real browser (you stay logged in)
 * 2. You login ONCE manually
 * 3. Bot posts for you automatically
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Config - Use YOUR Chrome profile (already logged in!)
const CHROME_USER_DATA = 'C:\\Users\\dell\\AppData\\Local\\Google\\Chrome\\User Data';
const CHROME_PROFILE = 'Default'; // or 'Profile 1', 'Profile 2', etc.
const CONTENT_DIR = path.join(__dirname, '..', 'tiktok-content');

// Random delay to appear human
function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Get latest content
function getLatestContent() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('❌ No content found. Run: npm run tiktok');
    return null;
  }
  
  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.png'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    console.log('❌ No images found. Run: npm run tiktok');
    return null;
  }
  
  const imagePath = path.join(CONTENT_DIR, files[0]);
  const captionPath = imagePath.replace('.png', '.txt');
  
  let caption = '#LHamza #MarocDeals';
  if (fs.existsSync(captionPath)) {
    caption = fs.readFileSync(captionPath, 'utf8');
  }
  
  return { imagePath, caption };
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log(`
╔═══════════════════════════════════════════════════╗
║     🎬 L'HAMZA TikTok Auto Poster                 ║
╠═══════════════════════════════════════════════════╣
║  ⚠️  USE AT YOUR OWN RISK!                        ║
║  Your account may be banned by TikTok             ║
╚═══════════════════════════════════════════════════╝
`);

  // ⚠️ IMPORTANT: Close ALL Chrome windows first!
  console.log('⚠️  Make sure ALL Chrome windows are CLOSED!\n');
  console.log('🌐 Opening YOUR Chrome (with your TikTok login)...\n');
  
  const browser = await chromium.launchPersistentContext(CHROME_USER_DATA, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    args: [
      `--profile-directory=${CHROME_PROFILE}`,
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });
  
  // Hide automation detection
  await browser.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await browser.newPage();
  
  // Go to TikTok
  console.log('📱 Going to TikTok...');
  await page.goto('https://www.tiktok.com/');
  await randomDelay(2000, 3000);

  // Check if logged in
  await randomDelay(2000, 3000);
  const loginButton = await page.$('button[data-e2e="top-login-button"]');
  
  if (loginButton) {
    console.log('❌ Not logged in! Open Chrome normally and login to TikTok first.');
    console.log('   Then close Chrome and run this script again.\n');
    await browser.close();
    return;
  }
  
  console.log('✅ Already logged in to TikTok!\n');

  // Check for --login-only flag
  if (args.includes('--login-only')) {
    console.log('Login complete. Closing browser...');
    await browser.close();
    return;
  }

  // Get content to post
  const content = getLatestContent();
  if (!content) {
    await browser.close();
    return;
  }

  console.log('📸 Content ready:', path.basename(content.imagePath));
  console.log('📝 Caption length:', content.caption.length, 'chars\n');

  // Go to upload page
  console.log('📤 Going to upload page...');
  await page.goto('https://www.tiktok.com/creator-center/upload');
  await randomDelay(3000, 5000);

  // Wait for upload button
  console.log('⏳ Waiting for upload interface...');
  
  try {
    // Find file input
    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30000 });
    
    // Upload image/video
    console.log('📤 Uploading content...');
    await fileInput.setInputFiles(content.imagePath);
    await randomDelay(5000, 8000);

    // Wait for upload to process
    console.log('⏳ Processing upload...');
    await randomDelay(5000, 10000);

    // Find caption input
    const captionInput = await page.$('div[contenteditable="true"]');
    if (captionInput) {
      console.log('📝 Adding caption...');
      await captionInput.click();
      await randomDelay(500, 1000);
      
      // Type caption slowly like a human
      for (const char of content.caption.substring(0, 2200)) { // TikTok limit
        await page.keyboard.type(char, { delay: Math.random() * 50 + 20 });
      }
      await randomDelay(1000, 2000);
    }

    console.log(`
╔═══════════════════════════════════════════════════╗
║  ✅ CONTENT READY TO POST!                        ║
╠═══════════════════════════════════════════════════╣
║  Review the post in the browser, then:            ║
║                                                   ║
║  • Click "Post" to publish                        ║
║  • Or close browser to cancel                     ║
║                                                   ║
║  Press ENTER when done...                         ║
╚═══════════════════════════════════════════════════╝
`);

    // Wait for user confirmation
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 TikTok may have changed their interface.');
    console.log('Try uploading manually from the browser window.\n');
    
    // Wait for user to finish
    console.log('Press ENTER to close browser...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
  }

  await browser.close();
  console.log('\n👋 Done!');
}

main().catch(console.error);
