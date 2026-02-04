/**
 * L'HAMZA - TikTok Video Creator
 * Combines video + voiceover audio + text overlays
 * 
 * Usage: node scripts/create-tiktok-video.js --video "path/to/video.mp4" --audio "path/to/audio.mp3"
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Config
const OUTPUT_DIR = path.join(__dirname, '..', 'tiktok-videos');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Parse arguments
const args = process.argv.slice(2);
let videoPath = '';
let audioPath = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--video' && args[i + 1]) {
    videoPath = args[i + 1];
  }
  if (args[i] === '--audio' && args[i + 1]) {
    audioPath = args[i + 1];
  }
}

// Default paths if not provided
if (!videoPath) {
  // Look for WhatsApp video in Downloads
  const downloads = 'C:\\Users\\dell\\Downloads';
  const files = fs.readdirSync(downloads).filter(f => f.includes('WhatsApp') && f.endsWith('.mp4'));
  if (files.length > 0) {
    videoPath = path.join(downloads, files[files.length - 1]);
    console.log('📹 Found video:', files[files.length - 1]);
  }
}

if (!audioPath) {
  // Look for ElevenLabs audio in Downloads
  const downloads = 'C:\\Users\\dell\\Downloads';
  const files = fs.readdirSync(downloads).filter(f => f.includes('ElevenLabs') && f.endsWith('.mp3'));
  if (files.length > 0) {
    audioPath = path.join(downloads, files[files.length - 1]);
    console.log('🎤 Found audio:', files[files.length - 1]);
  }
}

if (!videoPath || !audioPath) {
  console.log(`
╔═══════════════════════════════════════════════════╗
║     🎬 L'HAMZA TikTok Video Creator               ║
╠═══════════════════════════════════════════════════╣
║  Creates TikTok-ready video with voiceover        ║
╚═══════════════════════════════════════════════════╝

Usage:
  node scripts/create-tiktok-video.js --video "video.mp4" --audio "audio.mp3"

Or place files in Downloads folder:
  - WhatsApp video (*.mp4)
  - ElevenLabs audio (*.mp3)

Then run without arguments.
`);
  process.exit(1);
}

console.log(`
╔═══════════════════════════════════════════════════╗
║     🎬 Creating TikTok Video...                   ║
╚═══════════════════════════════════════════════════╝
`);

console.log('📹 Video:', path.basename(videoPath));
console.log('🎤 Audio:', path.basename(audioPath));

const timestamp = Date.now();
const outputFile = path.join(OUTPUT_DIR, `lhamza-tiktok-${timestamp}.mp4`);

try {
  // Step 1: Get video duration
  console.log('\n⏱️  Analyzing video...');
  
  // Step 2: Combine video + audio
  // - Replace original audio with voiceover
  // - Add text overlay with "L'HAMZA" and website
  // - Resize to TikTok format (1080x1920)
  
  console.log('🎬 Combining video + audio...');
  
  const ffmpegCmd = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,drawtext=text='🔥 L\\'HAMZA':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=100:borderw=3:bordercolor=black,drawtext=text='lhamza.vercel.app':fontsize=40:fontcolor=orange:x=(w-text_w)/2:y=180:borderw=2:bordercolor=black,drawtext=text='Link f Bio!':fontsize=35:fontcolor=white:x=(w-text_w)/2:y=h-100:borderw=2:bordercolor=black[v]" -map "[v]" -map 1:a -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest "${outputFile}"`;

  execSync(ffmpegCmd, { stdio: 'inherit' });
  
  console.log('\n✅ Video created successfully!');
  console.log('📁 Output:', outputFile);
  
  // Open output folder
  console.log('\n📂 Opening folder...');
  execSync(`explorer "${OUTPUT_DIR}"`);
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  
  // Try simpler command without text overlay
  console.log('\n🔄 Trying simpler merge...');
  
  try {
    const simpleCmd = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "${outputFile}"`;
    execSync(simpleCmd, { stdio: 'inherit' });
    
    console.log('\n✅ Video created (without text overlay)');
    console.log('📁 Output:', outputFile);
    execSync(`explorer "${OUTPUT_DIR}"`);
    
  } catch (err) {
    console.error('❌ FFmpeg not installed or error:', err.message);
    console.log('\n💡 Install FFmpeg: winget install ffmpeg');
  }
}

console.log(`
╔═══════════════════════════════════════════════════╗
║  🎯 Next Steps:                                   ║
╠═══════════════════════════════════════════════════╣
║  1. Open video in tiktok-videos/ folder           ║
║  2. Upload to TikTok                              ║
║  3. Add trending music (optional)                 ║
║  4. Add hashtags and post!                        ║
╚═══════════════════════════════════════════════════╝
`);
