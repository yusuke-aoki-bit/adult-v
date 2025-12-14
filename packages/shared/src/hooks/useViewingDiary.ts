'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// 視聴記録の型定義
export interface DiaryEntry {
  id: string;
  productId: string;
  title: string;
  imageUrl: string | null;
  aspName: string;
  performerName?: string;
  performerId?: number | string;
  tags?: string[];
  duration?: number; // 分
  rating?: number; // 1-5
  note?: string;
  viewedAt: number; // timestamp
  createdAt: number;
}

// 月別統計
export interface MonthlyStats {
  month: string; // YYYY-MM
  count: number;
  totalDuration: number;
  topPerformer?: { name: string; count: number };
  topTag?: { name: string; count: number };
  averageRating: number;
}

// 年間統計
export interface YearlyStats {
  year: number;
  totalCount: number;
  totalDuration: number;
  topPerformers: Array<{ name: string; id?: number | string; count: number }>;
  topTags: Array<{ name: string; count: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
  averageRating: number;
}

const SITE_MODE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_SITE_MODE || 'adult-v')
  : 'adult-v';
const STORAGE_KEY = `viewing_diary_${SITE_MODE}`;
const MAX_ENTRIES = 500;

export function useViewingDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ローカルストレージから読み込み
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DiaryEntry[];
        setEntries(parsed);
      }
    } catch (error) {
      console.error('Failed to load viewing diary:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // エントリーを追加
  const addEntry = useCallback((entry: Omit<DiaryEntry, 'id' | 'createdAt'>) => {
    setEntries((prev) => {
      const newEntry: DiaryEntry = {
        ...entry,
        id: `${entry.productId}-${Date.now()}`,
        createdAt: Date.now(),
      };

      const updated = [newEntry, ...prev].slice(0, MAX_ENTRIES);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save viewing diary:', error);
      }

      return updated;
    });
  }, []);

  // エントリーを更新（評価やメモの追加）
  const updateEntry = useCallback((id: string, updates: Partial<Pick<DiaryEntry, 'rating' | 'note'>>) => {
    setEntries((prev) => {
      const updated = prev.map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry
      );

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to update viewing diary:', error);
      }

      return updated;
    });
  }, []);

  // エントリーを削除
  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const updated = prev.filter((entry) => entry.id !== id);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to remove diary entry:', error);
      }

      return updated;
    });
  }, []);

  // 全件クリア
  const clearAll = useCallback(() => {
    setEntries([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear viewing diary:', error);
    }
  }, []);

  // 月別にグループ化
  const entriesByMonth = useMemo(() => {
    const grouped: Record<string, DiaryEntry[]> = {};
    entries.forEach((entry) => {
      const date = new Date(entry.viewedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(entry);
    });
    return grouped;
  }, [entries]);

  // 月別統計を計算
  const getMonthlyStats = useCallback((month: string): MonthlyStats | null => {
    const monthEntries = entriesByMonth[month];
    if (!monthEntries || monthEntries.length === 0) return null;

    // 出演者集計
    const performerCounts: Record<string, number> = {};
    monthEntries.forEach((entry) => {
      if (entry.performerName) {
        performerCounts[entry.performerName] = (performerCounts[entry.performerName] || 0) + 1;
      }
    });
    const topPerformerEntry = Object.entries(performerCounts).sort((a, b) => b[1] - a[1])[0];

    // タグ集計
    const tagCounts: Record<string, number> = {};
    monthEntries.forEach((entry) => {
      entry.tags?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTagEntry = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];

    // 評価平均
    const ratedEntries = monthEntries.filter((e) => e.rating);
    const averageRating = ratedEntries.length > 0
      ? ratedEntries.reduce((sum, e) => sum + (e.rating || 0), 0) / ratedEntries.length
      : 0;

    return {
      month,
      count: monthEntries.length,
      totalDuration: monthEntries.reduce((sum, e) => sum + (e.duration || 0), 0),
      topPerformer: topPerformerEntry ? { name: topPerformerEntry[0], count: topPerformerEntry[1] } : undefined,
      topTag: topTagEntry ? { name: topTagEntry[0], count: topTagEntry[1] } : undefined,
      averageRating,
    };
  }, [entriesByMonth]);

  // 年間統計を計算
  const getYearlyStats = useCallback((year: number): YearlyStats => {
    const yearEntries = entries.filter((entry) => {
      const entryYear = new Date(entry.viewedAt).getFullYear();
      return entryYear === year;
    });

    // 出演者集計
    const performerCounts: Record<string, { count: number; id?: number | string }> = {};
    yearEntries.forEach((entry) => {
      if (entry.performerName) {
        if (!performerCounts[entry.performerName]) {
          performerCounts[entry.performerName] = { count: 0, id: entry.performerId };
        }
        performerCounts[entry.performerName].count++;
      }
    });
    const topPerformers = Object.entries(performerCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, data]) => ({ name, count: data.count, id: data.id }));

    // タグ集計
    const tagCounts: Record<string, number> = {};
    yearEntries.forEach((entry) => {
      entry.tags?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // 月別トレンド
    const monthlyTrend: Array<{ month: string; count: number }> = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${year}-${String(m).padStart(2, '0')}`;
      const monthCount = yearEntries.filter((entry) => {
        const date = new Date(entry.viewedAt);
        return date.getMonth() + 1 === m;
      }).length;
      monthlyTrend.push({ month: monthKey, count: monthCount });
    }

    // 評価平均
    const ratedEntries = yearEntries.filter((e) => e.rating);
    const averageRating = ratedEntries.length > 0
      ? ratedEntries.reduce((sum, e) => sum + (e.rating || 0), 0) / ratedEntries.length
      : 0;

    return {
      year,
      totalCount: yearEntries.length,
      totalDuration: yearEntries.reduce((sum, e) => sum + (e.duration || 0), 0),
      topPerformers,
      topTags,
      monthlyTrend,
      averageRating,
    };
  }, [entries]);

  // 利用可能な年のリスト
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    entries.forEach((entry) => {
      years.add(new Date(entry.viewedAt).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [entries]);

  // 特定の作品の視聴回数
  const getViewCountForProduct = useCallback((productId: string) => {
    return entries.filter((e) => e.productId === productId).length;
  }, [entries]);

  return {
    entries,
    isLoading,
    addEntry,
    updateEntry,
    removeEntry,
    clearAll,
    entriesByMonth,
    getMonthlyStats,
    getYearlyStats,
    availableYears,
    getViewCountForProduct,
  };
}
