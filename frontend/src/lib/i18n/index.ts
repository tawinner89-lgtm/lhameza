export type Locale = 'fr' | 'ar';

export const DEFAULT_LOCALE: Locale = 'fr';
export const LOCALES: readonly Locale[] = ['fr', 'ar'] as const;

export type I18nKey =
  | 'common.loading'
  | 'common.deals'
  | 'search.results'
  | 'app.name'
  | 'app.tagline'
  | 'nav.searchPlaceholder'
  | 'nav.searchPlaceholderMobile'
  | 'nav.clear'
  | 'nav.close'
  | 'nav.popular'
  | 'nav.maroc'
  | 'hero.liveDeals'
  | 'hero.bestDeals'
  | 'hero.upTo'
  | 'categories.all'
  | 'categories.superHamza'
  | 'categories.tech'
  | 'categories.fashion'
  | 'categories.home'
  | 'categories.beauty'
  | 'categories.saved'
  | 'grid.retry'
  | 'grid.oops'
  | 'grid.emptyTitle'
  | 'grid.emptyBody'
  | 'deal.viewOffer'
  | 'deal.saved'
  | 'deal.save'
  | 'feed.savedTitle'
  | 'feed.recentTitle'
  | 'feed.clear'
  | 'feed.continue'
  | 'loadMore';

type Dict = Record<I18nKey, string>;

const FR: Dict = {
  'common.loading': 'Chargement…',
  'common.deals': 'deals',
  'search.results': 'Résultats: {{count}} deals',
  'app.name': "L'HAMZA",
  'app.tagline': 'Deals Maroc',
  'nav.searchPlaceholder': 'Rechercher…',
  'nav.searchPlaceholderMobile': 'Chercher un produit…',
  'nav.clear': 'Effacer',
  'nav.close': 'Fermer',
  'nav.popular': 'Populaires',
  'nav.maroc': 'Maroc',
  'hero.liveDeals': '{{count}} deals en ligne',
  'hero.bestDeals': 'Meilleures Offres',
  'hero.upTo': "Jusqu'à",
  'categories.all': 'Tous',
  'categories.superHamza': 'Super',
  'categories.tech': 'Tech',
  'categories.fashion': 'Mode',
  'categories.home': 'Maison',
  'categories.beauty': 'Beauté',
  'categories.saved': 'Enregistrés',
  'grid.retry': 'Réessayer',
  'grid.oops': 'Oups !',
  'grid.emptyTitle': 'Aucun résultat',
  'grid.emptyBody': "On n'a rien trouvé pour le moment. Essayez une autre catégorie ?",
  'deal.viewOffer': "Voir l'offre",
  'deal.saved': 'Enregistré',
  'deal.save': 'Enregistrer',
  'feed.savedTitle': 'Enregistrés',
  'feed.recentTitle': 'Récents',
  'feed.clear': 'Effacer',
  'feed.continue': 'Continuer',
  'loadMore': "Voir plus d'offres",
};

const AR: Dict = {
  'common.loading': '...تحميل',
  'common.deals': 'عروض',
  'search.results': 'النتائج: {{count}} عرض',
  'app.name': 'الهمزة',
  'app.tagline': 'عروض المغرب',
  'nav.searchPlaceholder': 'بحث…',
  'nav.searchPlaceholderMobile': 'قلب على منتوج…',
  'nav.clear': 'مسح',
  'nav.close': 'إغلاق',
  'nav.popular': 'الأكثر بحثاً',
  'nav.maroc': 'المغرب',
  'hero.liveDeals': '{{count}} عرض كاين دابا',
  'hero.bestDeals': 'أحسن العروض',
  'hero.upTo': 'حتى لـ',
  'categories.all': 'الكل',
  'categories.superHamza': 'سوبر',
  'categories.tech': 'تيك',
  'categories.fashion': 'موضة',
  'categories.home': 'دار',
  'categories.beauty': 'جمال',
  'categories.saved': 'محفوظات',
  'grid.retry': 'عاود',
  'grid.oops': 'وقع خطأ',
  'grid.emptyTitle': 'ماكاينش',
  'grid.emptyBody': 'ما لقيناش نتائج دابا. جرّب تصنيف آخر؟',
  'deal.viewOffer': 'شوف العرض',
  'deal.saved': 'محفوظ',
  'deal.save': 'حفظ',
  'feed.savedTitle': 'محفوظات',
  'feed.recentTitle': 'آخر حاجة',
  'feed.clear': 'مسح',
  'feed.continue': 'كمل',
  'loadMore': 'زيد عروض',
};

const DICTS: Record<Locale, Dict> = { fr: FR, ar: AR };

export function isRtl(locale: Locale) {
  return locale === 'ar';
}

export function getDir(locale: Locale): 'ltr' | 'rtl' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}

export function t(locale: Locale, key: I18nKey, vars?: Record<string, string | number>): string {
  const template = DICTS[locale]?.[key] ?? DICTS[DEFAULT_LOCALE][key] ?? String(key);
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const v = vars[name];
    return v === undefined || v === null ? '' : String(v);
  });
}

