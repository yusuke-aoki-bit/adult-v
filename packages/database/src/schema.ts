/**
 * Schema Re-export
 * 後方互換性のため、全てのテーブルと型を再エクスポート
 *
 * 分割されたスキーマファイル:
 * - schema/products.ts   - 商品関連テーブル
 * - schema/performers.ts - 演者関連テーブル
 * - schema/tags.ts       - タグ・中間テーブル
 * - schema/reviews.ts    - レビュー関連テーブル
 * - schema/raw-data.ts   - 生データ関連テーブル
 * - schema/user-content.ts - ユーザー生成コンテンツ
 * - schema/analytics.ts  - 分析・履歴関連テーブル
 */

export * from './schema/index';
