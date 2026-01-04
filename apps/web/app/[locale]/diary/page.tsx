'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  Clock,
  Star,
  TrendingUp,
  User,
  Film,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Trash2,
} from 'lucide-react';
import { useViewingDiary } from '@/hooks';
import type { DiaryEntry } from '@adult-v/shared/hooks';
import { normalizeImageUrl } from '@/lib/image-utils';
import { localizedHref } from '@adult-v/shared/i18n';
import { TopPageUpperSections, TopPageLowerSections } from '@/components/TopPageSections';
import UserPreferenceProfileWrapper from '@/components/UserPreferenceProfileWrapper';
import { PageSectionNav } from '@adult-v/shared/components';

const translations = {
  ja: {
    title: '視聴日記',
    subtitle: 'あなたの視聴履歴を記録・分析',
    loading: '読み込み中...',
    empty: 'まだ視聴記録がありません',
    emptyDesc: '作品を視聴して「視聴済み」にすると、ここに記録されます',
    stats: '統計',
    history: '履歴',
    yearStats: '年間統計',
    monthStats: '月別統計',
    totalViewed: '総視聴数',
    totalTime: '総視聴時間',
    avgRating: '平均評価',
    topPerformers: 'よく見た女優',
    topTags: 'よく見たジャンル',
    monthlyTrend: '月別推移',
    works: '作品',
    hours: '時間',
    minutes: '分',
    noData: 'データなし',
    viewDetail: '詳細を見る',
    viewedOn: '視聴日',
    deleteEntry: '削除',
    confirmDelete: 'この記録を削除しますか？',
    cancel: 'キャンセル',
    delete: '削除',
  },
  en: {
    title: 'Viewing Diary',
    subtitle: 'Record and analyze your viewing history',
    loading: 'Loading...',
    empty: 'No viewing records yet',
    emptyDesc: 'Mark products as "Viewed" to record them here',
    stats: 'Stats',
    history: 'History',
    yearStats: 'Yearly Stats',
    monthStats: 'Monthly Stats',
    totalViewed: 'Total Viewed',
    totalTime: 'Total Time',
    avgRating: 'Avg Rating',
    topPerformers: 'Top Performers',
    topTags: 'Top Tags',
    monthlyTrend: 'Monthly Trend',
    works: 'works',
    hours: 'hours',
    minutes: 'min',
    noData: 'No data',
    viewDetail: 'View detail',
    viewedOn: 'Viewed on',
    deleteEntry: 'Delete',
    confirmDelete: 'Delete this record?',
    cancel: 'Cancel',
    delete: 'Delete',
  },
  zh: {
    title: '观看日记',
    subtitle: '记录和分析您的观看历史',
    loading: '加载中...',
    empty: '暂无观看记录',
    emptyDesc: '将作品标记为"已观看"后会记录在此',
    stats: '统计',
    history: '历史',
    yearStats: '年度统计',
    monthStats: '月度统计',
    totalViewed: '总观看数',
    totalTime: '总时长',
    avgRating: '平均评分',
    topPerformers: '常看女优',
    topTags: '常看类型',
    monthlyTrend: '月度趋势',
    works: '部',
    hours: '小时',
    minutes: '分钟',
    noData: '无数据',
    viewDetail: '查看详情',
    viewedOn: '观看日期',
    deleteEntry: '删除',
    confirmDelete: '删除此记录？',
    cancel: '取消',
    delete: '删除',
  },
  ko: {
    title: '시청 일기',
    subtitle: '시청 기록을 기록하고 분석하세요',
    loading: '로딩 중...',
    empty: '시청 기록이 없습니다',
    emptyDesc: '작품을 "시청 완료"로 표시하면 여기에 기록됩니다',
    stats: '통계',
    history: '기록',
    yearStats: '연간 통계',
    monthStats: '월별 통계',
    totalViewed: '총 시청',
    totalTime: '총 시간',
    avgRating: '평균 평점',
    topPerformers: '자주 본 배우',
    topTags: '자주 본 장르',
    monthlyTrend: '월별 추이',
    works: '작품',
    hours: '시간',
    minutes: '분',
    noData: '데이터 없음',
    viewDetail: '상세 보기',
    viewedOn: '시청일',
    deleteEntry: '삭제',
    confirmDelete: '이 기록을 삭제하시겠습니까?',
    cancel: '취소',
    delete: '삭제',
  },
} as const;

type Translations = typeof translations;
type TranslationKeys = keyof Translations;
type Translation = Translations[TranslationKeys];

const PLACEHOLDER_IMAGE = 'https://placehold.co/160x224/1f2937/ffffff?text=NO+IMAGE';

function DiarySkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-48 bg-gray-700 rounded animate-pulse mb-2" />
        <div className="h-5 w-64 bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-20 h-28 bg-gray-700 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-700 rounded w-3/4" />
                  <div className="h-4 bg-gray-700 rounded w-1/2" />
                  <div className="h-4 bg-gray-700 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-4 h-64 animate-pulse" />
          <div className="bg-gray-800 rounded-lg p-4 h-48 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// 月別トレンドの簡易バーチャート
function MonthlyTrendChart({ data, max }: { data: Array<{ month: string; count: number }>; max: number }) {
  const monthLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((item, index) => {
        const height = max > 0 ? (item.count / max) * 100 : 0;
        return (
          <div key={item.month} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-rose-600 rounded-t transition-all"
              style={{ height: `${Math.max(height, 4)}%` }}
              title={`${item.count}`}
            />
            <span className="text-[10px] text-gray-500 mt-1">{monthLabels[index]}</span>
          </div>
        );
      })}
    </div>
  );
}

// 星評価表示
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
        />
      ))}
    </div>
  );
}

// 履歴エントリーカード
function DiaryEntryCard({
  entry,
  locale,
  t,
  onDelete,
}: {
  entry: DiaryEntry;
  locale: string;
  t: Translation;
  onDelete: (id: string) => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const imageUrl = entry.imageUrl ? normalizeImageUrl(entry.imageUrl) : PLACEHOLDER_IMAGE;
  const dateLocale = locale === 'ko' ? 'ko-KR' : locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ja-JP';

  return (
    <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors group">
      <div className="flex gap-4">
        {/* サムネイル */}
        <Link href={localizedHref(`/products/${entry.productId}`, locale)} className="shrink-0">
          <div className="relative w-20 h-28 rounded overflow-hidden">
            <Image
              src={imageUrl}
              alt={entry.title}
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
        </Link>

        {/* 情報 */}
        <div className="flex-1 min-w-0">
          <Link href={localizedHref(`/products/${entry.productId}`, locale)}>
            <h3 className="text-white font-medium line-clamp-2 hover:text-rose-400 transition-colors">
              {entry.title}
            </h3>
          </Link>

          {entry.performerName && (
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
              <User className="w-3 h-3" />
              {entry.performerName}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(entry.viewedAt).toLocaleDateString(dateLocale)}
            </span>
            {entry.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {entry.duration}{t.minutes}
              </span>
            )}
          </div>

          {entry.rating && (
            <div className="mt-2">
              <StarRating rating={entry.rating} />
            </div>
          )}

          {entry.note && (
            <p className="text-sm text-gray-400 mt-2 line-clamp-2">{entry.note}</p>
          )}
        </div>

        {/* 削除ボタン */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400 p-1"
          title={t.deleteEntry}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <p className="text-white mb-4">{t.confirmDelete}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  onDelete(entry.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SaleProduct {
  productId: number;
  normalizedProductId: string | null;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: string | null;
  performers: Array<{ id: number; name: string }>;
}

export default function DiaryPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const {
    entries,
    isLoading,
    removeEntry,
    getYearlyStats,
    availableYears,
  } = useViewingDiary();

  const [activeTab, setActiveTab] = useState<'history' | 'stats'>('history');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  // PageLayout用のデータ
  const [saleProducts, setSaleProducts] = useState<SaleProduct[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  useEffect(() => {
    // セール商品を取得
    fetch('/api/products/on-sale?limit=24&minDiscount=30')
      .then(res => res.json())
      .then(data => setSaleProducts(data.products || []))
      .catch(() => {});

    // 未整理商品数を取得
    fetch('/api/products/uncategorized-count')
      .then(res => res.json())
      .then(data => setUncategorizedCount(data.count || 0))
      .catch(() => {});
  }, []);

  // 年間統計
  const yearStats = useMemo(() => {
    return getYearlyStats(selectedYear);
  }, [getYearlyStats, selectedYear]);

  // 月別トレンドの最大値
  const maxMonthlyCount = useMemo(() => {
    return Math.max(...yearStats.monthlyTrend.map((m) => m.count), 1);
  }, [yearStats.monthlyTrend]);

  // 時間のフォーマット
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}${t.hours} ${mins}${t.minutes}`;
    }
    return `${mins}${t.minutes}`;
  };

  // PageLayout用の翻訳
  const layoutTranslations = {
    viewProductList: '作品一覧',
    viewProductListDesc: '全ての配信サイトの作品を横断検索',
    uncategorizedBadge: '未整理',
    uncategorizedDescription: '未整理作品',
    uncategorizedCount: `${uncategorizedCount.toLocaleString()}件`,
  };

  if (isLoading) {
    return <DiarySkeleton />;
  }

  // セクションナビゲーション用の翻訳
  const sectionLabels: Record<string, Record<string, string>> = {
    ja: { diary: '視聴日記' },
    en: { diary: 'Viewing Diary' },
    zh: { diary: '观看日记' },
    ko: { diary: '시청 일기' },
  };

  return (
    <div className="theme-body min-h-screen">
      {/* セクションナビゲーション */}
      <PageSectionNav
        locale={locale}
        config={{
          hasSale: saleProducts.length > 0,
          hasRecentlyViewed: true,
          mainSectionId: 'diary',
          mainSectionLabel: sectionLabels[locale]?.diary || sectionLabels.ja.diary,
          hasRecommendations: true,
          hasWeeklyHighlights: true,
          hasTrending: true,
          hasAllProducts: true,
        }}
        theme="dark"
      />

      {/* 上部セクション（セール中・最近見た作品） */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageUpperSections locale={locale} saleProducts={saleProducts} />
        </div>
      </section>

      <div id="diary" className="container mx-auto px-4 py-8 scroll-mt-20">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-rose-600" />
            {t.title}
          </h1>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

      {/* タブ */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-rose-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Film className="w-4 h-4" />
          {t.history}
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'stats'
              ? 'bg-rose-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          {t.stats}
        </button>
      </div>

      {entries.length === 0 ? (
        /* 空の状態 */
        <div className="text-center py-16">
          <BookOpen className="h-16 w-16 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">{t.empty}</p>
          <p className="text-gray-500 text-sm">{t.emptyDesc}</p>
        </div>
      ) : activeTab === 'history' ? (
        /* 履歴タブ */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 履歴リスト */}
          <div className="lg:col-span-2 space-y-3">
            {entries.map((entry) => (
              <DiaryEntryCard
                key={entry.id}
                entry={entry}
                locale={locale}
                t={t}
                onDelete={removeEntry}
              />
            ))}
          </div>

          {/* サイドバー統計 */}
          <div className="space-y-4">
            {/* あなたの好みプロファイル */}
            <UserPreferenceProfileWrapper locale={locale} />

            {/* 概要カード */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-600" />
                {t.yearStats} {selectedYear}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-750 rounded-lg">
                  <div className="text-2xl font-bold text-white">{yearStats.totalCount}</div>
                  <div className="text-xs text-gray-400">{t.totalViewed}</div>
                </div>
                <div className="text-center p-3 bg-gray-750 rounded-lg">
                  <div className="text-2xl font-bold text-white">
                    {Math.floor(yearStats.totalDuration / 60)}
                  </div>
                  <div className="text-xs text-gray-400">{t.totalTime} ({t.hours})</div>
                </div>
              </div>

              {yearStats.averageRating > 0 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="text-sm text-gray-400">{t.avgRating}:</span>
                  <StarRating rating={Math.round(yearStats.averageRating)} size="md" />
                  <span className="text-white font-medium">
                    {yearStats.averageRating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            {/* 月別トレンド */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-rose-600" />
                {t.monthlyTrend}
              </h3>
              <MonthlyTrendChart data={yearStats.monthlyTrend} max={maxMonthlyCount} />
            </div>

            {/* よく見た女優 */}
            {yearStats.topPerformers.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-rose-600" />
                  {t.topPerformers}
                </h3>
                <div className="space-y-2">
                  {yearStats.topPerformers.slice(0, 5).map((performer, index) => (
                    <div key={performer.name} className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">
                        {index + 1}. {performer.name}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {performer.count}{t.works}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 統計タブ */
        <div className="space-y-6">
          {/* 年選択 */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedYear((y) => y - 1)}
              disabled={!availableYears.includes(selectedYear - 1) && selectedYear <= Math.min(...availableYears)}
              className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xl font-bold text-white">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear((y) => y + 1)}
              disabled={selectedYear >= new Date().getFullYear()}
              className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <Film className="w-8 h-8 text-rose-600 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">{yearStats.totalCount}</div>
              <div className="text-sm text-gray-400">{t.totalViewed}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <Clock className="w-8 h-8 text-rose-600 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">
                {formatDuration(yearStats.totalDuration)}
              </div>
              <div className="text-sm text-gray-400">{t.totalTime}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <Star className="w-8 h-8 text-rose-600 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">
                {yearStats.averageRating > 0 ? yearStats.averageRating.toFixed(1) : '-'}
              </div>
              <div className="text-sm text-gray-400">{t.avgRating}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <TrendingUp className="w-8 h-8 text-rose-600 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">
                {Math.round(yearStats.totalCount / 12 * 10) / 10}
              </div>
              <div className="text-sm text-gray-400">{t.works}/月</div>
            </div>
          </div>

          {/* 月別トレンド（大きめ） */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-white font-medium mb-6">{t.monthlyTrend}</h3>
            <div className="h-48">
              <MonthlyTrendChart data={yearStats.monthlyTrend} max={maxMonthlyCount} />
            </div>
          </div>

          {/* ランキング */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* よく見た女優 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-rose-600" />
                {t.topPerformers}
              </h3>
              {yearStats.topPerformers.length > 0 ? (
                <div className="space-y-3">
                  {yearStats.topPerformers.map((performer, index) => (
                    <div key={performer.name} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        index === 2 ? 'bg-amber-700 text-white' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="flex-1 text-gray-300">{performer.name}</span>
                      <span className="text-gray-500">{performer.count}{t.works}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">{t.noData}</p>
              )}
            </div>

            {/* よく見たジャンル */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Film className="w-5 h-5 text-rose-600" />
                {t.topTags}
              </h3>
              {yearStats.topTags.length > 0 ? (
                <div className="space-y-3">
                  {yearStats.topTags.map((tag, index) => (
                    <div key={tag.name} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        index === 2 ? 'bg-amber-700 text-white' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="flex-1 text-gray-300">{tag.name}</span>
                      <span className="text-gray-500">{tag.count}{t.works}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">{t.noData}</p>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* 下部セクション（おすすめ・注目・トレンド・リンク） */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageLowerSections
            locale={locale}
            uncategorizedCount={uncategorizedCount}
            isTopPage={false}
            isFanzaSite={false}
            translations={layoutTranslations}
          />
        </div>
      </section>
    </div>
  );
}
