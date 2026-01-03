/**
 * 商品同一性マッチング - 型定義
 */

/**
 * マッチング設定
 */
export interface MatchingConfig {
  // 品番マッチング信頼度
  codeExactMatch: number;       // maker_product_code完全一致
  codeNormalizedMatch: number;  // 正規化品番一致

  // タイトル+演者マッチング信頼度
  titlePerformerHigh: number;   // similarity >= 0.8 + 全演者
  titlePerformerMedium: number; // similarity >= 0.7 + 2名以上
  titlePerformerLow: number;    // similarity >= 0.6 + 1名

  // タイトルのみマッチング信頼度（FC2, DUGA除外）
  titleOnlyStrict: number;      // similarity >= 0.9 + 同一再生時間
  titleOnlyRelaxed: number;     // similarity >= 0.85 + 同一発売日

  // 自動処理閾値
  autoMergeThreshold: number;   // 自動マージ閾値
  reviewThreshold: number;      // 要レビュー閾値
}

/**
 * デフォルトマッチング設定
 */
export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  codeExactMatch: 100,
  codeNormalizedMatch: 95,

  titlePerformerHigh: 90,
  titlePerformerMedium: 80,
  titlePerformerLow: 70,

  titleOnlyStrict: 65,
  titleOnlyRelaxed: 60,

  autoMergeThreshold: 80,
  reviewThreshold: 60,
};

/**
 * タイトルマッチングから除外するASP
 * （同タイトルで異なる動画が多いため）
 */
export const TITLE_MATCH_EXCLUDED_ASPS = new Set([
  'FC2',
  'fc2',
  'DUGA',
  'duga',
]);

/**
 * ASP優先度（代表商品選択用）
 * 小さい値ほど優先度が高い
 */
export const ASP_PRIORITY: Record<string, number> = {
  FANZA: 0,
  MGS: 1,
  SOKMIL: 2,
  B10F: 3,
  DUGA: 4,
  FC2: 5,
  Japanska: 6,
  Caribbean: 7,
  TokyoHot: 8,
  '1pondo': 8,
  Heyzo: 8,
};

/**
 * マッチング手法
 */
export type MatchingMethod =
  | 'product_code_exact'     // maker_product_code完全一致
  | 'product_code_normalized' // 正規化品番一致
  | 'title_performer_high'   // タイトル類似(高) + 全演者
  | 'title_performer_medium' // タイトル類似(中) + 2名以上
  | 'title_performer_low'    // タイトル類似(低) + 1名
  | 'title_only_strict'      // タイトルのみ(厳格)
  | 'title_only_relaxed'     // タイトルのみ(緩和)
  | 'manual';                // 手動設定

/**
 * マッチング結果
 */
export interface MatchResult {
  /** マッチした商品ID */
  productId: number;
  /** マッチしたグループID（既存グループの場合） */
  groupId?: number;
  /** 信頼度スコア (0-100) */
  confidenceScore: number;
  /** マッチング手法 */
  matchingMethod: MatchingMethod;
  /** ASP名 */
  aspName: string;
  /** タイトル類似度（タイトルマッチングの場合） */
  titleSimilarity?: number;
  /** 一致した演者数 */
  matchedPerformerCount?: number;
}

/**
 * 商品情報（マッチング用）
 */
export interface ProductForMatching {
  id: number;
  normalizedProductId: string;
  makerProductCode: string | null;
  title: string;
  normalizedTitle?: string;
  releaseDate: Date | null;
  duration: number | null;
  aspName: string;
  performers: string[];
}

/**
 * 同一性グループ
 */
export interface IdentityGroup {
  id: number;
  masterProductId: number | null;
  canonicalProductCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * グループメンバー
 */
export interface GroupMember {
  id: number;
  groupId: number;
  productId: number;
  confidenceScore: number;
  matchingMethod: MatchingMethod;
  aspName: string | null;
  createdAt: Date;
}

/**
 * バッチ処理オプション
 */
export interface BatchProcessingOptions {
  /** 処理モード */
  mode: 'full' | 'incremental';
  /** バッチサイズ */
  batchSize: number;
  /** 最小信頼度（これ以下は無視） */
  minConfidence: number;
  /** ドライラン（実際に保存しない） */
  dryRun: boolean;
  /** 詳細ログ出力 */
  verbose: boolean;
  /** 処理対象ASP（指定しない場合は全て） */
  targetAsps?: string[];
}

/**
 * バッチ処理統計
 */
export interface BatchProcessingStats {
  /** 処理開始時刻 */
  startedAt: Date;
  /** 処理終了時刻 */
  completedAt?: Date;
  /** 処理した商品数 */
  processedCount: number;
  /** 新規グループ作成数 */
  newGroupsCreated: number;
  /** 既存グループへの追加数 */
  addedToExistingGroups: number;
  /** スキップ数（既にグループ所属） */
  skippedAlreadyGrouped: number;
  /** スキップ数（マッチなし・低信頼度） */
  skippedNoMatch: number;
  /** エラー数 */
  errorCount: number;
  /** マッチング手法別の統計 */
  matchMethodStats: Record<MatchingMethod, number>;
}

/**
 * 初期統計を作成
 */
export function createInitialStats(): BatchProcessingStats {
  return {
    startedAt: new Date(),
    processedCount: 0,
    newGroupsCreated: 0,
    addedToExistingGroups: 0,
    skippedAlreadyGrouped: 0,
    skippedNoMatch: 0,
    errorCount: 0,
    matchMethodStats: {
      product_code_exact: 0,
      product_code_normalized: 0,
      title_performer_high: 0,
      title_performer_medium: 0,
      title_performer_low: 0,
      title_only_strict: 0,
      title_only_relaxed: 0,
      manual: 0,
    },
  };
}
