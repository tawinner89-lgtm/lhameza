/**
 * L'HAMZA - TikTok Master Bot
 * Complete automation: Generate content + Send reminders at best times
 * 
 * Run: node scripts/tiktok-master.js
 */

const { spawn } = require('child_process');
const path = require('path');

// Config
const POSTING_TIMES = [12, 19, 21]; // Best times: 12h, 19h, 21h

console.log(`
╔═══════════════════════════════════════════════════╗
║        🔥 L'HAMZA TikTok Master Bot 🔥            ║
╠═══════════════════════════════════════════════════╣
║  Auto-generates content & reminds you to post     ║
║                                                   ║
║  📅 Posting times: 12:00, 19:00, 21:00           ║
║  📱 Reminders sent to Telegram                    ║
║  🎬 Content saved to: tiktok-content/             ║
╚═══════════════════════════════════════════════════╝
`);

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath], { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Script exited with code ${code}`));
    });
  });
}

async function generateAndRemind() {
  const now = new Date();
  const hour = now.getHours();
  const timeStr = now.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
  
  console.log(`\n⏰ [${timeStr}] Checking...`);
  
  if (POSTING_TIMES.includes(hour)) {
    console.log('🎬 Posting time! Generating content...\n');
    
    try {
      // Generate fresh content
      await runScript('tiktok-content.js');
      
      console.log('\n📱 Sending Telegram reminder...\n');
      
      // Send reminder
      await runScript('tiktok-reminder.js');
      
      console.log('\n✅ Done! Check Telegram & tiktok-content folder\n');
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

// Immediate check
generateAndRemind();

// Schedule hourly checks
console.log('⏳ Scheduler running... (Press Ctrl+C to stop)\n');
console.log('Next checks at: ' + POSTING_TIMES.map(h => `${h}:00`).join(', '));

setInterval(() => {
  const now = new Date();
  // Only run at the start of the hour
  if (now.getMinutes() === 0) {
    generateAndRemind();
  }
}, 60000); // Check every minute

// Keep alive
process.on('SIGINT', () => {
  console.log('\n\n👋 Bot stopped. Bye!');
  process.exit();
});
