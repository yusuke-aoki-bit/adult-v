'use client';

import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { FixedSizeGrid as Grid, GridChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface Product {
  id: string | number;
  title: string;
  imageUrl?: string | null;
  normalizedProductId?: string | null;
  price?: number;
  salePrice?: number;
  discount?: number;
  releaseDate?: string | null;
  duration?: number;
  rating?: number;
  reviewCount?: number;
  provider?: string;
  providerLabel?: string;
  sampleImages?: string[];
  sampleVideos?: Array<{ url: string; type: string }>;
  tags?: string[];
  performers?: Array<{ id: string; name: string }>;
  saleEndAt?: string | null;
}

interface VirtualProductGridBaseProps {
  products: Product[];
  renderProduct: (product: Product, index: number, style: React.CSSProperties) => React.ReactNode;
  columnCount?: number;
  rowHeight?: number;
  gap?: number;
  overscanRowCount?: number;
  className?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  loadingComponent?: React.ReactNode;
}

interface CellProps extends GridChildComponentProps {
  data: {
    products: Product[];
    columnCount: number;
    gap: number;
    renderProduct: (product: Product, index: number, style: React.CSSProperties) => React.ReactNode;
  };
}

const Cell = memo(({ columnIndex, rowIndex, style, data }: CellProps) => {
  const { products, columnCount, gap, renderProduct } = data;
  const index = rowIndex * columnCount + columnIndex;

  if (index >= products.length) {
    return null;
  }

  const product = products[index];

  // Gap調整したスタイル
  const adjustedStyle: React.CSSProperties = {
    ...style,
    left: Number(style.left) + gap / 2,
    top: Number(style.top) + gap / 2,
    width: Number(style.width) - gap,
    height: Number(style.height) - gap,
  };

  return renderProduct(product, index, adjustedStyle);
});

Cell.displayName = 'VirtualGridCell';

function VirtualProductGridBase({
  products,
  renderProduct,
  columnCount: defaultColumnCount = 6,
  rowHeight = 380,
  gap = 16,
  overscanRowCount = 2,
  className = '',
  onLoadMore,
  hasMore = false,
  isLoading = false,
  loadingComponent,
}: VirtualProductGridBaseProps) {
  const gridRef = useRef<Grid>(null);
  const [actualColumnCount, setActualColumnCount] = useState(defaultColumnCount);

  // レスポンシブ対応：画面幅に応じてカラム数を調整
  const getColumnCount = useCallback((width: number) => {
    if (width < 640) return 2;      // sm
    if (width < 768) return 3;      // md
    if (width < 1024) return 4;     // lg
    if (width < 1280) return 5;     // xl
    return 6;                        // 2xl
  }, []);

  // 無限スクロール：最後に近づいたらロード
  const handleScroll = useCallback(
    ({ scrollTop, scrollHeight, clientHeight }: { scrollTop: number; scrollHeight: number; clientHeight: number }) => {
      if (!onLoadMore || !hasMore || isLoading) return;

      const threshold = 200; // 下から200pxで次をロード
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        onLoadMore();
      }
    },
    [onLoadMore, hasMore, isLoading]
  );

  const rowCount = Math.ceil(products.length / actualColumnCount);

  if (products.length === 0) {
    return null;
  }

  return (
    <div className={`w-full ${className}`} style={{ height: '80vh', minHeight: 600 }}>
      <AutoSizer>
        {({ height, width }) => {
          const columns = getColumnCount(width);
          if (columns !== actualColumnCount) {
            setActualColumnCount(columns);
          }

          const columnWidth = (width - gap) / columns;
          const rows = Math.ceil(products.length / columns);

          return (
            <>
              <Grid
                ref={gridRef}
                columnCount={columns}
                columnWidth={columnWidth}
                height={height}
                rowCount={rows}
                rowHeight={rowHeight}
                width={width}
                overscanRowCount={overscanRowCount}
                onScroll={({ scrollTop }) => {
                  const scrollHeight = rows * rowHeight;
                  handleScroll({ scrollTop, scrollHeight, clientHeight: height });
                }}
                itemData={{
                  products,
                  columnCount: columns,
                  gap,
                  renderProduct,
                }}
              >
                {Cell}
              </Grid>
              {isLoading && loadingComponent && (
                <div className="absolute bottom-0 left-0 right-0 flex justify-center py-4">
                  {loadingComponent}
                </div>
              )}
            </>
          );
        }}
      </AutoSizer>
    </div>
  );
}

export default memo(VirtualProductGridBase);
