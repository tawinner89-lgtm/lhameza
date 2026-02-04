/**
 * L'HAMZA - Cleanup broken links
 * Deletes deals whose URLs are confirmed broken (404/410 or "page not found" content).
 *
 * Usage:
 *   node scripts/cleanup-broken-links.js --source adidas --apply
 *
 * Options:
 *   --source adidas|nike|...   (default: adidas)
 *   --limit 500               (default: 500)
 *   --concurrency 3           (default: 3)
 *   --apply                   (if omitted => dry-run, no delete)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function getArgValue(flag, defaultValue) {
  const args = process.argv.slice(2);
  const i = args.indexOf(flag);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  const kv = args.find(a => a.startsWith(flag + '='));
  if (kv) return kv.split('=').slice(1).join('=');
  return defaultValue;
}

const source = (getArgValue('--source', 'adidas') || 'adidas').toLowerCase();
const limit = parseInt(getArgValue('--limit', '500'), 10) || 500;
const concurrency = Math.max(1, Math.min(10, parseInt(getArgValue('--concurrency', '3'), 10) || 3));
const apply = process.argv.includes('--apply');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function readBodySnippet(res, maxBytes = 8192) {
  try {
    if (!res.body || !res.body.getReader) return '';
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
      if (total >= maxBytes) break;
    }
    try {
      reader.cancel();
    } catch (_) {}
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
      if (offset >= total) break;
    }
    return new TextDecoder('utf-8').decode(merged);
  } catch (_) {
    return '';
  }
}

function isNotFoundContent(snippet) {
  if (!snippet) return false;
  const s = snippet.toLowerCase();
  // French / English common not-found messages
  return (
    s.includes('page introuvable') ||
    s.includes('cette page est introuvable') ||
    s.includes('page not found') ||
    s.includes('404') && s.includes('introuvable') ||
    s.includes('we can’t seem to find') ||
    s.includes('does not exist')
  );
}

async function checkUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
      signal: controller.signal,
    });

    if (res.status === 404 || res.status === 410) return { ok: false, reason: `HTTP ${res.status}` };
    if (res.status === 403 || res.status === 429) return { ok: null, reason: `HTTP ${res.status} (blocked)` };
    if (res.status >= 500) return { ok: null, reason: `HTTP ${res.status}` };

    // For 200/301/302 etc: sniff content for "not found"
    const snippet = await readBodySnippet(res, 8192);
    if (isNotFoundContent(snippet)) return { ok: false, reason: 'Not-found content' };

    return { ok: true, reason: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: null, reason: e.name === 'AbortError' ? 'timeout' : (e.message || 'fetch error') };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDeals() {
  const { data, error } = await supabase
    .from('deals')
    .select('id,title,url,source,discount,created_at')
    .eq('source', source)
    .not('url', 'is', null)
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function deleteDeals(ids) {
  // Delete in chunks to avoid URL size limits
  const chunkSize = 100;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error } = await supabase.from('deals').delete().in('id', chunk);
    if (error) throw error;
    deleted += chunk.length;
    await sleep(400);
  }
  return deleted;
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║ 🧹 Cleanup broken links (confirmed only)                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(`🔎 Source: ${source}`);
  console.log(`📦 Limit: ${limit}`);
  console.log(`⚙️  Concurrency: ${concurrency}`);
  console.log(`🧨 Mode: ${apply ? 'APPLY (DELETE)' : 'DRY-RUN (no delete)'}\n`);

  const deals = await fetchDeals();
  console.log(`📥 Loaded ${deals.length} deals from Supabase.\n`);
  if (!deals.length) return;

  const broken = [];
  const ok = [];
  const unknown = [];

  let idx = 0;
  async function worker(workerId) {
    while (true) {
      const i = idx++;
      if (i >= deals.length) return;
      const d = deals[i];
      const url = d.url;
      if (!url || typeof url !== 'string') continue;

      const res = await checkUrl(url);
      const prefix = `[${i + 1}/${deals.length}]`;
      if (res.ok === false) {
        broken.push({ ...d, reason: res.reason });
        console.log(`${prefix} ❌ BROKEN: ${res.reason} | ${d.title?.slice(0, 60) || d.id}`);
      } else if (res.ok === true) {
        ok.push(d);
        if ((i + workerId) % 25 === 0) {
          console.log(`${prefix} ✅ OK | ${d.title?.slice(0, 60) || d.id}`);
        }
      } else {
        unknown.push({ ...d, reason: res.reason });
        if ((i + workerId) % 20 === 0) {
          console.log(`${prefix} ⚠️  UNKNOWN: ${res.reason} | ${d.title?.slice(0, 50) || d.id}`);
        }
      }

      // Gentle rate limit
      await sleep(450 + Math.floor(Math.random() * 350));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, w) => worker(w + 1)));

  console.log('\n==================== SUMMARY ====================');
  console.log(`✅ OK:       ${ok.length}`);
  console.log(`❌ BROKEN:   ${broken.length}`);
  console.log(`⚠️  UNKNOWN:  ${unknown.length}`);

  if (broken.length) {
    console.log('\nTop broken (first 10):');
    broken.slice(0, 10).forEach((b, i) => {
      console.log(`  ${i + 1}. ${b.reason} | ${b.title?.slice(0, 80)} | ${b.url}`);
    });
  }

  if (!apply) {
    console.log('\n🧪 Dry-run finished. To delete confirmed broken links, run:');
    console.log(`   node scripts/cleanup-broken-links.js --source ${source} --apply`);
    return;
  }

  if (!broken.length) {
    console.log('\n✅ Nothing to delete.');
    return;
  }

  const ids = broken.map(b => b.id);
  console.log(`\n🗑️ Deleting ${ids.length} deals (confirmed broken)...`);
  const deleted = await deleteDeals(ids);
  console.log(`✅ Deleted ${deleted} deals.\n`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message || err);
  process.exit(1);
});

