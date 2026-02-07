/**
 * Image Proxy API Route
 * Proxies external images (Nike, Adidas, etc.) through our server
 * to avoid CORS and hotlinking protection issues
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // Validate URL is from allowed domains
  const allowedDomains = [
    'static.nike.com',
    'nike.com',
    'static.adidas.net',
    'adidas.com',
    'static.zara.net',
    'zara.com',
    'assets.bershka.net',
    'bershka.com',
    'static.pullandbear.net',
    'pullandbear.com',
    'jumia.is',       // Covers ma.jumia.is, ke.jumia.is, etc.
    'jmia.com',
    'jumia.ma',
    'jumia.com',
    'kitea.ma'
  ];

  try {
    const url = new URL(decodeURIComponent(imageUrl));
    const isAllowed = allowedDomains.some(domain => url.hostname.includes(domain));

    if (!isAllowed) {
      return new NextResponse('Domain not allowed', { status: 403 });
    }

    // Fetch the image
    const imageResponse = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': url.origin + '/',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      },
      // Cache for 1 hour
      next: { revalidate: 3600 }
    });

    if (!imageResponse.ok) {
      return new NextResponse(`Failed to fetch image: ${imageResponse.status}`, { 
        status: imageResponse.status 
      });
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await imageResponse.arrayBuffer();

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Failed to proxy image', { status: 500 });
  }
}
