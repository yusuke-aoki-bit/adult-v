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

  const filteredMakers = makers.filter((m) => {
    if (!searchQuery) return true;
    const name =
      locale === 'en' && m.nameEn
        ? m.nameEn
        : locale === 'zh' && m.nameZh
          ? m.nameZh
          : locale === 'ko' && m.nameKo
            ? m.nameKo
            : m.name;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getLocalizedName = (maker: Maker) => {
    return locale === 'en' && maker.nameEn
      ? maker.nameEn
      : locale === 'zh' && maker.nameZh
        ? maker.nameZh
        : locale === 'ko' && maker.nameKo
          ? maker.nameKo
          : maker.name;
  };

  return (
    <div className="theme-body min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white sm:text-3xl">
            <Building2 className="h-7 w-7 text-rose-400" />
            {t.title}
          </h1>
          <p className="mt-2 text-gray-400">{t.description}</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="flex gap-2">
            {(['both', 'maker', 'label'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                  category === cat ? 'bg-rose-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {cat === 'both' ? t.all : cat === 'maker' ? t.makers : t.labels}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="w-full rounded-lg bg-gray-700 py-2 pr-4 pl-10 text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-rose-500 border-t-transparent" />
            <p className="mt-4 text-gray-400">{t.loading}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredMakers.map((maker) => (
              <Link
                key={maker.id}
                href={localizedHref(`/makers/${maker.id}`, locale)}
                className="group rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      maker.category === 'maker' ? 'bg-rose-500/20' : 'bg-purple-500/20'
                    }`}
                  >
                    {maker.category === 'maker' ? (
                      <Building2
                        className={`h-5 w-5 ${maker.category === 'maker' ? 'text-rose-400' : 'text-purple-400'}`}
                      />
                    ) : (
                      <Tag className="h-5 w-5 text-purple-400" />
                    )}
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      maker.category === 'maker' ? 'bg-rose-900 text-rose-300' : 'bg-purple-900 text-purple-300'
                    }`}
                  >
                    {maker.category === 'maker' ? t.makers : t.labels}
                  </span>
                </div>
                <h3 className="line-clamp-2 font-semibold text-white transition-colors group-hover:text-rose-400">
                  {getLocalizedName(maker)}
                </h3>
                <div className="mt-2 flex items-center gap-3 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Film className="h-3 w-3" />
                    {maker.productCount.toLocaleString()} {t.products}
                  </span>
                  {maker.averageRating && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-400" />
                      {maker.averageRating.toFixed(1)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && filteredMakers.length === 0 && (
          <div className="py-12 text-center">
            <Building2 className="mx-auto h-16 w-16 text-gray-600" />
            <p className="mt-4 text-gray-400">No makers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
