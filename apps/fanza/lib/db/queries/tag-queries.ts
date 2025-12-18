/**
 * タグ/カテゴリ関連クエリ
 *
 * 含まれる関数:
 * - getTags
 * - getTagById
 * - getTagsForActress
 * - getPopularTags
 * - getCategories
 * - getUncategorizedStats
 *
 * 注意: 現在はqueries.tsからre-exportしています。
 * 将来的にqueries.tsから完全に分離する予定です。
 */

// 現在は queries.ts から re-export
export {
  getTags,
  getTagById,
  getTagsForActress,
  getPopularTags,
  getCategories,
  getUncategorizedStats,
} from '../queries';
