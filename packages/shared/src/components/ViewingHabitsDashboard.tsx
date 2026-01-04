'use client';

import { useState, useMemo } from 'react';
import { useViewingDiary, YearlyStats } from '../hooks/useViewingDiary';

export interface ViewingHabitsDashboardProps {
  locale?: string;
  theme?: 'dark' | 'light';
  onPerformerClick?: (id: number | string, name: string) => void;
  onTagClick?: (tag: string) => void;
}

export function ViewingHabitsDashboard({
  locale = 'ja',
  theme = 'dark',
  onPerformerClick,
  onTagClick,
}: ViewingHabitsDashboardProps) {
  const { entries, isLoading, getYearlyStats, availableYears } = useViewingDiary();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const isDark = theme === 'dark';

  const t = {
    title: locale === 'ja' ? '視聴習慣ダッシュボード' : 'Viewing Habits Dashboard',
    noData: locale === 'ja' ? 'まだ視聴履歴がありません' : 'No viewing history yet',
    loading: locale === 'ja' ? '読み込み中...' : 'Loading...',
    totalViews: locale === 'ja' ? '視聴数' : 'Total Views',
    totalDuration: locale === 'ja' ? '視聴時間' : 'Total Duration',
    avgRating: locale === 'ja' ? '平均評価' : 'Avg. Rating',
    topPerformers: locale === 'ja' ? 'よく視聴した出演者' : 'Top Performers',
    topTags: locale === 'ja' ? 'よく視聴したジャンル' : 'Top Genres',
    monthlyTrend: locale === 'ja' ? '月別視聴数' : 'Monthly Trend',
    times: locale === 'ja' ? '回' : ' times',
    hours: locale === 'ja' ? '時間' : 'h',
    minutes: locale === 'ja' ? '分' : 'm',
    viewStreak: locale === 'ja' ? '視聴ストリーク' : 'View Streak',
    currentStreak: locale === 'ja' ? '現在' : 'Current',
    longestStreak: locale === 'ja' ? '最長' : 'Longest',
    days: locale === 'ja' ? '日' : ' days',
    weekdayPattern: locale === 'ja' ? '曜日別パターン' : 'Weekday Pattern',
    sunday: locale === 'ja' ? '日' : 'Sun',
    monday: locale === 'ja' ? '月' : 'Mon',
    tuesday: locale === 'ja' ? '火' : 'Tue',
    wednesday: locale === 'ja' ? '水' : 'Wed',
    thursday: locale === 'ja' ? '木' : 'Thu',
    friday: locale === 'ja' ? '金' : 'Fri',
    saturday: locale === 'ja' ? '土' : 'Sat',
    viewsThisWeek: locale === 'ja' ? '今週の視聴' : 'Views This Week',
    viewsThisMonth: locale === 'ja' ? '今月の視聴' : 'Views This Month',
  };

  const weekdays = [t.sunday, t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday];

  const yearlyStats = useMemo<YearlyStats | null>(() => {
    if (availableYears.length === 0) return null;
    const year = availableYears.includes(selectedYear) ? selectedYear : availableYears[0];
    return getYearlyStats(year);
  }, [selectedYear, availableYears, getYearlyStats]);

  // 曜日別統計を計算
  const weekdayStats = useMemo(() => {
    const stats = Array(7).fill(0);
    entries.forEach((entry) => {
      const day = new Date(entry.viewedAt).getDay();
      stats[day]++;
    });
    const max = Math.max(...stats, 1);
    return stats.map((count) => ({ count, percentage: (count / max) * 100 }));
  }, [entries]);

  // 視聴ストリーク計算
  const streakStats = useMemo(() => {
    if (entries.length === 0) return { current: 0, longest: 0 };

    const dates = new Set(
      entries.map((e) => new Date(e.viewedAt).toISOString().split('T')[0])
    );
    const sortedDates = Array.from(dates).sort();

    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 1;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // 最長ストリーク計算
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / 86400000;

      if (diffDays === 1) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);

    // 現在のストリーク計算
    if (dates.has(today) || dates.has(yesterday)) {
      streak = 1;
      let checkDate = dates.has(today) ? today : yesterday;
      while (true) {
        const prevDate = new Date(new Date(checkDate).getTime() - 86400000)
          .toISOString()
          .split('T')[0];
        if (dates.has(prevDate)) {
          streak++;
          checkDate = prevDate;
        } else {
          break;
        }
      }
      currentStreak = streak;
    }

    return { current: currentStreak, longest: longestStreak };
  }, [entries]);

  // 今週/今月の視聴数
  const recentStats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisWeek = entries.filter((e) => e.viewedAt >= startOfWeek.getTime()).length;
    const thisMonth = entries.filter((e) => e.viewedAt >= startOfMonth.getTime()).length;

    return { thisWeek, thisMonth };
  }, [entries]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}${t.hours} ${mins}${t.minutes}`;
    }
    return `${mins}${t.minutes}`;
  };

  if (isLoading) {
    return (
      <div className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center gap-2">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t.loading}</span>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={`p-6 rounded-xl text-center ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <svg className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t.noData}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
      {/* ヘッダー */}
      <div className={`p-4 flex items-center justify-between ${isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
        <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t.title}
        </h2>
        {availableYears.length > 1 && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              isDark
                ? 'bg-gray-700 text-white border-gray-600'
                : 'bg-gray-100 text-gray-900 border-gray-300'
            }`}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.totalViews}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {yearlyStats?.totalCount || 0}
              <span className={`text-sm font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.times}</span>
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.totalDuration}</p>
            <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {formatDuration(yearlyStats?.totalDuration || 0)}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.viewsThisWeek}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {recentStats.thisWeek}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.avgRating}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`}>
              {yearlyStats?.averageRating ? yearlyStats.averageRating.toFixed(1) : '-'}
              <span className="text-sm">★</span>
            </p>
          </div>
        </div>

        {/* ストリーク */}
        <div className={`p-4 rounded-lg ${isDark ? 'bg-linear-to-r from-orange-900/30 to-red-900/30 border border-orange-800/50' : 'bg-linear-to-r from-orange-50 to-red-50 border border-orange-200'}`}>
          <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
            🔥 {t.viewStreak}
          </h3>
          <div className="flex gap-6">
            <div>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.currentStreak}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                {streakStats.current}{t.days}
              </p>
            </div>
            <div>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.longestStreak}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {streakStats.longest}{t.days}
              </p>
            </div>
          </div>
        </div>

        {/* 月別トレンド */}
        {yearlyStats && (
          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.monthlyTrend}
            </h3>
            <div className="flex items-end gap-1 h-24">
              {yearlyStats.monthlyTrend.map((month, index) => {
                const maxCount = Math.max(...yearlyStats.monthlyTrend.map((m) => m.count), 1);
                const height = (month.count / maxCount) * 100;
                return (
                  <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t transition-all ${
                        isDark ? 'bg-blue-600' : 'bg-pink-500'
                      }`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${month.count}${t.times}`}
                    />
                    <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {index + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 曜日別パターン */}
        <div>
          <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {t.weekdayPattern}
          </h3>
          <div className="space-y-2">
            {weekdayStats.map((stat, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className={`w-8 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {weekdays[index]}
                </span>
                <div className={`flex-1 h-4 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div
                    className={`h-full rounded-full transition-all ${isDark ? 'bg-purple-500' : 'bg-purple-400'}`}
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
                <span className={`w-8 text-xs text-right ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {stat.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* トップ出演者 */}
        {yearlyStats && yearlyStats.topPerformers.length > 0 && (
          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.topPerformers}
            </h3>
            <div className="flex flex-wrap gap-2">
              {yearlyStats.topPerformers.slice(0, 5).map((performer, index) => (
                <button
                  key={performer.name}
                  type="button"
                  onClick={() => performer.id && onPerformerClick?.(performer.id, performer.name)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    performer.id
                      ? isDark
                        ? 'bg-purple-600/30 text-purple-300 hover:bg-purple-600/50'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      : isDark
                        ? 'bg-gray-700 text-gray-300'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                    index === 0
                      ? 'bg-yellow-500 text-yellow-900'
                      : index === 1
                        ? 'bg-gray-300 text-gray-700'
                        : index === 2
                          ? 'bg-orange-400 text-orange-900'
                          : isDark
                            ? 'bg-gray-600 text-gray-300'
                            : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </span>
                  {performer.name}
                  <span className={isDark ? 'text-purple-400' : 'text-purple-500'}>
                    ({performer.count})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* トップジャンル */}
        {yearlyStats && yearlyStats.topTags.length > 0 && (
          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.topTags}
            </h3>
            <div className="flex flex-wrap gap-2">
              {yearlyStats.topTags.slice(0, 8).map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => onTagClick?.(tag.name)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    isDark
                      ? 'bg-blue-600/30 text-blue-300 hover:bg-blue-600/50'
                      : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                  }`}
                >
                  {tag.name}
                  <span className={`ml-1 ${isDark ? 'text-blue-400' : 'text-pink-500'}`}>
                    ({tag.count})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewingHabitsDashboard;
