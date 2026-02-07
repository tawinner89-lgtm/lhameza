'use client';

import { useEffect } from 'react';

interface AdBannerProps {
  adSlot: string;
  adFormat?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  fullWidth?: boolean;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export default function AdBanner({ 
  adSlot, 
  adFormat = 'auto', 
  fullWidth = true,
  className = ''
}: AdBannerProps) {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (error) {
      console.error('AdSense error:', error);
    }
  }, []);

  return (
    <div className={`ad-container ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidth ? 'true' : 'false'}
      />
    </div>
  );
}

// Specific ad components for different positions
export function TopBannerAd() {
  return (
    <div className="w-full bg-gray-50 py-2">
      <div className="max-w-7xl mx-auto px-4">
        <AdBanner 
          adSlot={process.env.NEXT_PUBLIC_AD_SLOT_TOP || ''} 
          adFormat="horizontal"
        />
      </div>
    </div>
  );
}

export function SidebarAd() {
  return (
    <div className="hidden lg:block sticky top-24">
      <AdBanner 
        adSlot={process.env.NEXT_PUBLIC_AD_SLOT_SIDEBAR || ''} 
        adFormat="vertical"
      />
    </div>
  );
}

export function InFeedAd() {
  return (
    <div className="col-span-1 sm:col-span-2 lg:col-span-4 py-4">
      <AdBanner 
        adSlot={process.env.NEXT_PUBLIC_AD_SLOT_INFEED || ''} 
        adFormat="rectangle"
      />
    </div>
  );
}
