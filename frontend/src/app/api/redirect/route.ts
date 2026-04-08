/**
 * L'HAMZA — Admitad Affiliate Redirect
 *
 * GET /api/redirect?url=ORIGINAL_URL
 *
 * 1. Authenticates with Admitad using client_credentials
 * 2. Generates an affiliate deeplink for the original URL
 * 3. Redirects user to the affiliate URL
 * 4. Falls back to the original URL if Admitad fails
 *
 * Required env vars (in .env.local — never commit these):
 *   ADMITAD_CLIENT_ID       — from Admitad publisher dashboard
 *   ADMITAD_CLIENT_SECRET   — from Admitad publisher dashboard
 *   ADMITAD_CAMPAIGN_CODE   — advertiser campaign code (e.g. AliExpress campaign ID)
 */

import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Token cache — module-level, survives across requests in the same serverless
// instance (avoids re-authenticating on every click)
// ---------------------------------------------------------------------------
interface TokenCache {
  value: string;
  expiresAt: number; // ms since epoch
}
let cachedToken: TokenCache | null = null;

async function getAdmitadToken(): Promise<string | null> {
  const clientId = process.env.ADMITAD_CLIENT_ID;
  const clientSecret = process.env.ADMITAD_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  // Return cached token if still valid (60 s safety buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  try {
    const res = await fetch('https://api.admitad.com/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'deeplink_generator',
      }),
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = await res.json() as { access_token: string; expires_in?: number };
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return cachedToken.value;
  } catch {
    return null;
  }
}

async function generateDeeplink(originalUrl: string, token: string): Promise<string | null> {
  const campaignCode = process.env.ADMITAD_CAMPAIGN_CODE;
  if (!campaignCode) return null;

  try {
    const res = await fetch(`https://api.admitad.com/deeplink/${campaignCode}/set/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ url: originalUrl }]),
      cache: 'no-store',
    });

    if (!res.ok) return null;

    // Admitad returns an array: [{ deeplink: "...", original_url: "..." }]
    const data = await res.json() as Array<{ deeplink?: string; url?: string }>;
    return data?.[0]?.deeplink ?? data?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate and normalise the URL
  let originalUrl: string;
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    originalUrl = parsed.toString();
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Attempt Admitad affiliate deeplink generation
  try {
    const token = await getAdmitadToken();
    if (token) {
      const affiliateUrl = await generateDeeplink(originalUrl, token);
      if (affiliateUrl) {
        return NextResponse.redirect(affiliateUrl, { status: 302 });
      }
    }
  } catch {
    // Swallow — fall through to original URL
  }

  // Fallback: send user directly to the original URL
  return NextResponse.redirect(originalUrl, { status: 302 });
}
