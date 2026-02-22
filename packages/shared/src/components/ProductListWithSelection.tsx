'use client';

import { useState, ReactNode, useMemo, useCallback, memo } from 'react';
import { useCompareList } from '../hooks/useCompareList';
import { SelectableCard } from './SelectableCard';
import { CompareFloatingBar } from './CompareFloatingBar';
import { useSiteTheme } from '../contexts/SiteThemeContext';

const productListTexts = {
  ja: { selectToCompare: '比較選択モード', exitSelection: '選択終了', selected: '選択中', maxReachedPrefix: '最大', maxReachedSuffix: '件まで選択可能' },
  en: { selectToCompare: 'Select to Compare', exitSelection: 'Exit Selection', selected: 'Selected', maxReachedPrefix: 'Max ', maxReachedSuffix: ' items' },
  zh: { selectToCompare: '比较选择模式', exitSelection: '结束选择', selected: '已选择', maxReachedPrefix: '最多', maxReachedSuffix: '件可选' },
  'zh-TW': { selectToCompare: '比較選擇模式', exitSelection: '結束選擇', selected: '已選擇', maxReachedPrefix: '最多', maxReachedSuffix: '件可選' },
  ko: { selectToCompare: '비교 선택 모드', exitSelection: '선택 종료', selected: '선택 중', maxReachedPrefix: '최대 ', maxReachedSuffix: '건까지 선택 가능' },
} as const;
function getProductListText(locale: string) { return productListTexts[locale as keyof typeof productListTexts] || productListTexts.ja; }

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

// 個別の商品アイテムをメモ化するコンポーネント
interface ProductItemProps {
  product: Product;
  index: number;
  isSelected: boolean;
  isSelectionMode: boolean;
  theme: 'dark' | 'light';
  onToggle: (product: Product) => void;
  renderChild: (product: Product, index: number) => ReactNode;
}

const ProductItem = memo(function ProductItem({
  product,
  index,
  isSelected,
  isSelectionMode,
  theme,
  onToggle,
  renderChild,
}: ProductItemProps) {
  const handleToggle = useCallback(() => {
    onToggle(product);
  }, [onToggle, product]);

  // 選択モードでない場合はSelectableCardをスキップ
  if (!isSelectionMode) {
    return <>{renderChild(product, index)}</>;
  }

  return (
    <SelectableCard
      isSelected={isSelected}
      isSelectionMode={isSelectionMode}
      onToggle={handleToggle}
      theme={theme}
    >
      {renderChild(product, index)}
    </SelectableCard>
  );
}, (prevProps, nextProps) => {
  // 選択モードと選択状態が変わらなければ再レンダリング不要
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.theme === nextProps.theme &&
    prevProps.product === nextProps.product &&
    prevProps.index === nextProps.index &&
    prevProps.renderChild === nextProps.renderChild
  );
});

export function ProductListWithSelection({
  products,
  locale,
  theme: themeProp,
  children,
  className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4',
}: ProductListWithSelectionProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const { toggleItem, compareSet, count, maxItems, isFull } = useCompareList();
  const isDark = theme === 'dark';

  // 翻訳オブジェクトをメモ化
  const t = useMemo(() => {
    const texts = getProductListText(locale);
    return {
      ...texts,
      maxReached: `${texts.maxReachedPrefix}${maxItems}${texts.maxReachedSuffix}`,
    };
  }, [locale, maxItems]);

  // コールバックをメモ化
  const handleToggleProduct = useCallback((product: Product) => {
    toggleItem({
      id: product['id'],
      title: product['title'],
      imageUrl: product['thumbnailUrl'] || product.imageUrl || null,
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
          <ProductItem
            key={product['id']}
            product={product}
            index={index}
            isSelected={compareSet.has(String(product['id']))}
            isSelectionMode={isSelectionMode}
            theme={theme}
            onToggle={handleToggleProduct}
            renderChild={children}
          />
        ))}
      </div>

      {/* 比較フローティングバー（選択モード時のみ表示） */}
      <CompareFloatingBar locale={locale} theme={theme} isSelectionMode={isSelectionMode} />
    </>
  );
}

export default ProductListWithSelection;
