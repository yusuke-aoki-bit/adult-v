/**
 * クエリ関数のインデックスファイル
 *
 * ファイル分割構造:
 * - utils.ts: ヘルパー関数、型定義、キャッシュ関数、マッピング関数
 * - ../queries.ts: 全てのクエリ関数（段階的に分割予定）
 *
 * 将来的な分割計画:
 * - product-queries.ts: 商品関連クエリ
 * - actress-queries.ts: 女優関連クエリ
 * - tag-queries.ts: タグ/カテゴリ関連クエリ
 * - analytics-queries.ts: 統計関連クエリ
 * - series-queries.ts: シリーズ関連クエリ
 * - maker-queries.ts: メーカー関連クエリ
 */

// ユーティリティ関数・型・マッピング関数をエクスポート
export * from './utils';

// 全てのクエリ関数を queries.ts から re-export（後方互換性維持）
export * from '../queries';
