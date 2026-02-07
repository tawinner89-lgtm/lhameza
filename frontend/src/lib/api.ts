/**
 * L'HAMZA F SEL'A - API Client
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Deal {
  id: string;
  title: string;
  brand: string | null;
  price: number;
  priceFormatted: string;
  originalPrice: number | null;
  originalPriceFormatted: string | null;
  discount: number | null;
  discountLabel: string | null;
  currency: string;
  category: string;
  subcategory?: string | null;
  source: string;
  condition?: string;
  conditionLabel?: string;
  conditionEmoji?: string;
  isNew?: boolean;
  image: string | null;
  url: string;
  location?: string | null;
  city?: string | null;
  rating?: number | null;
  reviews?: number | null;
  sizes?: string[];
  inStock?: boolean;
  hasDelivery?: boolean;
  hamzaScore?: number;
  hamzaEmoji?: string;
  isHamzaDeal?: boolean;
  isSuperHamza?: boolean;
  tags?: string[];
  scrapedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  nameFr: string;
  nameAr: string;
  emoji: string;
  color: string;
  subcategories: string[];
}

export interface DealsResponse {
  success: boolean;
  total: number;
  count: number;
  offset: number;
  limit: number;
  deals: Deal[];
  category?: string;
}

export interface CategoriesResponse {
  success: boolean;
  count: number;
  categories: Category[];
}

export interface StatsResponse {
  success: boolean;
  stats: {
    totalDeals: number;
    hamzaDeals: number;
    superHamzaDeals: number;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
    lastUpdated: string;
  };
}

export interface SearchResponse {
  success: boolean;
  query: string;
  count: number;
  deals: Deal[];
}

// API Functions
export async function getDeals(params?: {
  category?: string;
  minDiscount?: number;
  minScore?: number;
  source?: string;
  brand?: string;
  city?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<DealsResponse> {
  const response = await api.get('/deals', { params });
  return response.data;
}

export async function getDealsByCategory(category: string, params?: {
  minDiscount?: number;
  minScore?: number;
  limit?: number;
  offset?: number;
}): Promise<DealsResponse> {
  const response = await api.get(`/deals/${category}`, { params });
  return response.data;
}

export async function getSuperHamzaDeals(params?: {
  limit?: number;
  offset?: number;
}): Promise<DealsResponse> {
  const response = await api.get('/deals/super-hamza', { params });
  return response.data;
}

export async function getHamzaDeals(params?: {
  limit?: number;
  offset?: number;
}): Promise<DealsResponse> {
  const response = await api.get('/deals/hamza', { params });
  return response.data;
}

export async function searchDeals(query: string, params?: {
  category?: string;
  limit?: number;
}): Promise<SearchResponse> {
  const response = await api.get('/search', { params: { q: query, ...params } });
  return response.data;
}

export async function getCategories(): Promise<CategoriesResponse> {
  const response = await api.get('/categories');
  return response.data;
}

export async function getStats(): Promise<StatsResponse> {
  const response = await api.get('/stats');
  return response.data;
}

export async function getDeal(id: string): Promise<{ success: boolean; deal: Deal }> {
  const response = await api.get(`/deal/${id}`);
  return response.data;
}

export default api;
