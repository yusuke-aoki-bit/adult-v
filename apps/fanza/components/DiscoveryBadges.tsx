'use client';

import { useState } from 'react';
import { Award, ChevronDown, ChevronUp, Trophy, Flame, Eye } from 'lucide-react';
import { useDiscoveryBadge } from '@/hooks';
import type { Badge } from '@adult-v/shared/hooks';

const translations = {
  ja: {
    title: '発掘者バッジ',
    totalDiscoveries: '発見作品',
    earnedBadges: '獲得バッジ',
    streak: '連続週',
    platforms: 'プラットフォーム',
    progress: '進捗',
    earned: '獲得済み',
    locked: '未獲得',
    viewAll: 'すべて見る',
    collapse: '閉じる',
    recentDiscoveries: '最近の発見',
  },
  en: {
    title: 'Discovery Badges',
    totalDiscoveries: 'Discoveries',
    earnedBadges: 'Badges Earned',
    streak: 'Week Streak',
    platforms: 'Platforms',
    progress: 'Progress',
    earned: 'Earned',
    locked: 'Locked',
    viewAll: 'View All',
    collapse: 'Collapse',
    recentDiscoveries: 'Recent Discoveries',
  },
  zh: {
    title: '发掘者徽章',
    totalDiscoveries: '发现作品',
    earnedBadges: '获得徽章',
    streak: '连续周',
    platforms: '平台',
    progress: '进度',
    earned: '已获得',
    locked: '未获得',
    viewAll: '查看全部',
    collapse: '收起',
    recentDiscoveries: '最近发现',
  },
  ko: {
    title: '발굴자 배지',
    totalDiscoveries: '발견 작품',
    earnedBadges: '획득 배지',
    streak: '연속 주',
    platforms: '플랫폼',
    progress: '진행',
    earned: '획득',
    locked: '미획득',
    viewAll: '전체 보기',
    collapse: '접기',
    recentDiscoveries: '최근 발견',
  },
} as const;

interface DiscoveryBadgesProps {
  locale: string;
  className?: string;
}

function BadgeCard({ badge, locale }: { badge: Badge; locale: string }) {
  const isEarned = badge.progress === 100;
  const name = badge.name[locale as keyof typeof badge.name] || badge.name.ja;
  const description = badge.description[locale as keyof typeof badge.description] || badge.description.ja;

  return (
    <div
      className={`relative rounded-lg border p-3 transition-all ${
        isEarned
          ? 'border-yellow-300 bg-linear-to-br from-yellow-50 to-amber-50'
          : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 text-2xl ${isEarned ? '' : 'grayscale'}`}>{badge.icon}</div>
        <div className="min-w-0 flex-1">
          <h4 className={`text-sm font-medium ${isEarned ? 'text-yellow-700' : 'text-gray-500'}`}>{name}</h4>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{description}</p>
          {!isEarned && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-linear-to-r from-yellow-400 to-amber-400 transition-all duration-500"
                  style={{ width: `${badge.progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">{badge.progress}%</p>
            </div>
          )}
        </div>
        {isEarned && <Trophy className="h-4 w-4 shrink-0 text-yellow-500" />}
      </div>
    </div>
  );
}

export default function DiscoveryBadges({ locale, className = '' }: DiscoveryBadgesProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const { badges, stats, isLoading } = useDiscoveryBadge();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className={`rounded-lg bg-white p-6 shadow ${className}`}>
        <div className="animate-pulse">
          <div className="mb-4 h-6 w-40 rounded bg-gray-200" />
          <div className="h-24 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const displayedBadges = showAll ? badges : badges.slice(0, 4);
  const earnedBadges = badges.filter((b) => b.progress === 100);

  return (
    <div className={`rounded-lg bg-white p-6 shadow ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Award className="h-5 w-5 text-yellow-500" />
          {t.title}
        </h3>
        <div className="flex items-center gap-1 text-yellow-600">
          <Trophy className="h-4 w-4" />
          <span className="font-bold">{earnedBadges.length}</span>
          <span className="text-gray-400">/ {badges.length}</span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <Eye className="mx-auto mb-1 h-4 w-4 text-blue-500" />
          <p className="text-lg font-bold text-gray-900">{stats.totalDiscoveries}</p>
          <p className="text-xs text-gray-500">{t.totalDiscoveries}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <Trophy className="mx-auto mb-1 h-4 w-4 text-yellow-500" />
          <p className="text-lg font-bold text-gray-900">{stats.earnedBadgesCount}</p>
          <p className="text-xs text-gray-500">{t.earnedBadges}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <Flame className="mx-auto mb-1 h-4 w-4 text-orange-500" />
          <p className="text-lg font-bold text-gray-900">{stats.weeklyStreak}</p>
          <p className="text-xs text-gray-500">{t.streak}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <div className="mb-1 text-sm">🌐</div>
          <p className="text-lg font-bold text-gray-900">{stats.uniquePlatforms}</p>
          <p className="text-xs text-gray-500">{t.platforms}</p>
        </div>
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-2 gap-2">
        {displayedBadges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} locale={locale} />
        ))}
      </div>

      {badges.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 flex w-full items-center justify-center gap-1 py-2 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4" />
              {t.collapse}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              {t.viewAll} ({badges.length})
            </>
          )}
        </button>
      )}

      {/* Recent Discoveries */}
      {stats.recentDiscoveries.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <h4 className="mb-2 text-sm font-medium text-gray-500">{t.recentDiscoveries}</h4>
          <div className="space-y-1">
            {stats.recentDiscoveries.slice(0, 3).map((discovery) => (
              <div key={discovery.productId} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate text-gray-700">{discovery.title}</span>
                <span className="ml-2 text-xs text-gray-400">{discovery.aspName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
