'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, Tag, TrendingUp } from 'lucide-react';

interface Maker {
  id: number;
  name: string;
  category: string;
  productCount: number;
}

const translations = {
  ja: {
    title: 'メーカー・レーベル一覧',
    description: '人気のメーカー・レーベルから作品を探す',
    makers: 'メーカー',
    labels: 'レーベル',
    all: 'すべて',
    products: '作品',
    loading: '読み込み中...',
    noMakers: 'メーカーが見つかりません',
  },
  en: {
    title: 'Makers & Labels',
    description: 'Browse products by popular makers and labels',
    makers: 'Makers',
    labels: 'Labels',
    all: 'All',
    products: 'products',
    loading: 'Loading...',
    noMakers: 'No makers found',
  },
  zh: {
    title: '厂商・品牌列表',
    description: '按热门厂商和品牌浏览作品',
    makers: '厂商',
    labels: '品牌',
    all: '全部',
    products: '部作品',
    loading: '加载中...',
    noMakers: '未找到厂商',
  },
  ko: {
    title: '메이커・레이블 목록',
    description: '인기 메이커와 레이블로 작품 검색',
    makers: '메이커',
    labels: '레이블',
    all: '전체',
    products: '작품',
    loading: '로딩 중...',
    noMakers: '메이커를 찾을 수 없습니다',
  },
} as const;

type TranslationKey = keyof typeof translations;

export default function MakersPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as TranslationKey] || translations.ja;

  const [makers, setMakers] = useState<Maker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'both' | 'maker' | 'label'>('both');

  useEffect(() => {
    async function fetchMakers() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/makers?category=${filter}&locale=${locale}&limit=100`);
        const data = await res.json();
        setMakers(data.makers || []);
      } catch (error) {
        console.error('Error fetching makers:', error);
        setMakers([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchMakers();
  }, [filter, locale]);

  return (
    <div className="min-h-screen theme-body">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-blue-400" />
            {t.title}
          </h1>
          <p className="text-gray-400 mt-2">{t.description}</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('both')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'both'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {t.all}
          </button>
          <button
            onClick={() => setFilter('maker')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'maker'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-1" />
            {t.makers}
          </button>
          <button
            onClick={() => setFilter('label')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'label'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Tag className="w-4 h-4 inline mr-1" />
            {t.labels}
          </button>
        </div>

        {/* Makers List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-4">{t.loading}</p>
          </div>
        ) : makers.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-gray-400 mt-4">{t.noMakers}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {makers.map((maker) => (
              <Link
                key={maker.id}
                href={`/${locale}/makers/${maker.id}`}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                      {maker.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        maker.category === 'maker'
                          ? 'bg-blue-900 text-blue-300'
                          : 'bg-purple-900 text-purple-300'
                      }`}>
                        {maker.category === 'maker' ? t.makers : t.labels}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-400">
                    <TrendingUp className="w-4 h-4" />
                    {maker.productCount.toLocaleString()} {t.products}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
