'use client';

import { useState, useCallback } from 'react';
import { useCompareList, CompareItem } from '../hooks/useCompareList';
import { useSiteTheme } from '../contexts/SiteThemeContext';

interface CompareButtonProps {
  product: Omit<CompareItem, 'addedAt'>;
  locale?: string;
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showToast?: boolean;
  className?: string;
}

export function CompareButton({
  product,
  locale = 'ja',
  theme: themeProp,
  size = 'md',
  showLabel = false,
  showToast = true,
  className = '',
}: CompareButtonProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const { toggleItem, isInCompareList, isFull, count, maxItems } = useCompareList();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const isInList = isInCompareList(product['id']);
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

  const texts = {
    ja: { addToCompare: '比較に追加', removeFromCompare: '比較から削除', compareFull: `比較リストが満杯（${maxItems}件）`, added: '比較リストに追加しました', removed: '比較リストから削除しました', checkBottom: '画面下部で比較できます' },
    en: { addToCompare: 'Add to compare', removeFromCompare: 'Remove from compare', compareFull: `Compare list full (${maxItems} items)`, added: 'Added to compare list', removed: 'Removed from compare list', checkBottom: 'Compare at the bottom of screen' },
  } as const;
  const t = texts[locale as keyof typeof texts] || texts.ja;

  const showToastMessage = useCallback((message: string, type: 'success' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const wasInList = isInList;
    toggleItem(product);

    if (showToast) {
      if (wasInList) {
        showToastMessage(t.removed, 'info');
      } else {
        showToastMessage(`${t.added} (${count + 1}/${maxItems})`, 'success');
      }
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
        relative
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

      {/* インライントースト通知 */}
      {toast && (
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg animate-fade-in z-50 ${
            toast.type === 'success'
              ? isDark
                ? 'bg-green-600 text-white'
                : 'bg-green-500 text-white'
              : isDark
                ? 'bg-gray-600 text-white'
                : 'bg-gray-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </button>
  );
}

export default CompareButton;
