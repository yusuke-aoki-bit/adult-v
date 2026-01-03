'use client';

import { useState, ReactNode } from 'react';
import { useCompareList } from '../hooks/useCompareList';
import { SelectableCard } from './SelectableCard';
import { CompareFloatingBar } from './CompareFloatingBar';

interface Product {
  id: number | string;
  title: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
}

interface ProductListWithSelectionProps {
  products: Product[];
  locale: string;
  theme?: 'dark' | 'light';
  children: (product: Product, index: number) => ReactNode;
  className?: string;
}

export function ProductListWithSelection({
  products,
  locale,
  theme = 'dark',
  children,
  className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4',
}: ProductListWithSelectionProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const { items, toggleItem, isInCompareList, count, maxItems, isFull } = useCompareList();
  const isDark = theme === 'dark';

  const t = {
    selectToCompare: locale === 'ja' ? '比較選択モード' : 'Select to Compare',
    exitSelection: locale === 'ja' ? '選択終了' : 'Exit Selection',
    selected: locale === 'ja' ? '選択中' : 'Selected',
    maxReached: locale === 'ja' ? `最大${maxItems}件まで選択可能` : `Max ${maxItems} items`,
  };

  const handleToggleProduct = (product: Product) => {
    toggleItem({
      id: product.id,
      title: product.title,
      imageUrl: product.thumbnailUrl || product.imageUrl || null,
    });
  };

  return (
    <>
      {/* 比較選択モード切替ボタン */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isSelectionMode
                ? isDark
                  ? 'bg-blue-600 text-white'
                  : 'bg-pink-600 text-white'
                : isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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

      {/* 商品グリッド */}
      <div className={className}>
        {products.map((product, index) => (
          <SelectableCard
            key={product.id}
            isSelected={isInCompareList(product.id)}
            isSelectionMode={isSelectionMode}
            onToggle={() => handleToggleProduct(product)}
            theme={theme}
          >
            {children(product, index)}
          </SelectableCard>
        ))}
      </div>

      {/* 比較フローティングバー */}
      <CompareFloatingBar locale={locale} theme={theme} />
    </>
  );
}

export default ProductListWithSelection;
