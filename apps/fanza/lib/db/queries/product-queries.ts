/**
 * 商品関連クエリ
 *
 * 含まれる関数:
 * - getProductById
 * - searchProductByProductId
 * - getProducts
 * - getProductsCount
 * - getNewProducts
 * - getRecentProducts
 * - getSaleProducts
 * - getProductSources
 * - getProductSourcesWithSales
 * - fuzzySearchProducts
 *
 * 別ファイルから提供:
 * - getProductsByTag: recommendations.ts
 * - getRandomProduct: discover-queries.ts
 *
 * 注意: 現在はqueries.tsからre-exportしています。
 * 将来的にqueries.tsから完全に分離する予定です。
 */

// 現在は queries.ts から re-export
export {
  getProductById,
  searchProductByProductId,
  getProducts,
  getProductsCount,
  getNewProducts,
  getRecentProducts,
  getSaleProducts,
  getProductSources,
  getProductSourcesWithSales,
  fuzzySearchProducts,
} from '../queries';

// 別ファイルから re-export
export { getProductsByTag } from '../recommendations';
export { getRandomProduct } from '../discover-queries';

export type { SortOption, GetProductsOptions } from '../queries';
