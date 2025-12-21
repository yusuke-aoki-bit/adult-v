'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, Tag, Film, Star, Search } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';

interface Maker {
  id: number;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  nameKo: string | null;
  category: 'maker' | 'label';
  productCount: number;
  averageRating: number | null;
}

const translations = {
  ja: {
    title: 'メーカー・レーベル一覧',
    description: '人気のメーカーやレーベルから作品を探せます',
    loading: '読み込み中...',
    all: 'すべて',
    makers: 'メーカー',
    labels: 'レーベル',
    products: '作品',
    search: 'メーカー名で検索',
  },
  en: {
    title: 'Makers & Labels',
    description: 'Browse products by popular makers and labels',
    loading: 'Loading...',
    all: 'All',
    makers: 'Makers',
    labels: 'Labels',
    products: 'products',
    search: 'Search by name',
  },
  zh: {
    title: '厂商和品牌',
    description: '按热门厂商和品牌浏览作品',
    loading: '加载中...',
    all: '全部',
    makers: '厂商',
    labels: '品牌',
    products: '部作品',
    search: '按名称搜索',
  },
  ko: {
    title: '메이커 & 레이블',
    description: '인기 메이커와 레이블별로 작품을 찾아보세요',
    loading: '로딩 중...',
    all: '전체',
    makers: '메이커',
    labels: '레이블',
    products: '작품',
    search: '이름으로 검색',
  },
} as const;

type TranslationKey = keyof typeof translations;

export default function MakersListPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as TranslationKey] || translations.ja;

  const [makers, setMakers] = useState<Maker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState<'both' | 'maker' | 'label'>('both');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchMakers() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/makers?category=${category}&limit=100&locale=${locale}`);
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
  }, [category, locale]);

  const filteredMakers = makers.filter(m => {
    if (!searchQuery) return true;
    const name = locale === 'en' && m.nameEn ? m.nameEn
      : locale === 'zh' && m.nameZh ? m.nameZh
      : locale === 'ko' && m.nameKo ? m.nameKo
      : m.name;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getLocalizedName = (maker: Maker) => {
    return locale === 'en' && maker.nameEn ? maker.nameEn
      : locale === 'zh' && maker.nameZh ? maker.nameZh
      : locale === 'ko' && maker.nameKo ? maker.nameKo
      : maker.name;
  };

  return (
    <div className="min-h-screen theme-body">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-rose-400" />
            {t.title}
          </h1>
          <p className="text-gray-400 mt-2">{t.description}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex gap-2">
            {(['both', 'maker', 'label'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  category === cat
                    ? 'bg-rose-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {cat === 'both' ? t.all : cat === 'maker' ? t.makers : t.labels}
              </button>
            ))}
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-4">{t.loading}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredMakers.map((maker) => (
              <Link
                key={maker.id}
                href={localizedHref(`/makers/${maker.id}`, locale)}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    maker.category === 'maker'
                      ? 'bg-rose-500/20'
                      : 'bg-purple-500/20'
                  }`}>
                    {maker.category === 'maker' ? (
                      <Building2 className={`w-5 h-5 ${
                        maker.category === 'maker' ? 'text-rose-400' : 'text-purple-400'
                      }`} />
                    ) : (
                      <Tag className="w-5 h-5 text-purple-400" />
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    maker.category === 'maker'
                      ? 'bg-rose-900 text-rose-300'
                      : 'bg-purple-900 text-purple-300'
                  }`}>
                    {maker.category === 'maker' ? t.makers : t.labels}
                  </span>
                </div>
                <h3 className="text-white font-semibold group-hover:text-rose-400 transition-colors line-clamp-2">
                  {getLocalizedName(maker)}
                </h3>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    {maker.productCount.toLocaleString()} {t.products}
                  </span>
                  {maker.averageRating && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400" />
                      {maker.averageRating.toFixed(1)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && filteredMakers.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto" />
            <p className="text-gray-400 mt-4">No makers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
