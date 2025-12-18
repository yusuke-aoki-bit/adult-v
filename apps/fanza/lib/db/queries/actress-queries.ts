/**
 * 女優関連クエリ
 *
 * 含まれる関数:
 * - getActresses
 * - getActressesCount
 * - getActressById
 * - getPerformerAliases
 * - getActressProductCountBySite
 * - getActressProductCountByAsp
 * - getFeaturedActresses
 * - getActressesWithNewReleases
 * - getMultiAspActresses
 * - getActressesByAsp
 * - getActressAvgPricePerMin
 * - getActressCareerAnalysis
 * - getCandidatePerformers
 *
 * 注意: 現在はqueries.tsからre-exportしています。
 * 将来的にqueries.tsから完全に分離する予定です。
 */

// 現在は queries.ts から re-export
export {
  getActresses,
  getActressesCount,
  getActressById,
  getPerformerAliases,
  getActressProductCountBySite,
  getActressProductCountByAsp,
  getFeaturedActresses,
  getActressesWithNewReleases,
  getMultiAspActresses,
  getActressesByAsp,
  getActressAvgPricePerMin,
  getActressCareerAnalysis,
  getCandidatePerformers,
} from '../queries';
