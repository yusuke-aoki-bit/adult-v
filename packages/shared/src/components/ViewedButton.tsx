'use client';

import { useState, useCallback, useEffect } from 'react';
import { Check, Eye } from 'lucide-react';
import { useViewingDiary, type DiaryEntry } from '../hooks/useViewingDiary';

// Default translations (Japanese) for when translations prop is not provided
const DEFAULT_TRANSLATIONS = {
  markAsViewed: '視聴済みにする',
  unmarkAsViewed: '視聴済みを解除',
  viewed: '視聴済み',
  viewCount: (count: number) => `${count}回視聴`,
  addedToDiary: '視聴履歴に追加しました',
  removedFromDiary: '視聴履歴から削除しました',
};

export interface ViewedButtonTranslations {
  markAsViewed?: string;
  unmarkAsViewed?: string;
  viewed?: string;
  viewCount?: (count: number) => string;
  addedToDiary?: string;
  removedFromDiary?: string;
}

interface ViewedButtonProps {
  productId: string;
  title: string;
  imageUrl: string | null;
  aspName: string;
  performerName?: string;
  performerId?: number | string;
  tags?: string[];
  duration?: number;
  /** ボタンサイズ */
  size?: 'xs' | 'sm' | 'md';
  /** アイコンのみ表示 */
  iconOnly?: boolean;
  /** カスタムクラス */
  className?: string;
  /** Optional translations - uses Japanese defaults if not provided */
  translations?: ViewedButtonTranslations;
}

export default function ViewedButton({
  productId,
  title,
  imageUrl,
  aspName,
  performerName,
  performerId,
  tags,
  duration,
  size = 'sm',
  iconOnly = false,
  className = '',
  translations = {},
}: ViewedButtonProps) {
  // Merge provided translations with defaults
  const t = {
    ...DEFAULT_TRANSLATIONS,
    ...translations,
  };

  const { entries, addEntry, removeEntry, getViewCountForProduct } = useViewingDiary();
  const [isViewed, setIsViewed] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [showToast, setShowToast] = useState<string | null>(null);

  // SSR対策: クライアントサイドでのみ視聴済み状態を確認
  useEffect(() => {
    const count = getViewCountForProduct(productId);
    setViewCount(count);
    setIsViewed(count > 0);
  }, [entries, productId, getViewCountForProduct]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isViewed) {
      // 視聴済み解除: この商品の最新のエントリを削除
      const latestEntry = entries.find((entry) => entry.productId === productId);
      if (latestEntry) {
        removeEntry(latestEntry.id);
        setShowToast(t.removedFromDiary);
      }
    } else {
      // 視聴済みマーク
      const newEntry: Omit<DiaryEntry, 'id' | 'createdAt'> = {
        productId,
        title,
        imageUrl,
        aspName,
        performerName,
        performerId,
        tags,
        duration,
        viewedAt: Date.now(),
      };
      addEntry(newEntry);
      setShowToast(t.addedToDiary);
    }

    // トースト表示後に消す
    setTimeout(() => setShowToast(null), 2000);
  }, [isViewed, entries, productId, title, imageUrl, aspName, performerName, performerId, tags, duration, addEntry, removeEntry, t]);

  const sizeClasses = {
    xs: 'p-1 text-[10px]',
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
  }[size];

  const iconSize = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  }[size];

  const viewCountText = typeof t.viewCount === 'function'
    ? t.viewCount(viewCount)
    : `${viewCount}回視聴`;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`
          rounded-full transition-all duration-200
          ${isViewed
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-gray-700/80 text-gray-300 hover:bg-gray-600 hover:text-white'
          }
          ${sizeClasses}
          ${iconOnly ? '' : 'flex items-center gap-1'}
          ${className}
        `}
        title={isViewed ? t.unmarkAsViewed : t.markAsViewed}
        aria-label={isViewed ? t.unmarkAsViewed : t.markAsViewed}
        aria-pressed={isViewed}
      >
        {isViewed ? (
          <>
            <Check className={iconSize} />
            {!iconOnly && (
              <span className="whitespace-nowrap">
                {viewCount > 1 ? viewCountText : t.viewed}
              </span>
            )}
          </>
        ) : (
          <>
            <Eye className={iconSize} />
            {!iconOnly && <span className="whitespace-nowrap">{t.markAsViewed}</span>}
          </>
        )}
      </button>

      {/* トースト通知 */}
      {showToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          {showToast}
        </div>
      )}
    </>
  );
}
