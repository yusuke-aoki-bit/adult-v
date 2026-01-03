'use client';

import { useCompareList, CompareItem } from '../hooks/useCompareList';

interface CompareButtonProps {
  product: Omit<CompareItem, 'addedAt'>;
  locale?: string;
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function CompareButton({
  product,
  locale = 'ja',
  theme = 'dark',
  size = 'md',
  showLabel = false,
  className = '',
}: CompareButtonProps) {
  const { toggleItem, isInCompareList, isFull, count, maxItems } = useCompareList();

  const isInList = isInCompareList(product.id);
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

    if (!isInList && isFull) {
      // 満杯の場合は最も古いものを削除して追加
      toggleItem(product);
    } else {
      toggleItem(product);
    }
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
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-pink-600 text-white hover:bg-pink-700'
          : isDark
            ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600 hover:text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
        }
        ${className}
      `}
    >
      {isInList ? (
        <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 3v18h6V3H9zm-2 0H3v18h4V3zm12 0h-4v18h4V3z" />
        </svg>
      ) : (
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v18h6V3H9zm-2 0H3v18h4V3zm12 0h-4v18h4V3z" />
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

export default CompareButton;
