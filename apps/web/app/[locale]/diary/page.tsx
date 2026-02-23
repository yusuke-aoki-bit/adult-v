'use client';

import { useState, useMemo } from 'react';
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
import { normalizeImageUrl } from '@adult-v/shared/lib/image-utils';
import { localizedHref } from '@adult-v/shared/i18n';
import UserPreferenceProfileWrapper from '@/components/UserPreferenceProfileWrapper';

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
        <div className="mb-2 h-8 w-48 animate-pulse rounded bg-gray-700" />
        <div className="h-5 w-64 animate-pulse rounded bg-gray-700" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-gray-800 p-4">
              <div className="flex gap-4">
                <div className="h-28 w-20 rounded bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 rounded bg-gray-700" />
                  <div className="h-4 w-1/2 rounded bg-gray-700" />
                  <div className="h-4 w-1/4 rounded bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-64 animate-pulse rounded-lg bg-gray-800 p-4" />
          <div className="h-48 animate-pulse rounded-lg bg-gray-800 p-4" />
        </div>
      </div>
    </div>
  );
}

// 月別トレンドの簡易バーチャート
function MonthlyTrendChart({ data, max }: { data: Array<{ month: string; count: number }>; max: number }) {
  const monthLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((item, index) => {
        const height = max > 0 ? (item.count / max) * 100 : 0;
        return (
          <div key={item.month} className="flex flex-1 flex-col items-center">
            <div
              className="w-full rounded-t bg-rose-600 transition-all"
              style={{ height: `${Math.max(height, 4)}%` }}
              title={`${item.count}`}
            />
            <span className="mt-1 text-[10px] text-gray-500">{monthLabels[index]}</span>
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
          className={`${sizeClass} ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`}
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
    <div className="hover:bg-gray-750 group rounded-lg bg-gray-800 p-4 transition-colors">
      <div className="flex gap-4">
        {/* サムネイル */}
        <Link href={localizedHref(`/products/${entry.productId}`, locale)} className="shrink-0">
          <div className="relative h-28 w-20 overflow-hidden rounded">
            <Image src={imageUrl} alt={entry.title} fill sizes="80px" className="object-cover" />
          </div>
        </Link>

        {/* 情報 */}
        <div className="min-w-0 flex-1">
          <Link href={localizedHref(`/products/${entry.productId}`, locale)}>
            <h3 className="line-clamp-2 font-medium text-white transition-colors hover:text-rose-400">{entry.title}</h3>
          </Link>

          {entry.performerName && (
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-400">
              <User className="h-3 w-3" />
              {entry.performerName}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(entry.viewedAt).toLocaleDateString(dateLocale)}
            </span>
            {entry.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {entry.duration}
                {t.minutes}
              </span>
            )}
          </div>

          {entry.rating && (
            <div className="mt-2">
              <StarRating rating={entry.rating} />
            </div>
          )}

          {entry.note && <p className="mt-2 line-clamp-2 text-sm text-gray-400">{entry.note}</p>}
        </div>

        {/* 削除ボタン */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-1 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
          title={t.deleteEntry}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-gray-800 p-6">
            <p className="mb-4 text-white">{t.confirmDelete}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  onDelete(entry.id);
                  setShowDeleteConfirm(false);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
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

export default function DiaryPage() {
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations['ja'];

  const { entries, isLoading, removeEntry, getYearlyStats, availableYears } = useViewingDiary();

  const [activeTab, setActiveTab] = useState<'history' | 'stats'>('history');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

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

  if (isLoading) {
    return <DiarySkeleton />;
  }

  return (
    <div className="theme-body min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-white">
            <BookOpen className="h-8 w-8 text-rose-600" />
            {t.title}
          </h1>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        {/* タブ */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
              activeTab === 'history' ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Film className="h-4 w-4" />
            {t.history}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
              activeTab === 'stats' ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            {t.stats}
          </button>
        </div>

        {entries.length === 0 ? (
          /* 空の状態 */
          <div className="py-16 text-center">
            <BookOpen className="mx-auto mb-4 h-16 w-16 text-gray-700" />
            <p className="mb-2 text-lg text-gray-400">{t.empty}</p>
            <p className="text-sm text-gray-500">{t.emptyDesc}</p>
          </div>
        ) : activeTab === 'history' ? (
          /* 履歴タブ */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 履歴リスト */}
            <div className="space-y-3 lg:col-span-2">
              {entries.map((entry) => (
                <DiaryEntryCard key={entry.id} entry={entry} locale={locale} t={t} onDelete={removeEntry} />
              ))}
            </div>

            {/* サイドバー統計 */}
            <div className="space-y-4">
              {/* あなたの好みプロファイル */}
              <UserPreferenceProfileWrapper locale={locale} />

              {/* 概要カード */}
              <div className="rounded-lg bg-gray-800 p-4">
                <h3 className="mb-4 flex items-center gap-2 font-medium text-white">
                  <TrendingUp className="h-4 w-4 text-rose-600" />
                  {t.yearStats} {selectedYear}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-750 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{yearStats.totalCount}</div>
                    <div className="text-xs text-gray-400">{t.totalViewed}</div>
                  </div>
                  <div className="bg-gray-750 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{Math.floor(yearStats.totalDuration / 60)}</div>
                    <div className="text-xs text-gray-400">
                      {t.totalTime} ({t.hours})
                    </div>
                  </div>
                </div>

                {yearStats.averageRating > 0 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <span className="text-sm text-gray-400">{t.avgRating}:</span>
                    <StarRating rating={Math.round(yearStats.averageRating)} size="md" />
                    <span className="font-medium text-white">{yearStats.averageRating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* 月別トレンド */}
              <div className="rounded-lg bg-gray-800 p-4">
                <h3 className="mb-4 flex items-center gap-2 font-medium text-white">
                  <BarChart3 className="h-4 w-4 text-rose-600" />
                  {t.monthlyTrend}
                </h3>
                <MonthlyTrendChart data={yearStats.monthlyTrend} max={maxMonthlyCount} />
              </div>

              {/* よく見た女優 */}
              {yearStats.topPerformers.length > 0 && (
                <div className="rounded-lg bg-gray-800 p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-medium text-white">
                    <User className="h-4 w-4 text-rose-600" />
                    {t.topPerformers}
                  </h3>
                  <div className="space-y-2">
                    {yearStats.topPerformers.slice(0, 5).map((performer, index) => (
                      <div key={performer.name} className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">
                          {index + 1}. {performer.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {performer.count}
                          {t.works}
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
                className="rounded-lg bg-gray-800 p-2 text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-xl font-bold text-white">{selectedYear}</span>
              <button
                onClick={() => setSelectedYear((y) => y + 1)}
                disabled={selectedYear >= new Date().getFullYear()}
                className="rounded-lg bg-gray-800 p-2 text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* 統計カード */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-gray-800 p-6 text-center">
                <Film className="mx-auto mb-2 h-8 w-8 text-rose-600" />
                <div className="text-3xl font-bold text-white">{yearStats.totalCount}</div>
                <div className="text-sm text-gray-400">{t.totalViewed}</div>
              </div>
              <div className="rounded-lg bg-gray-800 p-6 text-center">
                <Clock className="mx-auto mb-2 h-8 w-8 text-rose-600" />
                <div className="text-3xl font-bold text-white">{formatDuration(yearStats.totalDuration)}</div>
                <div className="text-sm text-gray-400">{t.totalTime}</div>
              </div>
              <div className="rounded-lg bg-gray-800 p-6 text-center">
                <Star className="mx-auto mb-2 h-8 w-8 text-rose-600" />
                <div className="text-3xl font-bold text-white">
                  {yearStats.averageRating > 0 ? yearStats.averageRating.toFixed(1) : '-'}
                </div>
                <div className="text-sm text-gray-400">{t.avgRating}</div>
              </div>
              <div className="rounded-lg bg-gray-800 p-6 text-center">
                <TrendingUp className="mx-auto mb-2 h-8 w-8 text-rose-600" />
                <div className="text-3xl font-bold text-white">{Math.round((yearStats.totalCount / 12) * 10) / 10}</div>
                <div className="text-sm text-gray-400">{t.works}/月</div>
              </div>
            </div>

            {/* 月別トレンド（大きめ） */}
            <div className="rounded-lg bg-gray-800 p-6">
              <h3 className="mb-6 font-medium text-white">{t.monthlyTrend}</h3>
              <div className="h-48">
                <MonthlyTrendChart data={yearStats.monthlyTrend} max={maxMonthlyCount} />
              </div>
            </div>

            {/* ランキング */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* よく見た女優 */}
              <div className="rounded-lg bg-gray-800 p-6">
                <h3 className="mb-4 flex items-center gap-2 font-medium text-white">
                  <User className="h-5 w-5 text-rose-600" />
                  {t.topPerformers}
                </h3>
                {yearStats.topPerformers.length > 0 ? (
                  <div className="space-y-3">
                    {yearStats.topPerformers.map((performer, index) => (
                      <div key={performer.name} className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            index === 0
                              ? 'bg-yellow-500 text-black'
                              : index === 1
                                ? 'bg-gray-400 text-black'
                                : index === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="flex-1 text-gray-300">{performer.name}</span>
                        <span className="text-gray-500">
                          {performer.count}
                          {t.works}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-gray-500">{t.noData}</p>
                )}
              </div>

              {/* よく見たジャンル */}
              <div className="rounded-lg bg-gray-800 p-6">
                <h3 className="mb-4 flex items-center gap-2 font-medium text-white">
                  <Film className="h-5 w-5 text-rose-600" />
                  {t.topTags}
                </h3>
                {yearStats.topTags.length > 0 ? (
                  <div className="space-y-3">
                    {yearStats.topTags.map((tag, index) => (
                      <div key={tag.name} className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            index === 0
                              ? 'bg-yellow-500 text-black'
                              : index === 1
                                ? 'bg-gray-400 text-black'
                                : index === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="flex-1 text-gray-300">{tag.name}</span>
                        <span className="text-gray-500">
                          {tag.count}
                          {t.works}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-gray-500">{t.noData}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
