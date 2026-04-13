#!/usr/bin/env node
/**
 * Test Admitad API authentication and discover available endpoints.
 * Usage: node scripts/test-admitad.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const https = require('https');

function httpsPost(url, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
            },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function httpsGet(url, token) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function test() {
    const clientId = process.env.ADMITAD_CLIENT_ID;
    const clientSecret = process.env.ADMITAD_CLIENT_SECRET;
    const websiteId = process.env.ADMITAD_WEBSITE_ID || 'MISSING';

    console.log('=== Admitad API Test ===\n');
    console.log(`CLIENT_ID:  ${clientId ? clientId.slice(0, 8) + '...' : 'NOT SET'}`);
    console.log(`CLIENT_SECRET: ${clientSecret ? '***set***' : 'NOT SET'}`);
    console.log(`WEBSITE_ID: ${websiteId}`);
    console.log('');

    if (!clientId || !clientSecret) {
        console.error('ERROR: ADMITAD_CLIENT_ID and ADMITAD_CLIENT_SECRET must be set in .env');
        process.exit(1);
    }

    // ── Step 1: Get token ───────────────────────────────────────────────────

    console.log('Step 1: Authenticating (scope: advcampaigns_for_website coupons_for_website)...');

    const tokenBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'advcampaigns_for_website coupons_for_website websites',
    }).toString();

    const tokenRes = await httpsPost('https://api.admitad.com/token/', tokenBody);
    console.log(`HTTP ${tokenRes.status}`);
    console.log(JSON.stringify(tokenRes.body, null, 2));

    if (!tokenRes.body.access_token) {
        console.error('\nERROR: No access_token returned. Check credentials.');
        process.exit(1);
    }

    const token = tokenRes.body.access_token;
    console.log('\n✓ Token obtained:', token.slice(0, 20) + '...');

    // ── Step 2: List my websites ────────────────────────────────────────────

    console.log('\nStep 2: Listing my Admitad websites...');
    const sitesRes = await httpsGet('https://api.admitad.com/websites/', token);
    console.log(`HTTP ${sitesRes.status}`);
    console.log(JSON.stringify(sitesRes.body, null, 2));

    const myWebsiteId = sitesRes.body?.results?.[0]?.id;
    if (myWebsiteId) {
        console.log(`\n✓ Your website ID: ${myWebsiteId}`);
        console.log(`  → Add to .env:  ADMITAD_WEBSITE_ID=${myWebsiteId}`);
    }

    const wid = myWebsiteId || websiteId;
    if (wid === 'MISSING') {
        console.error('\nERROR: Cannot continue without website ID. Add ADMITAD_WEBSITE_ID to .env');
        process.exit(1);
    }

    // ── Step 3: List campaigns for this website ─────────────────────────────

    console.log(`\nStep 3: Listing campaigns for website ${wid}...`);
    const campaignsRes = await httpsGet(
        `https://api.admitad.com/advcampaigns/website/${wid}/?limit=10&offset=0`,
        token
    );
    console.log(`HTTP ${campaignsRes.status}`);
    console.log(JSON.stringify(campaignsRes.body, null, 2));

    // ── Step 4: Try coupons endpoint ────────────────────────────────────────

    console.log(`\nStep 4: Listing coupons for website ${wid}...`);
    const couponsRes = await httpsGet(
        `https://api.admitad.com/coupons/website/${wid}/?limit=5&offset=0`,
        token
    );
    console.log(`HTTP ${couponsRes.status}`);
    console.log(JSON.stringify(couponsRes.body, null, 2));

    console.log('\n=== Done ===');
    console.log('Next: copy the AliExpress campaign ID from Step 3 results');
    console.log('Then add to .env:  ADMITAD_ALIEXPRESS_CAMPAIGN_ID=<id>');
}

test().catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
