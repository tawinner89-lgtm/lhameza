/**
 * L'HAMZA - TikTok Content Generator
 * Generates images and captions for TikTok posts
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// Config
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const OUTPUT_DIR = path.join(__dirname, '..', 'tiktok-content');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Moroccan colors
const COLORS = {
  red: '#C1272D',
  green: '#006233',
  orange: '#F97316',
  white: '#FFFFFF',
  black: '#1a1a1a',
  gray: '#666666'
};

// Hashtags
const HASHTAGS = [
  '#MarocDeals', '#SoldesMaroc', '#BonsPlansMaroc',
  '#JumiaMaroc', '#ZaraMaroc', '#AdidasMaroc',
  '#Shopping', '#Rkhis', '#Promotion',
  '#همزة', '#الهمزة', '#تخفيضات',
  '#Morocco', '#Casablanca', '#Rabat'
].join(' ');

/**
 * Download image from URL
 */
async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return await loadImage(Buffer.from(buffer));
  } catch (error) {
    console.log('   ⚠️ Could not load product image');
    return null;
  }
}

/**
 * Create deal image for TikTok (1080x1920 - 9:16 ratio)
 */
async function createDealImage(deal, index) {
  const width = 1080;
  const height = 1920;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#FF6B35');
  gradient.addColorStop(0.5, '#F7931E');
  gradient.addColorStop(1, '#FF6B35');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Logo text at top
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 70px Arial';
  ctx.textAlign = 'center';
  ctx.fillText("🔥 L'HAMZA", width / 2, 100);
  
  ctx.font = '35px Arial';
  ctx.fillText('الهمزة ف السلعة', width / 2, 160);

  // SUPER DEAL badge
  if (deal.discount >= 40) {
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.roundRect(width / 2 - 140, 190, 280, 55, 28);
    ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 32px Arial';
    ctx.fillText('🔥 SUPER DEAL', width / 2, 228);
  }

  // White card for product image
  const cardMargin = 50;
  const cardY = 280;
  const cardHeight = 1350;
  
  // Card shadow
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.roundRect(cardMargin, cardY, width - cardMargin * 2, cardHeight, 30);
  ctx.fill();
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Try to load product image
  let productImage = null;
  if (deal.image) {
    productImage = await downloadImage(deal.image);
  }

  // Product image area
  const imgAreaY = cardY + 20;
  const imgAreaHeight = 650;
  
  if (productImage) {
    // Draw product image
    const imgSize = Math.min(productImage.width, productImage.height);
    const scale = (width - cardMargin * 2 - 40) / imgSize;
    const imgWidth = productImage.width * scale * 0.8;
    const imgHeight = productImage.height * scale * 0.8;
    const imgX = (width - imgWidth) / 2;
    const imgY = imgAreaY + (imgAreaHeight - imgHeight) / 2;
    
    ctx.drawImage(productImage, imgX, imgY, imgWidth, imgHeight);
  } else {
    // Placeholder
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.roundRect(cardMargin + 20, imgAreaY, width - cardMargin * 2 - 40, imgAreaHeight, 20);
    ctx.fill();
    ctx.fillStyle = '#999';
    ctx.font = '40px Arial';
    ctx.fillText('📦 Product Image', width / 2, imgAreaY + imgAreaHeight / 2);
  }

  // Discount badge (top right of card)
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.arc(width - cardMargin - 60, cardY + 60, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 40px Arial';
  ctx.fillText(`-${deal.discount}%`, width - cardMargin - 60, cardY + 75);

  // Source badge (top left of card)
  ctx.fillStyle = COLORS.orange;
  ctx.beginPath();
  ctx.roundRect(cardMargin + 20, cardY + 20, 140, 42, 20);
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(deal.source.toUpperCase(), cardMargin + 40, cardY + 50);

  // Product title
  ctx.fillStyle = COLORS.black;
  ctx.font = 'bold 38px Arial';
  ctx.textAlign = 'center';
  const title = deal.title.length > 45 ? deal.title.substring(0, 42) + '...' : deal.title;
  
  // Word wrap title
  const words = title.split(' ');
  let line = '';
  let y = cardY + imgAreaHeight + 80;
  const maxWidth = width - cardMargin * 2 - 60;
  
  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), width / 2, y);
      line = word + ' ';
      y += 50;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), width / 2, y);

  // Prices
  y += 70;
  
  // Old price (crossed out)
  if (deal.original_price) {
    ctx.fillStyle = COLORS.gray;
    ctx.font = '32px Arial';
    const oldPriceText = `${deal.original_price.toFixed(0)} MAD`;
    ctx.fillText(oldPriceText, width / 2, y);
    
    // Strike through
    const textWidth = ctx.measureText(oldPriceText).width;
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width / 2 - textWidth / 2 - 10, y - 5);
    ctx.lineTo(width / 2 + textWidth / 2 + 10, y - 5);
    ctx.stroke();
    y += 55;
  }

  // New price
  ctx.fillStyle = COLORS.red;
  ctx.font = 'bold 65px Arial';
  ctx.fillText(`${deal.price.toFixed(0)} MAD`, width / 2, y);

  // CTA button
  y += 60;
  ctx.fillStyle = COLORS.green;
  ctx.beginPath();
  ctx.roundRect(cardMargin + 80, y, width - cardMargin * 2 - 160, 70, 35);
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 30px Arial';
  ctx.fillText('👉 lhamza.vercel.app', width / 2, y + 47);

  // Bottom branding
  ctx.fillStyle = COLORS.white;
  ctx.font = '32px Arial';
  ctx.fillText('📱 Link f Bio!', width / 2, height - 120);
  ctx.font = 'bold 38px Arial';
  ctx.fillText('@lhameza4', width / 2, height - 65);

  // Save image
  const filename = `deal-${index + 1}-${deal.source}-${Date.now()}.png`;
  const filepath = path.join(OUTPUT_DIR, filename);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filepath, buffer);
  
  return { filename, filepath };
}

/**
 * Generate caption for TikTok
 */
function generateCaption(deal) {
  const templates = [
    `🔥 WAAAW! ${deal.title.substring(0, 30)}... \n\n💰 Kant ${deal.original_price} DH → Daba ${deal.price} DH!\n📉 -${deal.discount}% DISCOUNT!\n\n${HASHTAGS}`,
    
    `😱 Chefti had deal?!\n\n${deal.title.substring(0, 40)}...\n✅ ${deal.price} DH gher!\n❌ Bla: ${deal.original_price} DH\n\n🔥 ${deal.discount}% OFF!\n\n${HASHTAGS}`,
    
    `🚨 ALERT DEAL! 🚨\n\n${deal.source.toUpperCase()}: ${deal.title.substring(0, 35)}...\n\n💸 ${deal.price} MAD (was ${deal.original_price})\n🏷️ Save ${deal.discount}%!\n\n${HASHTAGS}`,
    
    `3lach tkhles kter? 🤔\n\n${deal.title.substring(0, 40)}...\n\n✨ ${deal.price} DH\n🔻 -${deal.discount}%\n\n📲 Link f bio!\n\n${HASHTAGS}`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Main function
 */
async function generateContent() {
  console.log('🎬 L\'HAMZA TikTok Content Generator\n');
  
  // Fetch top deals (highest discounts)
  const { data: deals, error } = await supabase
    .from('deals')
    .select('*')
    .gte('discount', 30)
    .not('image', 'is', null)
    .order('discount', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error fetching deals:', error);
    return;
  }

  console.log(`📦 Found ${deals.length} top deals\n`);

  const results = [];

  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    console.log(`\n📸 Creating content for: ${deal.title.substring(0, 40)}...`);
    
    // Create image
    const { filename, filepath } = await createDealImage(deal, i);
    console.log(`   ✅ Image: ${filename}`);
    
    // Generate caption
    const caption = generateCaption(deal);
    
    // Save caption
    const captionFile = filepath.replace('.png', '.txt');
    fs.writeFileSync(captionFile, caption);
    console.log(`   ✅ Caption saved`);
    
    results.push({
      deal: deal.title,
      image: filename,
      discount: deal.discount
    });
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📁 Content saved to: ' + OUTPUT_DIR);
  console.log('='.repeat(50));
  console.log('\n📋 Generated:');
  results.forEach((r, i) => {
    console.log(`   ${i + 1}. [${r.discount}% OFF] ${r.deal.substring(0, 35)}...`);
  });
  
  console.log('\n🎯 Next steps:');
  console.log('   1. Open folder: tiktok-content/');
  console.log('   2. Upload images to TikTok');
  console.log('   3. Copy captions from .txt files');
  console.log('   4. Post at 12h-14h or 19h-22h');
}

// Run
generateContent();
