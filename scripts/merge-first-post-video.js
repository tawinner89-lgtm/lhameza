/**
 * L'HAMZA - First Post Viral Video
 * Merge two videos into one professional TikTok/Reels video with branding.
 * Usage: node scripts/merge-first-post-video.js
 *    or: node scripts/merge-first-post-video.js --video1 "path1.mp4" --video2 "path2.mp4"
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, '..', 'tiktok-videos');
const W = 1080;
const H = 1920;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Parse args
const args = process.argv.slice(2);
let video1 = '';
let video2 = '';
let maxDuration = 0; // 0 = use full length

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--video1' && args[i + 1]) video1 = args[i + 1];
  if (args[i] === '--video2' && args[i + 1]) video2 = args[i + 1];
  if (args[i] === '--max' && args[i + 1]) maxDuration = parseInt(args[i + 1], 10) || 0;
}

// Default: Moroccan_Man from Downloads + lhamza-final-tiktok
const downloads = 'C:\\Users\\dell\\Downloads';
if (!video1) {
  const name = 'Moroccan_Man_s_Shocking_Discovery.mp4';
  const p = path.join(downloads, name);
  if (fs.existsSync(p)) video1 = p;
  else {
    const any = fs.readdirSync(downloads).filter(f => f.endsWith('.mp4') && f.includes('Moroccan'));
    if (any.length) video1 = path.join(downloads, any[0]);
  }
}
if (!video2) {
  video2 = path.join(__dirname, '..', 'tiktok-videos', 'lhamza-final-tiktok.mp4');
}

if (!video1 || !fs.existsSync(video1)) {
  console.error('❌ Video 1 not found. Use --video1 "path"');
  process.exit(1);
}
if (!video2 || !fs.existsSync(video2)) {
  console.error('❌ Video 2 not found. Use --video2 "path"');
  process.exit(1);
}

function getDuration(filePath) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8' }
    );
    return parseFloat(out.trim()) || 0;
  } catch (e) {
    return 0;
  }
}

function escapeFfmpegPath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
}

console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🎬 L'HAMZA - First Post Viral Video                      ║
╚═══════════════════════════════════════════════════════════╝
`);
console.log('📹 Video 1:', path.basename(video1));
console.log('📹 Video 2:', path.basename(video2));

const d1 = getDuration(video1);
const d2 = getDuration(video2);
console.log('⏱️  Duration 1:', d1.toFixed(1), 's | Duration 2:', d2.toFixed(1), 's');

const xfadeDuration = 0.5;
let trim1 = '';
let trim2 = '';
let duration1 = d1;
let duration2 = d2;

if (maxDuration > 0) {
  const half = (maxDuration - xfadeDuration) / 2;
  duration1 = Math.min(d1, half);
  duration2 = Math.min(d2, half);
  trim1 = `,trim=0:${duration1},setpts=PTS-STARTPTS`;
  trim2 = `,trim=0:${duration2},setpts=PTS-STARTPTS`;
}

const offset = duration1 - xfadeDuration;
const outName = `lhamza-first-post-viral-${Date.now()}.mp4`;
const outputFile = path.join(OUTPUT_DIR, outName);

// Scale + pad to 1080x1920 (vertical), then concat with xfade, then branding
const scalePad = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`;
// Use filter script file to avoid shell/quote issues with drawtext
// Use Unicode apostrophe U+2019 (') so no quote delimiter issues in filter
const brandText = "L\u2019HAMZA";
const filterParts = [
  `[0:v]${scalePad}${trim1}[v0]`,
  `[1:v]${scalePad}${trim2}[v1]`,
  `[v0][v1]xfade=transition=fade:duration=${xfadeDuration}:offset=${offset}[vx]`,
  `[vx]drawtext=text=${brandText}:fontsize=56:fontcolor=white:x=(w-text_w)/2:y=80:borderw=3:bordercolor=black`,
  `drawtext=text=lhamza.vercel.app:fontsize=38:fontcolor=orange:x=(w-text_w)/2:y=145:borderw=2:bordercolor=black`,
  `drawtext=text=Link_in_Bio:fontsize=34:fontcolor=white:x=(w-text_w)/2:y=h-90:borderw=2:bordercolor=black[v]`
];
const filterScriptPath = path.join(OUTPUT_DIR, `filter-${Date.now()}.txt`);
fs.writeFileSync(filterScriptPath, filterParts.join(','), 'utf8');
const cmd = `ffmpeg -y -i "${video1}" -i "${video2}" -filter_complex_script "${filterScriptPath}" -map "[v]" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p "${outputFile}"`;

console.log('\n🎬 Merging and adding branding...\n');

function cleanupFilterScript() {
  try {
    if (fs.existsSync(filterScriptPath)) fs.unlinkSync(filterScriptPath);
  } catch (e) {}
}

try {
  execSync(cmd, { stdio: 'inherit' });
  cleanupFilterScript();
  console.log('\n✅ Done!');
  console.log('📁', outputFile);
  try {
    execSync(`explorer "${OUTPUT_DIR}"`);
  } catch (e) {}
} catch (err) {
  cleanupFilterScript();
  console.error('\n❌ FFmpeg error:', err.message);
  console.log('\n💡 Fallback: simple concat without xfade...');
  const simpleParts = [
    `[0:v]${scalePad}${trim1}[v0]`,
    `[1:v]${scalePad}${trim2}[v1]`,
    `[v0][v1]concat=n=2:v=1:a=0[vx]`,
    `[vx]drawtext=text=${brandText}:fontsize=56:fontcolor=white:x=(w-text_w)/2:y=80:borderw=3:bordercolor=black`,
    `drawtext=text=lhamza.vercel.app:fontsize=38:fontcolor=orange:x=(w-text_w)/2:y=145:borderw=2:bordercolor=black[v]`
  ];
  const fallbackScript = path.join(OUTPUT_DIR, `filter-fallback-${Date.now()}.txt`);
  fs.writeFileSync(fallbackScript, simpleParts.join(','), 'utf8');
  const simpleCmd = `ffmpeg -y -i "${video1}" -i "${video2}" -filter_complex_script "${fallbackScript}" -map "[v]" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p "${outputFile}"`;
  try {
    execSync(simpleCmd, { stdio: 'inherit' });
    try { fs.unlinkSync(fallbackScript); } catch (e) {}
    console.log('\n✅ Done (simple concat)!');
    console.log('📁', outputFile);
    execSync(`explorer "${OUTPUT_DIR}"`);
  } catch (e2) {
    try { fs.unlinkSync(fallbackScript); } catch (e) {}
    console.error('❌', e2.message);
    process.exit(1);
  }
}
