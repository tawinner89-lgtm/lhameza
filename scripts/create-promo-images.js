/**
 * L'HAMZA - Create FIRE Promo Images for TikTok
 * Creates eye-catching promotional images
 */

require('dotenv').config();
const { createCanvas, loadImage } = require('canvas');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const OUTPUT_DIR = path.join(__dirname, '..', 'tiktok-images');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Download image helper
async function downloadImage(url) {
  return new Promise((resolve) => {
    if (!url || url.startsWith('data:')) {
      resolve(null);
      return;
    }
    
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => resolve(null), 5000);
    
    try {
      protocol.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          clearTimeout(timeout);
          downloadImage(response.headers.location).then(resolve);
          return;
        }
        
        if (response.statusCode !== 200) {
          clearTimeout(timeout);
          resolve(null);
          return;
        }
        
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', async () => {
          clearTimeout(timeout);
          try {
            const buffer = Buffer.concat(chunks);
            const img = await loadImage(buffer);
            resolve(img);
          } catch (e) {
            resolve(null);
          }
        });
        response.on('error', () => {
          clearTimeout(timeout);
          resolve(null);
        });
      }).on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    } catch (e) {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

// Create a FIRE promo image
async function createFirePromoImage(deals, category, index) {
  // TikTok vertical format
  const width = 1080;
  const height = 1920;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Gradient background based on category
  const gradients = {
    'adidas': ['#000000', '#1a1a1a', '#333333'],
    'zara': ['#0a0a0a', '#1a1a1a', '#2a2a2a'],
    'makeup': ['#ff6b6b', '#ee5a5a', '#cc4444'],
    'default': ['#ff6600', '#ff8533', '#ffaa00']
  };
  
  const colors = gradients[category.toLowerCase()] || gradients.default;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.5, colors[1]);
  gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add diagonal stripes for dynamic effect
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 40;
  for (let i = -height; i < width + height; i += 100) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }
  ctx.restore();

  // FIRE emoji burst at top
  ctx.font = 'bold 80px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🔥🔥🔥', width / 2, 100);

  // L'HAMZA logo
  ctx.font = 'bold 70px Arial';
  ctx.fillStyle = '#ff6600';
  ctx.fillText("L'HAMZA", width / 2, 180);
  
  // Subtitle
  ctx.font = 'bold 35px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('أحسن العروض في المغرب', width / 2, 230);

  // Category banner
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 270, width, 80);
  ctx.font = 'bold 50px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  const categoryText = category.toUpperCase() + ' DEALS 🔥';
  ctx.fillText(categoryText, width / 2, 325);

  // Draw deals (up to 3)
  const dealHeight = 450;
  const startY = 380;
  
  for (let i = 0; i < Math.min(deals.length, 3); i++) {
    const deal = deals[i];
    const y = startY + (i * dealHeight);
    
    // Deal card background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    roundRect(ctx, 40, y, width - 80, dealHeight - 30, 20);
    ctx.fill();
    
    // Try to load product image
    const productImg = await downloadImage(deal.image);
    
    if (productImg) {
      // Draw product image
      const imgSize = 280;
      const imgX = 60;
      const imgY = y + 20;
      
      ctx.save();
      roundRect(ctx, imgX, imgY, imgSize, imgSize, 15);
      ctx.clip();
      
      // Calculate aspect ratio
      const scale = Math.max(imgSize / productImg.width, imgSize / productImg.height);
      const newWidth = productImg.width * scale;
      const newHeight = productImg.height * scale;
      const offsetX = imgX + (imgSize - newWidth) / 2;
      const offsetY = imgY + (imgSize - newHeight) / 2;
      
      ctx.drawImage(productImg, offsetX, offsetY, newWidth, newHeight);
      ctx.restore();
    } else {
      // Placeholder
      ctx.fillStyle = '#f0f0f0';
      roundRect(ctx, 60, y + 20, 280, 280, 15);
      ctx.fill();
      ctx.fillStyle = '#999';
      ctx.font = '60px Arial';
      ctx.fillText('📦', 170, y + 170);
    }
    
    // Discount badge - BIG and RED
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(width - 120, y + 80, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.fillText(`-${deal.discount || 50}%`, width - 120, y + 90);
    
    // Deal title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'left';
    const title = (deal.title || 'Super Deal').substring(0, 35);
    ctx.fillText(title, 360, y + 60);
    
    // Source badge
    ctx.fillStyle = '#ff6600';
    roundRect(ctx, 360, y + 80, 120, 35, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(deal.source || 'PROMO', 380, y + 105);
    
    // Prices
    // Old price (strikethrough)
    if (deal.old_price) {
      ctx.fillStyle = '#999999';
      ctx.font = '28px Arial';
      const oldPriceText = `${deal.old_price} MAD`;
      ctx.fillText(oldPriceText, 360, y + 160);
      // Strikethrough
      const textWidth = ctx.measureText(oldPriceText).width;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(360, y + 155);
      ctx.lineTo(360 + textWidth, y + 155);
      ctx.stroke();
    }
    
    // New price - BIG
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 50px Arial';
    ctx.fillText(`${deal.price || deal.new_price || '???'} MAD`, 360, y + 220);
    
    // Urgency text
    ctx.fillStyle = '#ff6600';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('⚡ عرض محدود - سارع!', 360, y + 260);
    
    // Savings
    if (deal.old_price && deal.price) {
      const savings = deal.old_price - deal.price;
      if (savings > 0) {
        ctx.fillStyle = '#00aa00';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`وفر ${savings} درهم! 💰`, 360, y + 300);
      }
    }
  }

  // Bottom CTA
  ctx.fillStyle = '#00cc00';
  roundRect(ctx, 80, height - 250, width - 160, 80, 40);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 35px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🔗 lhamza.vercel.app', width / 2, height - 195);

  // Username
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Arial';
  ctx.fillText('@lhameza4', width / 2, height - 100);
  
  ctx.font = '30px Arial';
  ctx.fillText('Link f Bio! 📲', width / 2, height - 50);

  // Save image
  const filename = `promo-${category}-${Date.now()}.png`;
  const filepath = path.join(OUTPUT_DIR, filename);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filepath, buffer);
  
  console.log(`✅ Created: ${filename}`);
  return filepath;
}

// Helper for rounded rectangles
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Main function
async function generatePromoImages() {
  console.log(`
╔═══════════════════════════════════════════════════╗
║  🔥 L'HAMZA - FIRE PROMO IMAGE GENERATOR 🔥      ║
╚═══════════════════════════════════════════════════╝
`);

  const categories = [
    { name: 'adidas', search: 'adidas' },
    { name: 'zara', search: 'zara' },
    { name: 'makeup', search: 'makeup,maquillage,beauty' }
  ];

  for (const cat of categories) {
    console.log(`\n📸 Generating ${cat.name.toUpperCase()} promo...`);
    
    // Fetch deals
    let query = supabase
      .from('deals')
      .select('*')
      .gte('discount', 20)
      .order('discount', { ascending: false })
      .limit(5);
    
    // Search by source or title
    if (cat.name === 'adidas') {
      query = query.or('source.ilike.%adidas%,title.ilike.%adidas%');
    } else if (cat.name === 'zara') {
      query = query.or('source.ilike.%zara%,title.ilike.%zara%');
    } else if (cat.name === 'makeup') {
      query = query.or('category.eq.beauty,title.ilike.%makeup%,title.ilike.%maquillage%');
    }
    
    const { data: deals, error } = await query;
    
    if (error) {
      console.error(`❌ Error fetching ${cat.name}:`, error.message);
      continue;
    }
    
    if (!deals || deals.length === 0) {
      console.log(`⚠️ No deals found for ${cat.name}`);
      continue;
    }
    
    console.log(`   Found ${deals.length} deals`);
    
    await createFirePromoImage(deals, cat.name, 0);
  }

  console.log(`
╔═══════════════════════════════════════════════════╗
║  ✅ DONE! Images saved in tiktok-images/          ║
╚═══════════════════════════════════════════════════╝
`);

  // Open folder
  const { execSync } = require('child_process');
  try {
    execSync(`start "" "${OUTPUT_DIR}"`);
  } catch (e) {}
}

generatePromoImages().catch(console.error);
