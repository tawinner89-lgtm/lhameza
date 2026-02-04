/**
 * L'HAMZA - Envoi des stats Telegram toutes les 12 heures
 * Lance le rapport complet (deals + visiteurs du jour) sur Telegram.
 *
 * Usage:
 *   node scripts/telegram-stats-cron.js
 *   npm run telegram:stats:cron
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SUPABASE_URL, SUPABASE_ANON_KEY
 */

require('dotenv').config();
const cron = require('node-cron');
const { sendFullReport } = require('./telegram-stats.js');

const CRON_12H = process.env.TELEGRAM_STATS_CRON || '0 */12 * * *'; // 00:00 et 12:00 chaque jour

console.log(`
╔═══════════════════════════════════════════════════════════╗
║  📊 L'HAMZA – Stats Telegram toutes les 12h               ║
╚═══════════════════════════════════════════════════════════╝
  Plan: ${CRON_12H} (toutes les 12 heures)
  Pour changer: TELEGRAM_STATS_CRON="0 */12 * * *"
`);

function run() {
  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' });
  console.log(`\n⏰ [${now}] Envoi du rapport...`);
  sendFullReport().catch(err => console.error('❌', err.message));
}

run();
cron.schedule(CRON_12H, run);

console.log('✅ Cron actif. Prochain envoi dans 12h (ou selon la planification).\n');
