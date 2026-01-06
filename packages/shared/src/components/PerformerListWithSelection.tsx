'use client';

import { useState, ReactNode, useMemo, useCallback, memo } from 'react';
import { usePerformerCompareList } from '../hooks/usePerformerCompareList';
import { SelectableCard } from './SelectableCard';
import { PerformerCompareFloatingBar } from './PerformerCompareFloatingBar';

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

const PerformerItem = memo(function PerformerItem({
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
    <SelectableCard
      isSelected={isSelected}
      isSelectionMode={isSelectionMode}
      onToggle={handleToggle}
      theme={theme}
    >
      {renderChild(performer, index)}
    </SelectableCard>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.theme === nextProps.theme &&
    prevProps.performer === nextProps.performer &&
    prevProps.index === nextProps.index &&
    prevProps.renderChild === nextProps.renderChild
  );
});

export function PerformerListWithSelection({
  performers,
  locale,
  theme = 'dark',
  children,
  className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4',
}: PerformerListWithSelectionProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const { toggleItem, compareSet, count, maxItems, isFull } = usePerformerCompareList();
  const isDark = theme === 'dark';

  // 翻訳オブジェクトをメモ化
  const t = useMemo(() => ({
    selectToCompare: locale === 'ja' ? '比較選択モード' : 'Select to Compare',
    exitSelection: locale === 'ja' ? '選択終了' : 'Exit Selection',
    selected: locale === 'ja' ? '選択中' : 'Selected',
    maxReached: locale === 'ja' ? `最大${maxItems}名まで選択可能` : `Max ${maxItems} performers`,
  }), [locale, maxItems]);

  // コールバックをメモ化
  const handleTogglePerformer = useCallback((performer: Performer) => {
    toggleItem({
      id: performer['id'],
      name: performer['name'],
      imageUrl: performer.imageUrl || null,
      ...(performer.productCount !== undefined && { productCount: performer.productCount }),
    });
  }, [toggleItem]);

  const handleToggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => !prev);
  }, []);

  return (
    <>
      {/* 比較選択モード切替ボタン */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSelectionMode}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isSelectionMode
                ? isDark
                  ? 'bg-purple-600 text-white'
                  : 'bg-pink-600 text-white'
                : isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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
          <span className={`text-sm ${isDark ? 'text-yellow-500' : 'text-yellow-600'}`}>
            {t.maxReached}
          </span>
        )}
      </div>

      {/* 演者グリッド */}
      <div className={className}>
        {performers.map((performer, index) => (
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
      </div>

      {/* 比較フローティングバー（選択モード時のみ表示） */}
      <PerformerCompareFloatingBar locale={locale} theme={theme} isSelectionMode={isSelectionMode} />
    </>
  );
}

export default PerformerListWithSelection;
