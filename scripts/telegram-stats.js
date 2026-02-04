/**
 * L'HAMZA - Stats complètes vers Telegram
 * Envoie les statistiques du site (deals + visiteurs du jour) sur Telegram.
 * Peut tourner à la demande ou via le cron toutes les 12h.
 *
 * Usage:
 *   node scripts/telegram-stats.js
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SUPABASE_URL, SUPABASE_ANON_KEY
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8574872692:AAHleuZ01D7seyE-M0IKcCtF_Dit4NC2T9g';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6089762171';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function startOfTodayCasablanca() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', dateStyle: 'short' });
  const dateStr = formatter.format(now);
  return new Date(dateStr + 'T00:00:00.000Z');
}

async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
    const data = await response.json();
    if (data.ok) {
      console.log('✅ Message Telegram envoyé.');
    } else {
      console.error('❌ Telegram:', data.description);
    }
  } catch (error) {
    console.error('❌ Envoi:', error.message);
  }
}

async function getStats() {
  const { count: totalDeals } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true });

  const { count: superDeals } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('is_super_hamza', true);

  const { data: allDeals } = await supabase.from('deals').select('source');
  const bySource = {};
  (allDeals || []).forEach(d => {
    bySource[d.source] = (bySource[d.source] || 0) + 1;
  });

  const { data: catDeals } = await supabase.from('deals').select('category');
  const byCategory = {};
  (catDeals || []).forEach(d => {
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
  });

  const todayStart = startOfTodayCasablanca().toISOString();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let pageViewsToday = 0;
  let uniqueVisitorsToday = 0;
  let searchesToday = 0;
  let pageViews24h = 0;
  let searches24h = 0;

  try {
    const { count: pvToday } = await supabase
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'page_view')
      .gte('created_at', todayStart);
    pageViewsToday = pvToday || 0;

    const { data: sessionsToday } = await supabase
      .from('analytics')
      .select('session_id')
      .eq('event_type', 'page_view')
      .gte('created_at', todayStart)
      .not('session_id', 'is', null);
    const uniqueSessions = new Set((sessionsToday || []).map(r => r.session_id).filter(Boolean));
    uniqueVisitorsToday = uniqueSessions.size;

    const { count: searchToday } = await supabase
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'search')
      .gte('created_at', todayStart);
    searchesToday = searchToday || 0;

    const { count: pv24 } = await supabase
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'page_view')
      .gte('created_at', last24h);
    pageViews24h = pv24 || 0;

    const { count: sr24 } = await supabase
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'search')
      .gte('created_at', last24h);
    searches24h = sr24 || 0;
  } catch (e) {
    // table analytics peut ne pas exister
  }

  return {
    totalDeals: totalDeals || 0,
    superDeals: superDeals || 0,
    bySource,
    byCategory,
    pageViewsToday,
    uniqueVisitorsToday,
    searchesToday,
    pageViews24h,
    searches24h
  };
}

async function sendFullReport() {
  console.log('📊 Génération du rapport...');
  const stats = await getStats();
  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca', dateStyle: 'medium', timeStyle: 'short' });

  let msg = `🔥 <b>L'HAMZA – Statistiques complètes</b>\n`;
  msg += `📅 ${now}\n\n`;

  msg += `👥 <b>Visiteurs aujourd'hui</b>\n`;
  msg += `  • 👁️ Pages vues: <b>${stats.pageViewsToday}</b>\n`;
  msg += `  • 🧑 Visiteurs uniques: <b>${stats.uniqueVisitorsToday}</b>\n`;
  msg += `  • 🔍 Recherches: <b>${stats.searchesToday}</b>\n\n`;

  msg += `📦 <b>Deals</b>\n`;
  msg += `  • Total: <b>${stats.totalDeals}</b>\n`;
  msg += `  • ⭐ Super L'Hamza: <b>${stats.superDeals}</b>\n\n`;

  msg += `🏪 <b>Par source</b>\n`;
  Object.entries(stats.bySource)
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, count]) => { msg += `  • ${source}: ${count}\n`; });

  msg += `\n📁 <b>Par catégorie</b>\n`;
  Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => { msg += `  • ${cat}: ${count}\n`; });

  msg += `\n📈 <b>Dernières 24h</b>\n`;
  msg += `  • Visites: ${stats.pageViews24h} | Recherches: ${stats.searches24h}\n`;

  msg += `\n🔗 lhamza.vercel.app`;

  await sendTelegramMessage(msg);
}

if (require.main === module) {
  sendFullReport().catch(console.error);
}

module.exports = { sendFullReport, getStats };
