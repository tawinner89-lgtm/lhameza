import type { Deal } from '@/lib/api';

const SAVED_KEY = 'lhamza_saved_ids';
const RECENT_KEY = 'lhamza_recent_deals';
const PREF_KEY = 'lhamza_prefs_v1';

export type RecentDeal = Pick<
  Deal,
  'id' | 'title' | 'image' | 'url' | 'priceFormatted' | 'discount' | 'source' | 'category' | 'brand'
>;

type Prefs = {
  sources: Record<string, number>;
  categories: Record<string, number>;
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function emit(name: 'saved' | 'recent' | 'prefs') {
  try {
    window.dispatchEvent(new CustomEvent(`lhamza:${name}-changed`));
  } catch {
    // ignore
  }
}

// =========================
// Saved / Favorites
// =========================

export function getSavedIds(): string[] {
  return safeParse<string[]>(safeRead(SAVED_KEY), []).filter(Boolean);
}

export function isSaved(id: string): boolean {
  return getSavedIds().includes(id);
}

export function toggleSaved(id: string): { saved: boolean; ids: string[] } {
  const ids = new Set(getSavedIds());
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  const next = Array.from(ids);
  safeWrite(SAVED_KEY, JSON.stringify(next));
  emit('saved');
  return { saved: ids.has(id), ids: next };
}

// =========================
// Recently viewed
// =========================

const MAX_RECENT = 12;

export function getRecentDeals(): RecentDeal[] {
  return safeParse<RecentDeal[]>(safeRead(RECENT_KEY), []).filter((d) => d?.id && d?.url);
}

export function pushRecentDeal(deal: RecentDeal) {
  const current = getRecentDeals();
  const deduped = [deal, ...current.filter((d) => d.id !== deal.id)].slice(0, MAX_RECENT);
  safeWrite(RECENT_KEY, JSON.stringify(deduped));
  emit('recent');
}

export function clearRecentDeals() {
  safeWrite(RECENT_KEY, JSON.stringify([]));
  emit('recent');
}

// =========================
// Preferences (light personalization)
// =========================

function getPrefs(): Prefs {
  return safeParse<Prefs>(safeRead(PREF_KEY), { sources: {}, categories: {} });
}

function savePrefs(prefs: Prefs) {
  safeWrite(PREF_KEY, JSON.stringify(prefs));
  emit('prefs');
}

export function bumpPreference(kind: 'source' | 'category', value: string) {
  if (!value) return;
  const prefs = getPrefs();
  if (kind === 'source') prefs.sources[value] = (prefs.sources[value] || 0) + 1;
  if (kind === 'category') prefs.categories[value] = (prefs.categories[value] || 0) + 1;
  savePrefs(prefs);
}

export function getPreferredSources(limit = 4): string[] {
  const prefs = getPrefs();
  return Object.entries(prefs.sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

