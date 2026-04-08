'use client';

import { useEffect, useMemo, useState } from 'react';
import { Deal } from '@/lib/api';
import { Heart, ArrowUpRight } from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { t } from '@/lib/i18n';
import { bumpPreference, isSaved, pushRecentDeal, toggleSaved } from '@/lib/retention';
import { trackDealOpened, trackDealSaved } from '@/lib/supabase';

interface DealCardProps {
  deal: Deal;
}

// Source branding
const sourceConfig: Record<string, { name: string; logo?: string }> = {
  adidas: { name: 'ADIDAS' },
  nike: { name: 'NIKE' },
  zara: { name: 'ZARA' },
  bershka: { name: 'BERSHKA' },
  pullbear: { name: "PULL&BEAR" },
  jumia: { name: 'JUMIA' },
  kitea: { name: 'KITEA' },
  aliexpress: { name: 'ALIEXPRESS' },
};

// Fix image URL issues
function getImageUrl(url: string | null | undefined, source?: string): string | null {
  if (!url) return null;
  if (url.includes('placeholder') || url.includes('loader') || url.includes('data:image/gif')) {
    return null;
  }
  
  // Normalize protocol
  if (url.startsWith('//')) {
    url = 'https:' + url;
  }
  url = url.replace('http://', 'https://');
  
  // Use image proxy for sources that block hotlinking/CORS
  const proxyNeeded = (
    (source === 'nike' && url.includes('nike.com')) ||
    (source === 'adidas' && url.includes('adidas')) ||
    (source === 'jumia' && (url.includes('jumia.is') || url.includes('jmia.com'))) ||
    (source === 'kitea' && url.includes('kitea'))
  );
  
  if (proxyNeeded) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  
  return url;
}

export default function DealCard({ deal }: DealCardProps) {
  const { locale } = useLocale();
  const source = sourceConfig[deal.source] || { name: deal.source.toUpperCase() };
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saved, setSaved] = useState(() => isSaved(deal.id));
  
  const imageUrl = useMemo(() => getImageUrl(deal.image, deal.source), [deal.image, deal.source]);
  const showPlaceholder = !imageUrl || imageError;

  // Price validation - hide if suspicious
  const isPriceValid = useMemo(() => {
    if (!deal.originalPrice || !deal.discount) return true;
    
    // Check if discount makes sense
    const calculatedDiscount = Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100);
    const discountDiff = Math.abs(calculatedDiscount - deal.discount);
    
    // If discount is off by more than 5%, it's suspicious
    if (discountDiff > 5) return false;
    
    // If original price is less than current price, invalid
    if (deal.originalPrice < deal.price) return false;
    
    // If discount is too extreme (>95%), suspicious
    if (deal.discount > 95) return false;
    
    return true;
  }, [deal.price, deal.originalPrice, deal.discount]);

  const displayDiscount = useMemo(() => {
    if (!deal.discount || !isPriceValid) return null;
    return deal.discount;
  }, [deal.discount, isPriceValid]);

  useEffect(() => {
    const onSavedChanged = () => setSaved(isSaved(deal.id));
    window.addEventListener('lhamza:saved-changed', onSavedChanged as EventListener);
    window.addEventListener('storage', onSavedChanged);
    return () => {
      window.removeEventListener('lhamza:saved-changed', onSavedChanged as EventListener);
      window.removeEventListener('storage', onSavedChanged);
    };
  }, [deal.id]);
  
  const handleClick = () => {
    pushRecentDeal({
      id: deal.id,
      title: deal.title,
      image: deal.image,
      url: deal.url,
      priceFormatted: deal.priceFormatted,
      discount: deal.discount,
      source: deal.source,
      category: deal.category,
      brand: deal.brand ?? null,
    });
    bumpPreference('source', deal.source);
    bumpPreference('category', deal.category);
    void trackDealOpened({ id: deal.id, source: deal.source, category: deal.category, discount: deal.discount ?? null });
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = toggleSaved(deal.id);
    setSaved(res.saved);
    void trackDealSaved({ id: deal.id, saved: res.saved, source: deal.source, category: deal.category });
  };

  // For AliExpress: route clicks through Admitad affiliate redirect
  const dealUrl = deal.source === 'aliexpress'
    ? `/api/redirect?url=${encodeURIComponent(deal.url)}`
    : deal.url;

  // Calculate savings
  const savings = deal.originalPrice && deal.price && isPriceValid
    ? Math.round(deal.originalPrice - deal.price)
    : null;

  // Brand identity class
  const brandKey = deal.source?.toLowerCase() || 'default';
  const glowClass = `brand-glow-${brandKey}`;
  const stripeClass = `brand-stripe brand-stripe-${brandKey}`;
  const ctaClass = `brand-cta-${brandKey}`;

  return (
    <article className={`group relative bg-white overflow-hidden card-premium rounded-lg ${stripeClass} ${glowClass} ${deal.isSuperHamza ? 'super-glow' : ''}`}>
      {/* Image Section */}
      <a
        href={dealUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="block relative aspect-[4/5] bg-[#F5F5F5] overflow-hidden"
      >
        {/* Loading skeleton */}
        {!imageLoaded && !showPlaceholder && (
          <div className="absolute inset-0 skeleton" />
        )}
        
        {/* Product Image */}
        {showPlaceholder ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-5xl opacity-30 mb-2">
              {source.name === 'NIKE' ? '👟' : 
               source.name === 'ADIDAS' ? '👟' :
               source.name === 'ZARA' ? '👗' :
               source.name === 'BERSHKA' ? '👕' :
               source.name === 'PULL&BEAR' ? '🧥' :
               source.name === 'JUMIA' ? '📦' :
               source.name === 'KITEA' ? '🏠' :
               source.name === 'ALIEXPRESS' ? '🛒' : '🛍️'}
            </span>
            <span className="text-xs text-gray-400 font-bold">{source.name}</span>
          </div>
        ) : (
          <img
            src={imageUrl!}
            alt={deal.title}
            className={`absolute inset-0 w-full h-full object-cover card-image-zoom ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(true);
            }}
          />
        )}

        {/* Top badges */}
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1 sm:gap-2 z-10">
          {/* Sale Badge - brand colored for big discounts */}
          {displayDiscount && displayDiscount >= 10 && (
            <span className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 text-white text-[10px] sm:text-[13px] font-extrabold tracking-wide shadow-lg rounded-md ${
              displayDiscount >= 40 ? 'bg-[#E31937]' : ctaClass || 'bg-[#FF5500]'
            }`}>
              -{displayDiscount}%
            </span>
          )}
          
          {/* Super Deal Badge */}
          {deal.isSuperHamza && (
            <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-[9px] sm:text-[11px] font-extrabold tracking-wider rounded-md shadow-lg">
              ⚡ SUPER
            </span>
          )}
        </div>

        {/* Save Button - Top Right */}
        <button
          type="button"
          onClick={handleSave}
          aria-label={saved ? t(locale, 'deal.saved') : t(locale, 'deal.save')}
          className={`
            absolute top-2 sm:top-3 right-2 sm:right-3 z-10
            w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center
            transition-all duration-300
            ${saved 
              ? 'bg-[#FF5500] text-white shadow-lg' 
              : 'bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white hover:scale-110 shadow-md'
            }
          `}
        >
          <Heart className="w-4 h-4 sm:w-5 sm:h-5" fill={saved ? 'currentColor' : 'none'} strokeWidth={saved ? 0 : 2} />
        </button>

        {/* Quick View Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="inline-flex items-center gap-2 text-white text-sm font-bold">
            {locale === 'ar' ? 'شوف العرض' : 'Voir le deal'}
            <ArrowUpRight className="w-4 h-4" />
          </span>
        </div>
      </a>

      {/* Content Section */}
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-2.5">
        {/* Source */}
        <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 tracking-widest uppercase">
          {source.name}
        </p>

        {/* Title */}
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 min-h-[32px] sm:min-h-[40px] leading-tight">
          {deal.title}
        </h3>

        {/* Price Row */}
        <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
          <span className="text-base sm:text-lg font-extrabold text-gray-900">
            {deal.priceFormatted}
          </span>
          {deal.originalPriceFormatted && deal.originalPrice !== deal.price && isPriceValid && (
            <span className="text-[11px] sm:text-sm text-gray-400 line-through font-medium">
              {deal.originalPriceFormatted}
            </span>
          )}
        </div>

        {/* Savings badge */}
        {savings && savings > 0 && isPriceValid && (
          <div className="savings-badge">
            <span>{locale === 'ar' ? 'وفّر' : 'Économisez'}</span>
            <span className="font-extrabold">{savings.toFixed(0)} MAD</span>
          </div>
        )}

        {/* CTA Button - Brand colored */}
        <a
          href={dealUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className={`
            block w-full py-2.5 sm:py-3 px-3 sm:px-4
            text-white text-center text-xs sm:text-sm font-bold
            transition-all duration-300 uppercase tracking-wider rounded-lg
            hover:shadow-lg hover:translate-y-[-1px]
            ${deal.isSuperHamza
              ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black'
              : ctaClass || 'bg-[#FF5500] hover:bg-[#E64D00]'
            }
          `}
        >
          <span className="hidden sm:inline">{locale === 'ar' ? 'شوف العرض' : 'Voir le deal'}</span>
          <span className="sm:hidden">{locale === 'ar' ? 'شوف' : 'VOIR'}</span>
          <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 inline-block ml-1" />
        </a>

        {/* WhatsApp Share */}
        <a
          href={`https://wa.me/?text=${encodeURIComponent('🔥 ' + deal.title + ' à ' + deal.priceFormatted + ' (-' + deal.discount + '%) → ' + deal.url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2 text-[#25D366] text-xs font-semibold hover:bg-green-50 rounded-lg transition-colors"
          aria-label="Partager sur WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.116 1.529 5.845L.057 23.943l6.294-1.648A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.368l-.36-.213-3.731.977.995-3.634-.234-.374A9.818 9.818 0 1112 21.818z"/>
          </svg>
          {locale === 'ar' ? 'شارك واتساب' : 'Partager'}
        </a>
      </div>
    </article>
  );
}
