'use client';

import { motion } from 'framer-motion';
import { Home, Search, Heart, Zap } from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'all', icon: Home, label: 'Accueil', labelAr: 'الرئيسية' },
  { id: 'super-hamza', icon: Zap, label: 'Super', labelAr: 'سوبر' },
  { id: 'search', icon: Search, label: 'Recherche', labelAr: 'بحث' },
  { id: 'saved', icon: Heart, label: 'Favoris', labelAr: 'المفضلة' },
];

export default function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const { locale } = useLocale();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200/50 px-2 py-1.5 pb-[env(safe-area-inset-bottom,8px)] lg:hidden z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id || 
            (tab.id === 'all' && !['super-hamza', 'search', 'saved'].includes(activeTab));
          const Icon = tab.icon;

          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors ${
                isActive ? 'text-[#FF5500]' : 'text-gray-400'
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <motion.div
                animate={{ 
                  scale: isActive ? 1.15 : 1,
                  y: isActive ? -2 : 0,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Icon className="w-5 h-5" fill={isActive && tab.id === 'saved' ? 'currentColor' : 'none'} />
              </motion.div>
              <span className="text-[10px] font-semibold">
                {locale === 'ar' ? tab.labelAr : tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-1.5 w-5 h-0.5 bg-[#FF5500] rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
