'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { TrendingUp, Eye, Heart, Users } from 'lucide-react';

// Client-side translations (outside NextIntlClientProvider)
const translations = {
  ja: {
    loading: '読み込み中...',
    fetchError: 'データの取得に失敗しました',
    daily: '24時間',
    weekly: '週間',
    monthly: '月間',
    totalViews: '総閲覧数',
    products: '作品数',
    favorites: 'お気に入り',
    uniqueVisitors: 'ユニーク訪問者',
    topProducts: '人気作品 Top 5',
    topPerformers: '人気女優 Top 5',
    views: 'views',
  },
  en: {
    loading: 'Loading...',
    fetchError: 'Failed to fetch data',
    daily: '24 Hours',
    weekly: 'Weekly',
    monthly: 'Monthly',
    totalViews: 'Total Views',
    products: 'Products',
    favorites: 'Favorites',
    uniqueVisitors: 'Unique Visitors',
    topProducts: 'Top 5 Products',
    topPerformers: 'Top 5 Performers',
    views: 'views',
  },
  zh: {
    loading: '加载中...',
    fetchError: '获取数据失败',
    daily: '24小时',
    weekly: '本周',
    monthly: '本月',
    totalViews: '总浏览量',
    products: '作品数',
    favorites: '收藏',
    uniqueVisitors: '独立访客',
    topProducts: '热门作品 Top 5',
    topPerformers: '热门演员 Top 5',
    views: '次观看',
  },
  ko: {
    loading: '로딩 중...',
    fetchError: '데이터를 가져오지 못했습니다',
    daily: '24시간',
    weekly: '주간',
    monthly: '월간',
    totalViews: '총 조회수',
    products: '작품 수',
    favorites: '즐겨찾기',
    uniqueVisitors: '고유 방문자',
    topProducts: '인기 작품 Top 5',
    topPerformers: '인기 배우 Top 5',
    views: '조회',
  },
} as const;

interface AnalyticsData {
  totalViews: number;
  totalProducts: number;
  totalFavorites: number;
  uniqueVisitors: number;
  topProducts: Array<{
    id: number;
    title: string;
    views: number;
  }>;
  topPerformers: Array<{
    id: number;
    name: string;
    views: number;
  }>;
}

export default function AnalyticsDashboard() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/analytics?period=${period}`);
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AnalyticsDashboard] Failed to fetch analytics:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-400">
        {t.loading}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-400">
        {t.fetchError}
      </div>
    );
  }

  const stats = [
    {
      label: t.totalViews,
      value: data.totalViews.toLocaleString(),
      icon: Eye,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: t.products,
      value: data.totalProducts.toLocaleString(),
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: t.favorites,
      value: data.totalFavorites.toLocaleString(),
      icon: Heart,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
    },
    {
      label: t.uniqueVisitors,
      value: data.uniqueVisitors.toLocaleString(),
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {(['daily', 'weekly', 'monthly'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === p
                ? 'bg-rose-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {p === 'daily' && t.daily}
            {p === 'weekly' && t.weekly}
            {p === 'monthly' && t.monthly}
          </button>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">{stat.label}</span>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Top products */}
      {data.topProducts && data.topProducts.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4">{t.topProducts}</h3>
          <div className="space-y-3">
            {data.topProducts.slice(0, 5).map((product, index) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-600 text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{product.title}</p>
                  <p className="text-sm text-gray-400">{product.views.toLocaleString()} {t.views}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top performers */}
      {data.topPerformers && data.topPerformers.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4">{t.topPerformers}</h3>
          <div className="space-y-3">
            {data.topPerformers.slice(0, 5).map((performer, index) => (
              <div
                key={performer.id}
                className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{performer.name}</p>
                  <p className="text-sm text-gray-400">{performer.views.toLocaleString()} {t.views}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
