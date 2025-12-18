/**
 * シリーズ関連クエリ
 *
 * 含まれる関数:
 * - getSeriesByTagId
 * - getSeriesInfo
 * - getSeriesProducts
 * - getPopularSeries
 *
 * 注意: 現在はqueries.tsからre-exportしています。
 * 将来的にqueries.tsから完全に分離する予定です。
 */

// 現在は queries.ts から re-export
export {
  getSeriesByTagId,
  getSeriesInfo,
  getSeriesProducts,
  getPopularSeries,
} from '../queries';
