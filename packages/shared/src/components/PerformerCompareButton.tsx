'use client';

import { usePerformerCompareList, type PerformerCompareItem } from '../hooks/usePerformerCompareList';

interface PerformerCompareButtonProps {
  performer: Omit<PerformerCompareItem, 'addedAt'>;
  locale?: string;
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function PerformerCompareButton({
  performer,
  locale = 'ja',
  theme = 'dark',
  size = 'md',
  showLabel = false,
  className = '',
}: PerformerCompareButtonProps) {
  const { toggleItem, isInCompareList, isFull, maxItems } = usePerformerCompareList();

  const isInList = isInCompareList(performer.id);
  const isDark = theme === 'dark';

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const t = {
    addToCompare: locale === 'ja' ? '比較に追加' : 'Add to compare',
    removeFromCompare: locale === 'ja' ? '比較から削除' : 'Remove from compare',
    compareFull: locale === 'ja' ? `比較リストが満杯（${maxItems}件）` : `Compare list full (${maxItems} items)`,
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(performer);
  };

  const label = isInList ? t.removeFromCompare : (isFull ? t.compareFull : t.addToCompare);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={label}
      aria-label={label}
      className={`
        ${sizeClasses[size]}
        ${showLabel ? 'flex items-center gap-1.5 px-3' : ''}
        rounded-lg transition-all duration-200
        ${isInList
          ? isDark
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : 'bg-purple-600 text-white hover:bg-purple-700'
          : isDark
            ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600 hover:text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
        }
        ${className}
      `}
    >
      {/* 人物比較アイコン */}
      {isInList ? (
        <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
      ) : (
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )}
      {showLabel && (
        <span className="text-sm font-medium whitespace-nowrap">
          {isInList ? t.removeFromCompare : t.addToCompare}
        </span>
      )}
    </button>
  );
}

export default PerformerCompareButton;
