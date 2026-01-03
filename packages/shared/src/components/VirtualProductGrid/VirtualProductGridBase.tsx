'use client';

import { memo, useCallback, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { Grid, type GridImperativeAPI } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

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
  renderProduct: (product: Product, index: number, style: CSSProperties) => React.ReactNode;
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

// react-window v2のcellPropsとして渡すカスタムデータ
interface CellCustomProps {
  products: Product[];
  columnCount: number;
  gap: number;
  renderProduct: (product: Product, index: number, style: CSSProperties) => React.ReactNode;
}

// react-window v2のcellComponentが受け取るprops
interface CellComponentProps extends CellCustomProps {
  ariaAttributes: {
    'aria-colindex': number;
    role: 'gridcell';
  };
  columnIndex: number;
  rowIndex: number;
  style: CSSProperties;
}

const CellComponent = ({
  columnIndex,
  rowIndex,
  style,
  products,
  columnCount,
  gap,
  renderProduct,
}: CellComponentProps): ReactElement => {
  const index = rowIndex * columnCount + columnIndex;

  if (index >= products.length) {
    return <div style={style} />;
  }

  const product = products[index];

  // Gap調整したスタイル
  const adjustedStyle: CSSProperties = {
    ...style,
    left: Number(style.left) + gap / 2,
    top: Number(style.top) + gap / 2,
    width: Number(style.width) - gap,
    height: Number(style.height) - gap,
  };

  return <>{renderProduct(product, index, adjustedStyle)}</>;
};

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
  const gridRef = useRef<GridImperativeAPI>(null);
  const [actualColumnCount, setActualColumnCount] = useState(defaultColumnCount);

  // レスポンシブ対応：画面幅に応じてカラム数を調整
  const getColumnCount = useCallback((width: number) => {
    if (width < 640) return 2;      // sm
    if (width < 768) return 3;      // md
    if (width < 1024) return 4;     // lg
    if (width < 1280) return 5;     // xl
    return 6;                        // 2xl
  }, []);

  // 無限スクロール：最後に近づいたらロード - 現在のAPIではonScrollがサポートされていないため未使用
  const _handleScroll = useCallback(
    ({ scrollTop, scrollHeight, clientHeight }: { scrollTop: number; scrollHeight: number; clientHeight: number }) => {
      if (!onLoadMore || !hasMore || isLoading) return;

      const threshold = 200; // 下から200pxで次をロード
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        onLoadMore();
      }
    },
    [onLoadMore, hasMore, isLoading]
  );

  if (products.length === 0) {
    return null;
  }

  return (
    <div className={`w-full ${className}`} style={{ height: '80vh', minHeight: 600 }}>
      <AutoSizer
        renderProp={({ height, width }) => {
          if (!height || !width) return null;

          const columns = getColumnCount(width);
          if (columns !== actualColumnCount) {
            setActualColumnCount(columns);
          }

          const columnWidth = (width - gap) / columns;
          const rows = Math.ceil(products.length / columns);

          const cellProps: CellCustomProps = {
            products,
            columnCount: columns,
            gap,
            renderProduct,
          };

          return (
            <>
              <Grid<CellCustomProps>
                gridRef={gridRef}
                columnCount={columns}
                columnWidth={columnWidth}
                rowCount={rows}
                rowHeight={rowHeight}
                overscanCount={overscanRowCount}
                cellProps={cellProps}
                cellComponent={CellComponent}
                style={{ height, width }}
              />
              {isLoading && loadingComponent && (
                <div className="absolute bottom-0 left-0 right-0 flex justify-center py-4">
                  {loadingComponent}
                </div>
              )}
            </>
          );
        }}
      />
    </div>
  );
}

export default memo(VirtualProductGridBase);
