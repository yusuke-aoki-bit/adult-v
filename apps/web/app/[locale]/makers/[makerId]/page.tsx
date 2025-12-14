'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Building2, Tag, Users, Film, Star, TrendingUp, Calendar } from 'lucide-react';

interface MakerInfo {
  id: number;
  name: string;
  category: 'maker' | 'label';
  productCount: number;
  averageRating: number | null;
  topPerformers: Array<{ id: number; name: string; productCount: number }>;
  topGenres: Array<{ id: number; name: string; productCount: number }>;
  yearlyStats: Array<{ year: number; count: number }>;
  recentProducts: Array<{
    id: number;
    title: string;
    imageUrl: string;
    releaseDate: string | null;
  }>;
}

const translations = {
  ja: {
    loading: '読み込み中...',
    notFound: 'メーカーが見つかりません',
    backToList: 'メーカー一覧に戻る',
    products: '作品',
    rating: '平均評価',
    topPerformers: '人気女優',
    topGenres: '人気ジャンル',
    yearlyProduction: '年別作品数',
    recentProducts: '最新作品',
    viewAll: 'すべて見る',
    viewProducts: '作品を見る',
    maker: 'メーカー',
    label: 'レーベル',
    works: '作品',
  },
  en: {
    loading: 'Loading...',
    notFound: 'Maker not found',
    backToList: 'Back to makers',
    products: 'products',
    rating: 'Average Rating',
    topPerformers: 'Top Performers',
    topGenres: 'Top Genres',
    yearlyProduction: 'Yearly Production',
    recentProducts: 'Recent Products',
    viewAll: 'View All',
    viewProducts: 'View Products',
    maker: 'Maker',
    label: 'Label',
    works: 'works',
  },
  zh: {
    loading: '加载中...',
    notFound: '未找到厂商',
    backToList: '返回厂商列表',
    products: '部作品',
    rating: '平均评分',
    topPerformers: '人气女优',
    topGenres: '人气类型',
    yearlyProduction: '年度作品数',
    recentProducts: '最新作品',
    viewAll: '查看全部',
    viewProducts: '查看作品',
    maker: '厂商',
    label: '品牌',
    works: '部',
  },
  ko: {
    loading: '로딩 중...',
    notFound: '메이커를 찾을 수 없습니다',
    backToList: '메이커 목록으로',
    products: '작품',
    rating: '평균 평점',
    topPerformers: '인기 배우',
    topGenres: '인기 장르',
    yearlyProduction: '연도별 작품 수',
    recentProducts: '최신 작품',
    viewAll: '전체 보기',
    viewProducts: '작품 보기',
    maker: '메이커',
    label: '레이블',
    works: '작품',
  },
} as const;

type TranslationKey = keyof typeof translations;

export default function MakerDetailPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const makerId = params?.makerId as string;
  const t = translations[locale as TranslationKey] || translations.ja;

  const [maker, setMaker] = useState<MakerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMaker() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/makers/${makerId}?locale=${locale}`);
        const data = await res.json();
        setMaker(data.maker || null);
      } catch (error) {
        console.error('Error fetching maker:', error);
        setMaker(null);
      } finally {
        setIsLoading(false);
      }
    }
    if (makerId) {
      fetchMaker();
    }
  }, [makerId, locale]);

  if (isLoading) {
    return (
      <div className="min-h-screen theme-body flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-4">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!maker) {
    return (
      <div className="min-h-screen theme-body flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto" />
          <p className="text-gray-400 mt-4">{t.notFound}</p>
          <Link
            href={`/${locale}/makers`}
            className="mt-4 inline-block text-blue-400 hover:text-blue-300"
          >
            {t.backToList}
          </Link>
        </div>
      </div>
    );
  }

  const maxYearlyCount = Math.max(...maker.yearlyStats.map(y => y.count), 1);

  return (
    <div className="min-h-screen theme-body">
      <div className="container mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href={`/${locale}/makers`}
          className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block"
        >
          ← {t.backToList}
        </Link>

        {/* Header */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              {maker.category === 'maker' ? (
                <Building2 className="w-8 h-8 text-white" />
              ) : (
                <Tag className="w-8 h-8 text-white" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{maker.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  maker.category === 'maker'
                    ? 'bg-blue-900 text-blue-300'
                    : 'bg-purple-900 text-purple-300'
                }`}>
                  {maker.category === 'maker' ? t.maker : t.label}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-gray-400">
                <span className="flex items-center gap-1">
                  <Film className="w-4 h-4" />
                  {maker.productCount.toLocaleString()} {t.products}
                </span>
                {maker.averageRating && (
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400" />
                    {maker.averageRating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Yearly Stats */}
            {maker.yearlyStats.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  {t.yearlyProduction}
                </h2>
                <div className="space-y-2">
                  {maker.yearlyStats.slice(0, 8).reverse().map((stat) => (
                    <div key={stat.year} className="flex items-center gap-3">
                      <span className="text-gray-400 w-12 text-sm">{stat.year}</span>
                      <div className="flex-1 bg-gray-700 rounded-full h-6 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${(stat.count / maxYearlyCount) * 100}%` }}
                        >
                          <span className="text-xs text-white font-medium">
                            {stat.count}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Products */}
            {maker.recentProducts.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    {t.recentProducts}
                  </h2>
                  <Link
                    href={`/${locale}/categories/${maker.id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    {t.viewAll} →
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {maker.recentProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/${locale}/products/${product.id}`}
                      className="group"
                    >
                      <div className="aspect-[2/3] relative rounded-lg overflow-hidden bg-gray-700">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Film className="w-8 h-8 text-gray-500" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 group-hover:text-white transition-colors">
                        {product.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Top Performers */}
            {maker.topPerformers.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-pink-400" />
                  {t.topPerformers}
                </h2>
                <div className="space-y-3">
                  {maker.topPerformers.map((performer, index) => (
                    <Link
                      key={performer.id}
                      href={`/${locale}/actress/${performer.id}`}
                      className="flex items-center justify-between hover:bg-gray-700 p-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          index === 2 ? 'bg-amber-600 text-white' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-white">{performer.name}</span>
                      </div>
                      <span className="text-sm text-gray-400">
                        {performer.productCount} {t.works}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Top Genres */}
            {maker.topGenres.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-purple-400" />
                  {t.topGenres}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {maker.topGenres.map((genre) => (
                    <Link
                      key={genre.id}
                      href={`/${locale}/categories/${genre.id}`}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-full text-sm text-gray-300 hover:text-white transition-colors"
                    >
                      {genre.name}
                      <span className="ml-1 text-gray-500">({genre.productCount})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* View All Products Button */}
            <Link
              href={`/${locale}/categories/${maker.id}`}
              className="block w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-center rounded-xl font-semibold transition-colors"
            >
              {t.viewProducts} ({maker.productCount})
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
