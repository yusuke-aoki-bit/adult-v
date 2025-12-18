/**
 * 商品関連クエリ
 *
 * 含まれる関数:
 * - getProductById
 * - searchProductByProductId
 * - getProducts
 * - getProductsCount
 * - getProductsByTag
 * - getNewProducts
 * - getRecentProducts
 * - getDiscoverProducts
 * - getSaleProducts
 * - getProductSources
 * - getProductSourcesWithSales
 * - fuzzySearchProducts
 * - getRandomProduct
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
  getProductsByTag,
  getNewProducts,
  getRecentProducts,
  getDiscoverProducts,
  getSaleProducts,
  getProductSources,
  getProductSourcesWithSales,
  fuzzySearchProducts,
  getRandomProduct,
} from '../queries';

export type { SortOption, GetProductsOptions } from '../queries';
