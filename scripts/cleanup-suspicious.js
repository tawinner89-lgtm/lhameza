#!/usr/bin/env node
/**
 * L'HAMZA F SEL'A — One-time cleanup: remove deals with discount > 85%
 *
 * These are almost always scraping errors (e.g. a "-91%" badge number picked up
 * as the sale price, producing impossible discounts like 219 MAD on a 2400 MAD item).
 *
 * Usage:
 *   node scripts/cleanup-suspicious.js
 *   node scripts/cleanup-suspicious.js --max-discount 90   # change threshold
 */

require('dotenv').config();
const supabaseService = require('../src/services/supabase.service');

const maxDiscount = (() => {
    const idx = process.argv.indexOf('--max-discount');
    if (idx !== -1 && process.argv[idx + 1]) {
        return parseInt(process.argv[idx + 1], 10);
    }
    return 85;
})();

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  🗑️  L\'HAMZA — Suspicious Deal Cleanup                ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    console.log(`Removing deals with discount > ${maxDiscount}%...\n`);

    await supabaseService.initialize();

    const result = await supabaseService.cleanupSuspiciousDeals(maxDiscount);

    console.log('╔══════════════════════════════════════════════════════╗');
    console.log(`║  Deleted: ${String(result.deleted + ' deals').padEnd(42)}║`);
    console.log('╚══════════════════════════════════════════════════════╝\n');

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
});
