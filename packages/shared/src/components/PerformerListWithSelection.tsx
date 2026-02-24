'use client';

import { useState, ReactNode, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import { usePerformerCompareList } from '../hooks/usePerformerCompareList';
import { SelectableCard } from './SelectableCard';
import { PerformerCompareFloatingBar } from './PerformerCompareFloatingBar';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, performerListWithSelectionTranslations } from '../lib/translations';

interface Performer {
  id: number | string;
  name: string;
  imageUrl?: string | null;
  productCount?: number;
}

interface PerformerListWithSelectionProps {
  performers: Performer[];
  locale: string;
  theme?: 'dark' | 'light';
  children: (performer: Performer, index: number) => ReactNode;
  className?: string;
  /** 初期表示アイテム数（デフォルト: 24） */
  initialItems?: number;
  /** 追加読み込みアイテム数（デフォルト: 24） */
  loadMoreItems?: number;
}

// 個別の演者アイテムをメモ化するコンポーネント
interface PerformerItemProps {
  performer: Performer;
  index: number;
  isSelected: boolean;
  isSelectionMode: boolean;
  theme: 'dark' | 'light';
  onToggle: (performer: Performer) => void;
  renderChild: (performer: Performer, index: number) => ReactNode;
}

const PerformerItem = memo(
  function PerformerItem({
    performer,
    index,
    isSelected,
    isSelectionMode,
    theme,
    onToggle,
    renderChild,
  }: PerformerItemProps) {
    const handleToggle = useCallback(() => {
      onToggle(performer);
    }, [onToggle, performer]);

    // 選択モードでない場合はSelectableCardをスキップ
    if (!isSelectionMode) {
      return <>{renderChild(performer, index)}</>;
    }

    return (
      <SelectableCard isSelected={isSelected} isSelectionMode={isSelectionMode} onToggle={handleToggle} theme={theme}>
        {renderChild(performer, index)}
      </SelectableCard>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isSelectionMode === nextProps.isSelectionMode &&
      prevProps.theme === nextProps.theme &&
      prevProps.performer === nextProps.performer &&
      prevProps.index === nextProps.index &&
      prevProps.renderChild === nextProps.renderChild
    );
  },
);

// プレースホルダーコンポーネント（スケルトン）
const PerformerPlaceholder = memo(function PerformerPlaceholder() {
  return (
    <div className="animate-pulse">
      <div className="aspect-2/3 rounded-lg bg-gray-700" />
      <div className="mt-2 h-4 w-3/4 rounded bg-gray-700" />
    </div>
  );
});

// Intersection Observer フック
function useIntersectionObserver(callback: () => void, options?: IntersectionObserverInit) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          callback();
        }
      },
      { rootMargin: '200px', ...options },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [callback, options]);

  return targetRef;
}

export function PerformerListWithSelection({
  performers,
  locale,
  theme: themeProp,
  children,
  className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4',
  initialItems = 24,
  loadMoreItems = 24,
}: PerformerListWithSelectionProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const { toggleItem, compareSet, count, maxItems, isFull } = usePerformerCompareList();
  const isDark = theme === 'dark';

  // 遅延読み込み状態
  const [visibleCount, setVisibleCount] = useState(initialItems);
  const hasMore = visibleCount < performers.length;

  // 追加読み込みコールバック
  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount((prev) => Math.min(prev + loadMoreItems, performers.length));
    }
  }, [hasMore, loadMoreItems, performers.length]);

  // Intersection Observer で自動読み込み
  const loadMoreRef = useIntersectionObserver(loadMore);

  // 表示するアイテム
  const visiblePerformers = useMemo(() => performers.slice(0, visibleCount), [performers, visibleCount]);

  // 翻訳オブジェクトをメモ化
  const t = useMemo(() => {
    const texts = getTranslation(performerListWithSelectionTranslations, locale);
    return {
      ...texts,
      maxReached: `${texts.maxReachedPrefix}${maxItems}${texts.maxReachedSuffix}`,
    };
  }, [locale, maxItems]);

  // コールバックをメモ化
  const handleTogglePerformer = useCallback(
    (performer: Performer) => {
      toggleItem({
        id: performer['id'],
        name: performer['name'],
        imageUrl: performer.imageUrl || null,
        ...(performer.productCount !== undefined && { productCount: performer.productCount }),
      });
    },
    [toggleItem],
  );

  const handleToggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => !prev);
  }, []);

  return (
    <>
      {/* 比較選択モード切替ボタン */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSelectionMode}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isSelectionMode
                ? isDark
                  ? 'bg-purple-600 text-white'
                  : 'bg-fuchsia-600 text-white'
                : isDark
                  ? 'border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {isSelectionMode ? t.exitSelection : t.selectToCompare}
          </button>

          {isSelectionMode && count > 0 && (
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t.selected}: {count}/{maxItems}
            </span>
          )}
        </div>

        {isSelectionMode && isFull && (
          <span className={`text-sm ${isDark ? 'text-yellow-500' : 'text-yellow-600'}`}>{t.maxReached}</span>
        )}
      </div>

      {/* 演者グリッド */}
      <div className={className}>
        {visiblePerformers.map((performer, index) => (
          <PerformerItem
            key={performer['id']}
            performer={performer}
            index={index}
            isSelected={compareSet.has(String(performer['id']))}
            isSelectionMode={isSelectionMode}
            theme={theme}
            onToggle={handleTogglePerformer}
            renderChild={children}
          />
        ))}

        {/* 遅延読み込みセンチネル */}
        {hasMore && (
          <div ref={loadMoreRef} className="col-span-full flex justify-center py-4">
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm">{t.loading}</span>
            </div>
          </div>
        )}
      </div>

      {/* 比較フローティングバー（選択モード時のみ表示） */}
      <PerformerCompareFloatingBar locale={locale} theme={theme} isSelectionMode={isSelectionMode} />
    </>
  );
}

export default PerformerListWithSelection;
