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
      className={`relative p-3 rounded-lg border transition-all ${
        isEarned
          ? 'bg-linear-to-br from-yellow-50 to-amber-50 border-yellow-300'
          : 'bg-gray-50 border-gray-200 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`text-2xl shrink-0 ${
            isEarned ? '' : 'grayscale'
          }`}
        >
          {badge.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm ${isEarned ? 'text-yellow-700' : 'text-gray-500'}`}>
            {name}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {description}
          </p>
          {!isEarned && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-yellow-400 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${badge.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{badge.progress}%</p>
            </div>
          )}
        </div>
        {isEarned && (
          <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
        )}
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
      <div className={`bg-white rounded-lg p-6 shadow ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const displayedBadges = showAll ? badges : badges.slice(0, 4);
  const earnedBadges = badges.filter(b => b.progress === 100);

  return (
    <div className={`bg-white rounded-lg p-6 shadow ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          {t.title}
        </h3>
        <div className="flex items-center gap-1 text-yellow-600">
          <Trophy className="w-4 h-4" />
          <span className="font-bold">{earnedBadges.length}</span>
          <span className="text-gray-400">/ {badges.length}</span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <Eye className="w-4 h-4 text-blue-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{stats.totalDiscoveries}</p>
          <p className="text-xs text-gray-500">{t.totalDiscoveries}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <Trophy className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{stats.earnedBadgesCount}</p>
          <p className="text-xs text-gray-500">{t.earnedBadges}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <Flame className="w-4 h-4 text-orange-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{stats.weeklyStreak}</p>
          <p className="text-xs text-gray-500">{t.streak}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-sm mb-1">🌐</div>
          <p className="text-lg font-bold text-gray-900">{stats.uniquePlatforms}</p>
          <p className="text-xs text-gray-500">{t.platforms}</p>
        </div>
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-2 gap-2">
        {displayedBadges.map(badge => (
          <BadgeCard key={badge.id} badge={badge} locale={locale} />
        ))}
      </div>

      {badges.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" />
              {t.collapse}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              {t.viewAll} ({badges.length})
            </>
          )}
        </button>
      )}

      {/* Recent Discoveries */}
      {stats.recentDiscoveries.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-500 mb-2">{t.recentDiscoveries}</h4>
          <div className="space-y-1">
            {stats.recentDiscoveries.slice(0, 3).map(discovery => (
              <div
                key={discovery.productId}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-700 truncate flex-1">{discovery.title}</span>
                <span className="text-gray-400 text-xs ml-2">{discovery.aspName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
