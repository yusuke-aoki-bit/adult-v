/**
 * 商品関連クエリ
 *
 * 含まれる関数:
 * - getProductById
 * - searchProductByProductId
 * - getProducts
 * - getProductsCount
 * - getProductsByActress
 * - getNewProducts
 * - getFeaturedProducts
 * - getProductSources
 * - getProductSourcesWithSales
 * - fuzzySearchProducts
 * - getRecentProducts
 * - getUncategorizedProducts
 * - getUncategorizedProductsCount
 * - getProductsByCategory
 * - getProductCountByCategory
 * - getSaleProducts
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
  getProductsByActress,
  getNewProducts,
  getFeaturedProducts,
  getProductSources,
  getProductSourcesWithSales,
  fuzzySearchProducts,
  getRecentProducts,
  getUncategorizedProducts,
  getUncategorizedProductsCount,
  getProductsByCategory,
  getProductCountByCategory,
  getSaleProducts,
  getRandomProduct,
} from '../queries';

// 型定義もre-export
export type { SortOption, GetProductsOptions } from '../queries';
