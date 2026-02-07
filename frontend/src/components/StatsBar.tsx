'use client';

import { Flame, TrendingUp, ShoppingBag, Clock } from 'lucide-react';

interface StatsBarProps {
  totalDeals: number;
  hamzaDeals: number;
  superHamzaDeals: number;
  lastUpdated?: string;
}

export default function StatsBar({ totalDeals, hamzaDeals, superHamzaDeals, lastUpdated }: StatsBarProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('fr-MA', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-3 px-4 overflow-x-auto">
      <div className="max-w-7xl mx-auto flex items-center gap-6 min-w-max">
        {/* Total Deals */}
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-gray-400" />
          <span className="text-sm">
            <span className="font-bold">{totalDeals}</span>
            <span className="text-gray-400 ml-1">deals</span>
          </span>
        </div>

        <div className="w-px h-4 bg-gray-700" />

        {/* Hamza Deals */}
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm">
            <span className="font-bold text-orange-400">{hamzaDeals}</span>
              <span className="text-gray-400 ml-1">{"L'Hamza"}</span>
          </span>
        </div>

        <div className="w-px h-4 bg-gray-700" />

        {/* Super Hamza */}
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-red-500" />
          <span className="text-sm">
            <span className="font-bold text-red-400">{superHamzaDeals}</span>
              <span className="text-gray-400 ml-1">{"Super L'Hamza"}</span>
          </span>
        </div>

        <div className="flex-1" />

        {/* Last Updated */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-400">
            MAJ: {formatDate(lastUpdated)}
          </span>
        </div>
      </div>
    </div>
  );
}
