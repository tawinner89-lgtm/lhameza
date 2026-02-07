'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Activity {
  id: number;
  emoji: string;
  text: string;
  time: string;
  source: string;
}

const cities = ['Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir', 'Oujda', 'Meknès'];
const actions = [
  { emoji: '👁️', template: (p: string) => `Quelqu'un a vu ${p}` },
  { emoji: '❤️', template: (p: string) => `${p} ajouté aux favoris` },
  { emoji: '🔥', template: (p: string) => `${p} très demandé!` },
];
const products = [
  { name: 'Nike Air Force', source: 'nike' },
  { name: 'Zara Jacket', source: 'zara' },
  { name: 'Adidas Hoodie', source: 'adidas' },
  { name: 'iPhone Case', source: 'jumia' },
  { name: 'Samsung TV 50"', source: 'jumia' },
  { name: 'Nike Dunk Low', source: 'nike' },
  { name: 'Tapis Furry', source: 'jumia' },
  { name: 'Air Max Dn', source: 'nike' },
  { name: 'Pull&Bear Veste', source: 'pullbear' },
  { name: 'Bershka Top', source: 'bershka' },
];

function generateActivity(): Activity {
  const action = actions[Math.floor(Math.random() * actions.length)];
  const product = products[Math.floor(Math.random() * products.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];
  
  return {
    id: Date.now() + Math.random(),
    emoji: action.emoji,
    text: action.template(product.name),
    time: city,
    source: product.source,
  };
}

export default function LiveActivity() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show first notification after 8 seconds
    const initialDelay = setTimeout(() => {
      showNotification();
    }, 8000);

    return () => clearTimeout(initialDelay);
  }, []);

  const showNotification = () => {
    const newActivity = generateActivity();
    setActivity(newActivity);
    setVisible(true);

    // Hide after 4 seconds
    setTimeout(() => {
      setVisible(false);
      
      // Schedule next one in 12-20 seconds
      setTimeout(() => {
        showNotification();
      }, Math.random() * 8000 + 12000);
    }, 4000);
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-3 sm:left-6 z-50">
      <AnimatePresence>
        {visible && activity && (
          <motion.div
            initial={{ opacity: 0, x: -100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.8 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-white/95 backdrop-blur-xl rounded-2xl p-3 sm:p-4 shadow-2xl border border-gray-100 flex items-center gap-3 max-w-[300px] sm:max-w-xs cursor-pointer hover:shadow-3xl transition-shadow"
            onClick={() => setVisible(false)}
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-lg shrink-0">
              {activity.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                {activity.text}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                {activity.time}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
