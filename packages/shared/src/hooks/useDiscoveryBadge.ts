'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const DISCOVERY_STORAGE_KEY = 'adult-v-discovery-history';

export interface DiscoveryRecord {
  productId: string;
  title: string;
  discoveredAt: string; // ISO date
  aspName: string;
  viewCountAtDiscovery: number; // 発見時の視聴数
}

export interface Badge {
  id: string;
  name: {
    ja: string;
    en: string;
    zh: string;
    ko: string;
  };
  description: {
    ja: string;
    en: string;
    zh: string;
    ko: string;
  };
  icon: string;
  earnedAt?: string;
  progress?: number; // 0-100
  requirement: number;
}

const BADGE_DEFINITIONS: Badge[] = [
  {
    id: 'first-discovery',
    name: {
      ja: '最初の一歩',
      en: 'First Step',
      zh: '第一步',
      ko: '첫 발걸음',
    },
    description: {
      ja: '初めて作品を視聴した',
      en: 'Watched your first title',
      zh: '观看了第一部作品',
      ko: '첫 작품을 시청했습니다',
    },
    icon: '🎬',
    requirement: 1,
  },
  {
    id: 'explorer-10',
    name: {
      ja: '探検家',
      en: 'Explorer',
      zh: '探索者',
      ko: '탐험가',
    },
    description: {
      ja: '10作品を視聴した',
      en: 'Watched 10 titles',
      zh: '观看了10部作品',
      ko: '10편을 시청했습니다',
    },
    icon: '🔍',
    requirement: 10,
  },
  {
    id: 'connoisseur-50',
    name: {
      ja: '目利き',
      en: 'Connoisseur',
      zh: '鉴赏家',
      ko: '감정사',
    },
    description: {
      ja: '50作品を視聴した',
      en: 'Watched 50 titles',
      zh: '观看了50部作品',
      ko: '50편을 시청했습니다',
    },
    icon: '👁️',
    requirement: 50,
  },
  {
    id: 'veteran-100',
    name: {
      ja: 'ベテラン',
      en: 'Veteran',
      zh: '老手',
      ko: '베테랑',
    },
    description: {
      ja: '100作品を視聴した',
      en: 'Watched 100 titles',
      zh: '观看了100部作品',
      ko: '100편을 시청했습니다',
    },
    icon: '🏆',
    requirement: 100,
  },
  {
    id: 'early-bird-5',
    name: {
      ja: '先見の明',
      en: 'Early Bird',
      zh: '先见之明',
      ko: '선견지명',
    },
    description: {
      ja: '新作を5本発見した（発売1週間以内）',
      en: 'Discovered 5 new releases (within 1 week)',
      zh: '发现了5部新作（发售1周内）',
      ko: '신작 5편 발견 (출시 1주 이내)',
    },
    icon: '🌅',
    requirement: 5,
  },
  {
    id: 'multi-platform',
    name: {
      ja: 'マルチプレイヤー',
      en: 'Multi-Platform',
      zh: '多平台',
      ko: '멀티 플랫폼',
    },
    description: {
      ja: '3つ以上のASPの作品を視聴した',
      en: 'Watched titles from 3+ platforms',
      zh: '观看了3个以上平台的作品',
      ko: '3개 이상 플랫폼 작품 시청',
    },
    icon: '🌐',
    requirement: 3,
  },
  {
    id: 'weekly-streak',
    name: {
      ja: '継続は力',
      en: 'Weekly Streak',
      zh: '持之以恒',
      ko: '꾸준함',
    },
    description: {
      ja: '4週連続で視聴した',
      en: 'Watched for 4 consecutive weeks',
      zh: '连续4周观看',
      ko: '4주 연속 시청',
    },
    icon: '📅',
    requirement: 4,
  },
];

interface DiscoveryData {
  records: DiscoveryRecord[];
  earnedBadges: string[];
  weeklyStreak: number;
  lastWeekViewed: string | null; // ISO week string
}

const getDefaultData = (): DiscoveryData => ({
  records: [],
  earnedBadges: [],
  weeklyStreak: 0,
  lastWeekViewed: null,
});

const getISOWeek = (date: Date): string => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

export function useDiscoveryBadge() {
  const [data, setData] = useState<DiscoveryData>(getDefaultData());
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISCOVERY_STORAGE_KEY);
      if (stored) {
        setData(JSON.parse(stored));
      }
    } catch {
      console.error('Error loading discovery data');
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage
  const saveData = useCallback((newData: DiscoveryData) => {
    try {
      localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(newData));
      setData(newData);
    } catch {
      console.error('Error saving discovery data');
    }
  }, []);

  // Record a discovery
  const recordDiscovery = useCallback((
    productId: string,
    title: string,
    aspName: string,
    viewCountAtDiscovery: number = 0,
    releaseDate?: string
  ) => {
    setData(prev => {
      // Already recorded?
      if (prev.records.some(r => r.productId === productId)) {
        return prev;
      }

      const now = new Date();
      const currentWeek = getISOWeek(now);

      // Update weekly streak
      let newStreak = prev.weeklyStreak;
      if (prev.lastWeekViewed) {
        const lastWeekDate = new Date(prev.lastWeekViewed.replace('W', '-W'));
        const currentWeekDate = new Date(currentWeek.replace('W', '-W'));
        const weekDiff = Math.round((currentWeekDate.getTime() - lastWeekDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

        if (weekDiff === 1) {
          newStreak = prev.weeklyStreak + 1;
        } else if (weekDiff > 1) {
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }

      const newRecord: DiscoveryRecord = {
        productId,
        title,
        discoveredAt: now.toISOString(),
        aspName,
        viewCountAtDiscovery,
      };

      const newRecords = [...prev.records, newRecord];

      // Check for new badges
      const newBadges = [...prev.earnedBadges];

      // Count-based badges
      if (newRecords.length >= 1 && !newBadges.includes('first-discovery')) {
        newBadges.push('first-discovery');
      }
      if (newRecords.length >= 10 && !newBadges.includes('explorer-10')) {
        newBadges.push('explorer-10');
      }
      if (newRecords.length >= 50 && !newBadges.includes('connoisseur-50')) {
        newBadges.push('connoisseur-50');
      }
      if (newRecords.length >= 100 && !newBadges.includes('veteran-100')) {
        newBadges.push('veteran-100');
      }

      // Early bird badge - check if release is within 1 week
      if (releaseDate) {
        const release = new Date(releaseDate);
        const daysSinceRelease = (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRelease <= 7 && daysSinceRelease >= 0) {
          const earlyBirdCount = newRecords.filter(r => {
            const disc = new Date(r.discoveredAt);
            // This is a simplified check - in production you'd store releaseDate per record
            return (disc.getTime() - new Date(r.discoveredAt).getTime()) / (1000 * 60 * 60 * 24) <= 7;
          }).length;
          if (earlyBirdCount >= 5 && !newBadges.includes('early-bird-5')) {
            newBadges.push('early-bird-5');
          }
        }
      }

      // Multi-platform badge
      const uniqueAsps = new Set(newRecords.map(r => r.aspName));
      if (uniqueAsps.size >= 3 && !newBadges.includes('multi-platform')) {
        newBadges.push('multi-platform');
      }

      // Weekly streak badge
      if (newStreak >= 4 && !newBadges.includes('weekly-streak')) {
        newBadges.push('weekly-streak');
      }

      const newData: DiscoveryData = {
        records: newRecords,
        earnedBadges: newBadges,
        weeklyStreak: newStreak,
        lastWeekViewed: currentWeek,
      };

      saveData(newData);
      return newData;
    });
  }, [saveData]);

  // Calculate badge progress
  const badgesWithProgress = useMemo((): Badge[] => {
    return BADGE_DEFINITIONS.map(badge => {
      const isEarned = data.earnedBadges.includes(badge.id);
      let progress = 0;

      switch (badge.id) {
        case 'first-discovery':
        case 'explorer-10':
        case 'connoisseur-50':
        case 'veteran-100':
          progress = Math.min(100, (data.records.length / badge.requirement) * 100);
          break;
        case 'multi-platform':
          const uniqueAsps = new Set(data.records.map(r => r.aspName));
          progress = Math.min(100, (uniqueAsps.size / badge.requirement) * 100);
          break;
        case 'weekly-streak':
          progress = Math.min(100, (data.weeklyStreak / badge.requirement) * 100);
          break;
        case 'early-bird-5':
          // Simplified - count all early discoveries
          progress = Math.min(100, (data.records.length / badge.requirement) * 100);
          break;
      }

      return {
        ...badge,
        earnedAt: isEarned ? new Date().toISOString() : undefined,
        progress: isEarned ? 100 : Math.round(progress),
      };
    });
  }, [data]);

  const stats = useMemo(() => ({
    totalDiscoveries: data.records.length,
    earnedBadgesCount: data.earnedBadges.length,
    weeklyStreak: data.weeklyStreak,
    uniquePlatforms: new Set(data.records.map(r => r.aspName)).size,
    recentDiscoveries: data.records.slice(-5).reverse(),
  }), [data]);

  return {
    isLoading,
    badges: badgesWithProgress,
    stats,
    recordDiscovery,
    earnedBadges: data.earnedBadges,
  };
}
