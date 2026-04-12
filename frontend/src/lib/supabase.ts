/**
 * L'HAMZA F SEL'A - Supabase Client (Frontend)
 * Direct database access for serverless deployment
 */

import { createClient } from '@supabase/supabase-js';

// Get env vars with fallbacks for build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Create client (will work with placeholders during build, real values at runtime)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to check if Supabase is properly configured (check at runtime)
export const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://placeholder.supabase.co' && 
         supabaseAnonKey !== 'placeholder-key';
};

// Types
export interface Deal {
  id: string;
  title: string;
  brand: string | null;
  price: number;
  original_price: number | null;
  discount: number | null;
  currency: string;
  category: string;
  source: string;
  condition: string;
  image: string | null;
  url: string;
  location: string | null;
  city: string | null;
  rating: number | null;
  reviews: number | null;
  sizes: string[] | null;
  in_stock: boolean;
  has_delivery: boolean;
  hamza_score: number;
  is_hamza_deal: boolean;
  is_super_hamza: boolean;
  scraped_at: string;
  created_at: string;
}

// Format deal for frontend
export function formatDeal(deal: Deal) {
  const currency = deal.currency || 'MAD';
  return {
    id: deal.id,
    title: deal.title,
    brand: deal.brand,
    price: deal.price,
    priceFormatted: `${deal.price?.toFixed(2)} ${currency}`,
    originalPrice: deal.original_price,
    originalPriceFormatted: deal.original_price ? `${deal.original_price.toFixed(2)} ${currency}` : null,
    discount: deal.discount,
    discountLabel: deal.discount ? `-${deal.discount}%` : null,
    currency,
    category: deal.category,
    source: deal.source,
    condition: deal.condition || 'new',
    conditionLabel: deal.condition === 'new' ? 'Neuf' : 'Occasion',
    conditionEmoji: deal.condition === 'new' ? '✨' : '♻️',
    isNew: deal.condition === 'new',
    image: deal.image,
    url: deal.url,
    location: deal.location,
    city: deal.city,
    rating: deal.rating,
    reviews: deal.reviews,
    sizes: deal.sizes || [],
    inStock: deal.in_stock !== false,
    hasDelivery: deal.has_delivery || false,
    hamzaScore: deal.hamza_score || 5,
    hamzaEmoji: deal.hamza_score >= 8 ? '🔥' : deal.hamza_score >= 6 ? '👍' : '👀',
    isHamzaDeal: deal.is_hamza_deal || false,
    isSuperHamza: deal.is_super_hamza || false,
    tags: [],
    scrapedAt: deal.scraped_at,
  };
}

// ==========================================
// API Functions (Direct Supabase)
// ==========================================

export async function getDeals(params?: {
  category?: string;
  source?: string;
  minDiscount?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}) {
  const limit = params?.limit || 50;
  const offset = params?.offset || 0;
  
  // Return empty during build time
  if (!isSupabaseConfigured()) {
    return { success: true, total: 0, count: 0, offset, limit, deals: [] };
  }
  
  // Default: Sort by discount (best deals first)
  const sortBy = params?.sortBy || 'discount';
  const sortDir = params?.sortDir === 'asc';

  let query = supabase
    .from('deals')
    .select('*', { count: 'exact' });
  
  // Always filter by minimum discount (10%) unless explicitly set otherwise
  const minDiscount = params?.minDiscount !== undefined ? params.minDiscount : 10;
  if (minDiscount > 0) {
    query = query.gte('discount', minDiscount);
  }

  if (params?.category) {
    query = query.eq('category', params.category);
  }
  if (params?.source) {
    query = query.eq('source', params.source);
  }

  // Only show deals scraped in the last 30 days — hides expired/stale deals
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  query = query.gte('scraped_at', thirtyDaysAgo.toISOString());

  // Map sortBy to database column
  const sortMapping: Record<string, string> = {
    'hamzaScore': 'hamza_score',
    'originalPrice': 'original_price',
  };
  const sortColumn = sortMapping[sortBy] || sortBy;

  // Sort by discount (best deals first)
  query = query.order(sortColumn, { ascending: sortDir, nullsFirst: false });
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, total: 0, count: 0, offset, limit, deals: [] };
  }

  return {
    success: true,
    total: count || 0,
    count: data?.length || 0,
    offset,
    limit,
    deals: (data || []).map(formatDeal),
  };
}

export async function getDealsByIds(ids: string[]) {
  const clean = (ids || []).filter(Boolean);
  if (clean.length === 0) {
    return { success: true, count: 0, deals: [] as ReturnType<typeof formatDeal>[] };
  }

  if (!isSupabaseConfigured()) {
    return { success: true, count: 0, deals: [] as ReturnType<typeof formatDeal>[] };
  }

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .in('id', clean);

  if (error) {
    console.error('Supabase getDealsByIds error:', error);
    return { success: false, count: 0, deals: [] as ReturnType<typeof formatDeal>[] };
  }

  const formatted = (data || []).map(formatDeal);
  const byId = new Map(formatted.map((d) => [d.id, d]));
  const ordered = clean.map((id) => byId.get(id)).filter(Boolean) as typeof formatted;

  return { success: true, count: ordered.length, deals: ordered };
}

export async function searchDeals(searchQuery: string, params?: { limit?: number }) {
  const limit = params?.limit || 50;
  const terms = searchQuery.toLowerCase().trim();

  // Return empty during build time
  if (!isSupabaseConfigured()) {
    return { success: true, query: terms, count: 0, deals: [] };
  }

  const { data, error, count } = await supabase
    .from('deals')
    .select('*', { count: 'exact' })
    .or(`title.ilike.%${terms}%,brand.ilike.%${terms}%,source.ilike.%${terms}%`)
    .gte('discount', 10)
    .order('discount', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Supabase search error:', error);
    return { success: false, query: terms, count: 0, deals: [] };
  }

  return {
    success: true,
    query: terms,
    count: count || 0,
    deals: (data || []).map(formatDeal),
  };
}

export async function getStats() {
  // Return empty during build time
  if (!isSupabaseConfigured()) {
    return {
      success: true,
      stats: {
        totalDeals: 0,
        hamzaDeals: 0,
        superHamzaDeals: 0,
        byCategory: {},
        bySource: {},
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  const { count: total } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true });

  const { count: hamzaDeals } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('is_hamza_deal', true);

  const { count: superHamza } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('is_super_hamza', true);

  // Get category counts
  const categories = ['tech', 'fashion', 'home', 'beauty'];
  const byCategory: Record<string, number> = {};
  
  for (const cat of categories) {
    const { count } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('category', cat);
    byCategory[cat] = count || 0;
  }

  return {
    success: true,
    stats: {
      totalDeals: total || 0,
      hamzaDeals: hamzaDeals || 0,
      superHamzaDeals: superHamza || 0,
      byCategory,
      bySource: {},
      lastUpdated: new Date().toISOString(),
    },
  };
}

export async function getCategories() {
  // Return empty during build time
  if (!isSupabaseConfigured()) {
    return { success: true, count: 0, categories: [] };
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*');

  if (error) {
    console.error('Supabase categories error:', error);
    return { success: false, count: 0, categories: [] };
  }

  return {
    success: true,
    count: data?.length || 0,
    categories: (data || []).map(cat => ({
      id: cat.id,
      name: cat.name,
      nameFr: cat.name_fr,
      nameAr: cat.name_ar,
      emoji: cat.emoji,
      color: cat.color,
      subcategories: cat.subcategories || [],
    })),
  };
}

export async function getSuperHamzaDeals(params?: { limit?: number; offset?: number }) {
  const limit = params?.limit || 50;
  const offset = params?.offset || 0;

  // Return empty during build time
  if (!isSupabaseConfigured()) {
    return { success: true, total: 0, count: 0, offset, limit, deals: [] };
  }

  const { data, error, count } = await supabase
    .from('deals')
    .select('*', { count: 'exact' })
    .eq('is_super_hamza', true)
    .order('hamza_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { success: false, total: 0, count: 0, offset, limit, deals: [] };
  }

  return {
    success: true,
    total: count || 0,
    count: data?.length || 0,
    offset,
    limit,
    deals: (data || []).map(formatDeal),
  };
}

// ==========================================
// Analytics (visites + recherches → Telegram stats)
// ===========================================

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem('lhamza_sid');
    if (!id) {
      id = crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('lhamza_sid', id);
    }
    return id;
  } catch {
    return '';
  }
}

export async function trackPageView() {
  if (!isSupabaseConfigured()) return;
  try {
    await supabase.from('analytics').insert({
      event_type: 'page_view',
      session_id: getSessionId(),
      payload: {},
    });
  } catch {
    // ignore errors (e.g. table not yet created)
  }
}

export async function trackSearch(query: string) {
  if (!isSupabaseConfigured() || !query?.trim()) return;
  try {
    await supabase.from('analytics').insert({
      event_type: 'search',
      session_id: getSessionId(),
      payload: { query: query.trim().slice(0, 200) },
    });
  } catch {}
}

type AnalyticsPayload = Record<string, unknown>;

async function trackEvent(event_type: string, payload: AnalyticsPayload) {
  if (!isSupabaseConfigured() || !event_type) return;
  try {
    await supabase.from('analytics').insert({
      event_type,
      session_id: getSessionId(),
      payload,
    });
  } catch {
    // ignore
  }
}

export function trackDealOpened(payload: {
  id: string;
  source?: string;
  category?: string;
  discount?: number | null;
}) {
  return trackEvent('deal_opened', {
    id: payload.id,
    source: payload.source,
    category: payload.category,
    discount: payload.discount ?? null,
  });
}

export function trackDealSaved(payload: { id: string; saved: boolean; source?: string; category?: string }) {
  return trackEvent('deal_saved', {
    id: payload.id,
    saved: payload.saved,
    source: payload.source,
    category: payload.category,
  });
}

export function trackLocaleChanged(locale: string) {
  return trackEvent('locale_changed', { locale });
}

export function trackCategorySelected(category: string) {
  return trackEvent('category_selected', { category });
}
