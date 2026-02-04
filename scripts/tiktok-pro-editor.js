/**
 * 🎬 L'HAMZA - PRO TikTok Video Editor
 * Creates viral TikTok videos with:
 * - Animated intro
 * - Product slideshow
 * - Music sync
 * - Text overlays
 * - Professional transitions
 */

require('dotenv').config();
const { createCanvas, loadImage, registerFont } = require('canvas');
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const OUTPUT_DIR = path.join(__dirname, '..', 'tiktok-pro');
const FRAMES_DIR = path.join(OUTPUT_DIR, 'frames');
const TEMP_DIR = path.join(OUTPUT_DIR, 'temp');

// Ensure directories exist
[OUTPUT_DIR, FRAMES_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Config
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

// Download image helper
async function downloadImage(url) {
  return new Promise((resolve) => {
    if (!url || url.startsWith('data:')) return resolve(null);
    
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => resolve(null), 8000);
    
    try {
      protocol.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000
      }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          clearTimeout(timeout);
          return downloadImage(response.headers.location).then(resolve);
        }
        if (response.statusCode !== 200) {
          clearTimeout(timeout);
          return resolve(null);
        }
        
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', async () => {
          clearTimeout(timeout);
          try {
            const img = await loadImage(Buffer.concat(chunks));
            resolve(img);
          } catch (e) { resolve(null); }
        });
        response.on('error', () => { clearTimeout(timeout); resolve(null); });
      }).on('error', () => { clearTimeout(timeout); resolve(null); });
    } catch (e) { clearTimeout(timeout); resolve(null); }
  });
}

// Helper for rounded rectangles
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Create animated intro frames (2 seconds = 60 frames)
async function createIntroFrames() {
  console.log('🎬 Creating intro animation...');
  const introFrames = FPS * 2; // 2 seconds
  
  for (let frame = 0; frame < introFrames; frame++) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const progress = frame / introFrames;
    
    // Animated gradient background
    const hue = (progress * 30) % 360;
    const gradient = ctx.createRadialGradient(
      WIDTH / 2, HEIGHT / 2, 0,
      WIDTH / 2, HEIGHT / 2, HEIGHT
    );
    gradient.addColorStop(0, `hsl(${25 + hue}, 100%, 50%)`);
    gradient.addColorStop(0.5, `hsl(${15 + hue}, 90%, 40%)`);
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Animated particles/sparks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2 + progress * Math.PI * 4;
      const radius = 200 + Math.sin(progress * Math.PI * 2 + i) * 100 + progress * 400;
      const x = WIDTH / 2 + Math.cos(angle) * radius;
      const y = HEIGHT / 2 + Math.sin(angle) * radius;
      const size = 3 + Math.random() * 5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Logo animation - zoom in and pulse
    const scale = 0.5 + progress * 0.5 + Math.sin(progress * Math.PI * 4) * 0.05;
    const logoAlpha = Math.min(1, progress * 2);
    
    ctx.save();
    ctx.globalAlpha = logoAlpha;
    ctx.translate(WIDTH / 2, HEIGHT / 2 - 100);
    ctx.scale(scale, scale);
    
    // Fire emojis rotating
    ctx.font = '120px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🔥', -200, 0);
    ctx.fillText('🔥', 200, 0);
    
    // L'HAMZA text with glow
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 30 + Math.sin(progress * Math.PI * 6) * 10;
    ctx.font = 'bold 140px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText("L'HAMZA", 0, 50);
    
    ctx.shadowBlur = 0;
    ctx.font = 'bold 50px Arial';
    ctx.fillStyle = '#ff6600';
    ctx.fillText('الهـمزة', 0, 130);
    
    ctx.restore();
    
    // Tagline fade in
    if (progress > 0.5) {
      const taglineAlpha = (progress - 0.5) * 2;
      ctx.globalAlpha = taglineAlpha;
      ctx.font = 'bold 45px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('أحسن العروض في المغرب 🇲🇦', WIDTH / 2, HEIGHT / 2 + 150);
    }
    
    // Save frame
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(FRAMES_DIR, `intro_${String(frame).padStart(4, '0')}.png`), buffer);
  }
  
  console.log(`   ✅ Created ${introFrames} intro frames`);
}

// Create deal slide frames (3 seconds per deal)
async function createDealFrames(deals) {
  console.log('📦 Creating deal slides...');
  let frameCount = 0;
  const framesPerDeal = FPS * 3; // 3 seconds per deal
  
  for (let d = 0; d < deals.length; d++) {
    const deal = deals[d];
    console.log(`   Processing deal ${d + 1}/${deals.length}: ${deal.title?.substring(0, 30)}...`);
    
    // Download product image
    const productImg = await downloadImage(deal.image);
    
    for (let frame = 0; frame < framesPerDeal; frame++) {
      const canvas = createCanvas(WIDTH, HEIGHT);
      const ctx = canvas.getContext('2d');
      const progress = frame / framesPerDeal;
      
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, '#ff6600');
      gradient.addColorStop(0.3, '#ff8533');
      gradient.addColorStop(1, '#cc4400');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      // Animated stripes
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 30;
      const stripeOffset = frame * 3;
      for (let i = -HEIGHT; i < WIDTH + HEIGHT; i += 80) {
        ctx.beginPath();
        ctx.moveTo(i + stripeOffset, 0);
        ctx.lineTo(i + HEIGHT + stripeOffset, HEIGHT);
        ctx.stroke();
      }
      ctx.restore();
      
      // Top bar with L'HAMZA
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, WIDTH, 120);
      ctx.font = 'bold 50px Arial';
      ctx.fillStyle = '#ff6600';
      ctx.textAlign = 'center';
      ctx.fillText("🔥 L'HAMZA 🔥", WIDTH / 2, 80);
      
      // Deal card - slides in from right
      const cardX = progress < 0.1 ? WIDTH - (progress / 0.1) * (WIDTH - 60) : 60;
      const cardY = 180;
      const cardW = WIDTH - 120;
      const cardH = 1400;
      
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      roundRect(ctx, cardX, cardY, cardW, cardH, 30);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Source badge with pulse
      const pulseScale = 1 + Math.sin(progress * Math.PI * 8) * 0.05;
      ctx.save();
      ctx.translate(cardX + 80, cardY + 60);
      ctx.scale(pulseScale, pulseScale);
      ctx.fillStyle = '#ff6600';
      roundRect(ctx, -60, -25, 140, 50, 25);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(deal.source || 'PROMO', 10, 10);
      ctx.restore();
      
      // Discount badge - bouncing
      const bounceY = Math.abs(Math.sin(progress * Math.PI * 4)) * 20;
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(cardX + cardW - 100, cardY + 80 - bounceY, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 45px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`-${deal.discount || 50}%`, cardX + cardW - 100, cardY + 95 - bounceY);
      
      // Product image with zoom effect
      const imgSize = 500;
      const imgX = cardX + (cardW - imgSize) / 2;
      const imgY = cardY + 130;
      const imgScale = 1 + progress * 0.05;
      
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, imgX, imgY, imgSize, imgSize, 20);
      ctx.clip();
      
      if (productImg) {
        const scale = Math.max(imgSize / productImg.width, imgSize / productImg.height) * imgScale;
        const newW = productImg.width * scale;
        const newH = productImg.height * scale;
        const offX = imgX + (imgSize - newW) / 2;
        const offY = imgY + (imgSize - newH) / 2;
        ctx.drawImage(productImg, offX, offY, newW, newH);
      } else {
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(imgX, imgY, imgSize, imgSize);
        ctx.fillStyle = '#999';
        ctx.font = '100px Arial';
        ctx.fillText('📦', imgX + imgSize/2, imgY + imgSize/2 + 30);
      }
      ctx.restore();
      
      // Product title
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 38px Arial';
      ctx.textAlign = 'center';
      const title = (deal.title || 'Super Deal').substring(0, 40);
      ctx.fillText(title, cardX + cardW/2, cardY + 700);
      
      // Prices section
      const priceY = cardY + 800;
      
      // Old price with strikethrough
      if (deal.old_price) {
        ctx.fillStyle = '#999999';
        ctx.font = '40px Arial';
        const oldText = `${deal.old_price} MAD`;
        ctx.fillText(oldText, cardX + cardW/2, priceY);
        const tw = ctx.measureText(oldText).width;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cardX + cardW/2 - tw/2, priceY - 5);
        ctx.lineTo(cardX + cardW/2 + tw/2, priceY - 5);
        ctx.stroke();
      }
      
      // New price - BIG with pulse
      const priceScale = 1 + Math.sin(progress * Math.PI * 6) * 0.08;
      ctx.save();
      ctx.translate(cardX + cardW/2, priceY + 80);
      ctx.scale(priceScale, priceScale);
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 80px Arial';
      ctx.fillText(`${deal.price || '???'} MAD`, 0, 0);
      ctx.restore();
      
      // Savings
      if (deal.old_price && deal.price) {
        const savings = deal.old_price - deal.price;
        if (savings > 0) {
          ctx.fillStyle = '#00aa00';
          ctx.font = 'bold 35px Arial';
          ctx.fillText(`💰 وفر ${savings} درهم!`, cardX + cardW/2, priceY + 160);
        }
      }
      
      // Urgency bar at bottom
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(cardX + 50, cardY + cardH - 120, cardW - 100, 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('⚡ عرض محدود - اشري دابا! ⚡', cardX + cardW/2, cardY + cardH - 78);
      
      // Progress indicator
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (let i = 0; i < deals.length; i++) {
        ctx.beginPath();
        ctx.arc(WIDTH/2 - (deals.length - 1) * 15 + i * 30, HEIGHT - 180, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(WIDTH/2 - (deals.length - 1) * 15 + d * 30, HEIGHT - 180, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Bottom CTA
      ctx.fillStyle = '#00cc00';
      roundRect(ctx, 100, HEIGHT - 130, WIDTH - 200, 70, 35);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 35px Arial';
      ctx.fillText('🔗 lhamza.vercel.app', WIDTH/2, HEIGHT - 82);
      
      // Save frame
      const globalFrame = 60 + frameCount; // After intro
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(
        path.join(FRAMES_DIR, `deal_${String(globalFrame).padStart(4, '0')}.png`),
        buffer
      );
      frameCount++;
    }
  }
  
  console.log(`   ✅ Created ${frameCount} deal frames`);
  return frameCount;
}

// Create outro frames (2 seconds)
async function createOutroFrames(startFrame) {
  console.log('🎬 Creating outro animation...');
  const outroFrames = FPS * 2;
  
  for (let frame = 0; frame < outroFrames; frame++) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const progress = frame / outroFrames;
    
    // Background
    const gradient = ctx.createRadialGradient(WIDTH/2, HEIGHT/2, 0, WIDTH/2, HEIGHT/2, HEIGHT);
    gradient.addColorStop(0, '#ff6600');
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Logo zoom out
    const scale = 1.5 - progress * 0.5;
    ctx.save();
    ctx.translate(WIDTH/2, HEIGHT/2 - 200);
    ctx.scale(scale, scale);
    ctx.font = 'bold 120px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 30;
    ctx.fillText("L'HAMZA", 0, 0);
    ctx.restore();
    
    // Follow CTA
    ctx.globalAlpha = Math.min(1, progress * 3);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px Arial';
    ctx.fillText('@lhameza4', WIDTH/2, HEIGHT/2 + 50);
    
    ctx.font = 'bold 45px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.fillText('تابعنا للمزيد! 🔔', WIDTH/2, HEIGHT/2 + 150);
    
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Link f Bio! 📲', WIDTH/2, HEIGHT/2 + 230);
    
    // Save frame
    const globalFrame = startFrame + frame;
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(
      path.join(FRAMES_DIR, `outro_${String(globalFrame).padStart(4, '0')}.png`),
      buffer
    );
  }
  
  console.log(`   ✅ Created ${outroFrames} outro frames`);
}

// Compile video with FFmpeg
async function compileVideo(totalFrames, musicPath) {
  console.log('🎥 Compiling video with FFmpeg...');
  
  // Combine all frames into one sequence
  const allFrames = fs.readdirSync(FRAMES_DIR).filter(f => f.endsWith('.png')).sort();
  allFrames.forEach((file, i) => {
    const oldPath = path.join(FRAMES_DIR, file);
    const newPath = path.join(TEMP_DIR, `frame_${String(i).padStart(5, '0')}.png`);
    fs.copyFileSync(oldPath, newPath);
  });
  
  const outputPath = path.join(OUTPUT_DIR, `lhamza-viral-${Date.now()}.mp4`);
  
  let ffmpegCmd = `ffmpeg -y -framerate ${FPS} -i "${TEMP_DIR}/frame_%05d.png"`;
  
  if (musicPath && fs.existsSync(musicPath)) {
    ffmpegCmd += ` -i "${musicPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k -shortest`;
  } else {
    ffmpegCmd += ` -c:v libx264 -preset fast -crf 23`;
  }
  
  ffmpegCmd += ` -pix_fmt yuv420p "${outputPath}"`;
  
  try {
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log(`\n✅ Video created: ${outputPath}`);
    return outputPath;
  } catch (e) {
    console.error('❌ FFmpeg error:', e.message);
    return null;
  }
}

// Cleanup temp files
function cleanup() {
  console.log('🧹 Cleaning up temp files...');
  [FRAMES_DIR, TEMP_DIR].forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        fs.unlinkSync(path.join(dir, file));
      });
    }
  });
}

// Main function
async function createViralVideo(options = {}) {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🎬 L'HAMZA PRO TikTok Video Editor 🎬                    ║
║  ═══════════════════════════════════════════════════════  ║
║  Creates viral TikTok videos automatically!               ║
╚═══════════════════════════════════════════════════════════╝
`);

  const category = options.category || 'all';
  const numDeals = options.numDeals || 5;
  const musicPath = options.music || 'C:\\Users\\dell\\Downloads\\Stormy-Moon-(TrendyBeatz.com).mp3';

  // Cleanup previous frames
  cleanup();

  // Fetch top deals
  console.log(`\n📊 Fetching top ${numDeals} deals...`);
  let query = supabase
    .from('deals')
    .select('*')
    .gte('discount', 25)
    .not('image', 'is', null)
    .order('discount', { ascending: false })
    .limit(numDeals);
  
  if (category !== 'all') {
    query = query.ilike('category', `%${category}%`);
  }
  
  const { data: deals, error } = await query;
  
  if (error || !deals?.length) {
    console.error('❌ No deals found!');
    return;
  }
  
  console.log(`   Found ${deals.length} deals`);

  // Create all frames
  await createIntroFrames();
  const dealFrameCount = await createDealFrames(deals);
  const outroStart = 60 + dealFrameCount;
  await createOutroFrames(outroStart);
  
  const totalFrames = outroStart + 60;
  console.log(`\n📊 Total frames: ${totalFrames} (${(totalFrames / FPS).toFixed(1)} seconds)`);

  // Compile video
  const videoPath = await compileVideo(totalFrames, musicPath);
  
  // Final cleanup
  cleanup();
  
  if (videoPath) {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ VIRAL VIDEO READY!                                    ║
╠═══════════════════════════════════════════════════════════╣
║  📁 Location: tiktok-pro/                                 ║
║  ⏱️  Duration: ${(totalFrames / FPS).toFixed(1)} seconds                                 ║
║  🎵 Music: ${musicPath ? 'Yes' : 'No'}                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
    
    // Open folder
    try {
      execSync(`start "" "${OUTPUT_DIR}"`);
    } catch (e) {}
  }
}

// Run
const args = process.argv.slice(2);
const options = {
  category: args.find(a => a.startsWith('--category='))?.split('=')[1] || 'all',
  numDeals: parseInt(args.find(a => a.startsWith('--deals='))?.split('=')[1]) || 5,
  music: args.find(a => a.startsWith('--music='))?.split('=')[1]
};

createViralVideo(options).catch(console.error);
