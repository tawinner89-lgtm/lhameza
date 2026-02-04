/**
 * L'HAMZA - TikTok Posting Reminder
 * Sends Telegram reminder at best posting times with ready content
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Telegram Config
const TELEGRAM_BOT_TOKEN = '8574872692:AAHleuZ01D7seyE-M0IKcCtF_Dit4NC2T9g';
const TELEGRAM_CHAT_ID = '6089762171';

// Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Best posting times (Morocco time)
const BEST_TIMES = [
  { hour: 12, label: '🕛 Lunch Break' },
  { hour: 19, label: '🌆 After Work' },
  { hour: 21, label: '🌙 Prime Time' }
];

async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
    console.log('✅ Telegram sent!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function sendTelegramPhoto(photoPath, caption) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  const FormData = require('form-data');
  const form = new FormData();
  
  form.append('chat_id', TELEGRAM_CHAT_ID);
  form.append('photo', fs.createReadStream(photoPath));
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  
  try {
    await fetch(url, {
      method: 'POST',
      body: form
    });
    console.log('✅ Photo sent!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function getTopDeal() {
  const { data } = await supabase
    .from('deals')
    .select('*')
    .gte('discount', 40)
    .order('discount', { ascending: false })
    .limit(1);
  
  return data?.[0];
}

async function sendReminder() {
  const now = new Date();
  const hour = now.getHours();
  
  // Find matching time
  const timeSlot = BEST_TIMES.find(t => t.hour === hour);
  if (!timeSlot) {
    console.log('Not a posting time');
    return;
  }
  
  const deal = await getTopDeal();
  
  let message = `🎬 <b>TIKTOK POSTING TIME!</b>\n\n`;
  message += `${timeSlot.label}\n\n`;
  message += `📱 <b>Post Now for Maximum Reach!</b>\n\n`;
  
  if (deal) {
    message += `🔥 <b>Suggested Deal:</b>\n`;
    message += `${deal.title.substring(0, 40)}...\n`;
    message += `💰 ${deal.price} MAD (-${deal.discount}%)\n\n`;
  }
  
  message += `📁 Content ready in: tiktok-content/\n\n`;
  message += `<b>Steps:</b>\n`;
  message += `1. Open TikTok\n`;
  message += `2. Upload from tiktok-content/\n`;
  message += `3. Copy caption from .txt file\n`;
  message += `4. POST! 🚀`;
  
  await sendTelegramMessage(message);
  
  // Also send the latest generated image
  const contentDir = path.join(__dirname, '..', 'tiktok-content');
  if (fs.existsSync(contentDir)) {
    const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.png'));
    if (files.length > 0) {
      const latestFile = files[files.length - 1];
      const caption = `🎬 Ready to post!\n\n#TikTok #LHamza`;
      // Note: sendTelegramPhoto requires form-data package
      console.log('📸 Latest content:', latestFile);
    }
  }
}

// Check arguments
const args = process.argv.slice(2);

if (args.includes('--now') || args.includes('--test')) {
  // Send immediately (force)
  console.log('📱 Sending reminder now...');
  (async () => {
    const deal = await getTopDeal();
    
    let message = `🎬 <b>TIKTOK POSTING TIME!</b>\n\n`;
    message += `🕐 ${new Date().toLocaleTimeString('fr-MA')}\n\n`;
    message += `📱 <b>Post Now for Maximum Reach!</b>\n\n`;
    
    if (deal) {
      message += `🔥 <b>Suggested Deal:</b>\n`;
      message += `${deal.title.substring(0, 40)}...\n`;
      message += `💰 ${deal.price} MAD (-${deal.discount}%)\n\n`;
    }
    
    message += `📁 Content ready in: tiktok-content/\n\n`;
    message += `<b>Steps:</b>\n`;
    message += `1. Open TikTok\n`;
    message += `2. Upload from tiktok-content/\n`;
    message += `3. Copy caption from .txt file\n`;
    message += `4. POST! 🚀`;
    
    await sendTelegramMessage(message);
  })();
} else if (args.includes('--schedule')) {
  // Run every hour and check if it's posting time
  console.log('⏰ Scheduler started...');
  console.log('Will send reminders at: 12:00, 19:00, 21:00');
  
  setInterval(async () => {
    const now = new Date();
    const minute = now.getMinutes();
    
    // Only check at the start of each hour
    if (minute === 0) {
      await sendReminder();
    }
  }, 60000); // Check every minute
  
  // Keep process alive
  console.log('Press Ctrl+C to stop');
} else {
  console.log(`
📱 TikTok Reminder Bot

Usage:
  node tiktok-reminder.js --now       Send reminder immediately
  node tiktok-reminder.js --schedule  Start scheduler (runs at 12h, 19h, 21h)

Best posting times for Morocco:
  🕛 12:00 - Lunch break
  🌆 19:00 - After work
  🌙 21:00 - Prime time
`);
}
