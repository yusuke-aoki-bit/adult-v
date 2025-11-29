/**
 * 演者名のバリデーションと正規化ユーティリティ
 *
 * 全クローラーで共通して使用する演者名の検証・正規化ロジック
 */

/**
 * 無効な演者名のパターン
 */
const INVALID_PATTERNS: RegExp[] = [
  // 数字のみ
  /^[0-9]+$/,
  // 短い英数字のみ（5文字未満）
  /^[a-zA-Z0-9_-]{1,4}$/,
  // 素人系の一般名称
  /^素人[0-9]*$/,
  // 企画もの
  /^企画$/,
  // 「他」単体
  /^他$/,
  // 矢印で始まる（変換ミス）
  /^→/,
  // 矢印を含む（変換ミス）
  /→/,
  // ひらがな1文字
  /^[ぁ-ん]$/,
  // カタカナ1文字
  /^[ァ-ヶー]$/,
  // 漢字1文字（苗字だけなど）
  /^[一-龯]$/,
  // ハイフンのみ
  /^-+$/,
  // 空白のみ
  /^\s*$/,
  // 「---」などのプレースホルダー
  /^-{2,}$/,
  // 「...」などのプレースホルダー
  /^\.{2,}$/,
  // 「***」などのプレースホルダー
  /^\*{2,}$/,
  // HTMLタグが残っている
  /<[^>]+>/,
  // URLが含まれている
  /https?:\/\//,
  // メールアドレスパターン
  /@[a-zA-Z0-9.-]+\.[a-zA-Z]/,
  // 「名無し」「匿名」など
  /^(名無し|匿名|不明|未定|なし|ナシ|無し)$/,
  // 数字とハイフンのみ（品番パターン）
  /^[A-Z0-9]+-[0-9]+$/i,
  // 記号のみ
  /^[!@#$%^&*()_+=\[\]{}|\\:";'<>?,./～・。、「」『』【】]+$/,
];

/**
 * 無効な演者名の完全一致リスト
 */
const INVALID_NAMES: string[] = [
  '他',
  'デ',
  'ラ',
  'ゆ',
  'な',
  '素人',
  '---',
  '-',
  '.',
  '..',
  '...',
  '*',
  '**',
  '***',
  'etc',
  'etc.',
  'その他',
  'unknown',
  'Unknown',
  'UNKNOWN',
  'N/A',
  'n/a',
  'TBA',
  'TBD',
  '出演者',
  '出演',
  '女優',
  '男優',
  'AV女優',
  '名前',
  'name',
  'Name',
  '（出演者）',
  '複数出演',
  '多数出演',
  '他多数',
  '他複数',
  'ほか',
  'ほか多数',
  'など',
];

/**
 * 演者名として有効かどうかをチェック
 * @param name 演者名
 * @returns 有効な場合true
 */
export function isValidPerformerName(name: string | null | undefined): boolean {
  if (!name) return false;

  const trimmed = name.trim();

  // 空文字チェック
  if (trimmed.length === 0) return false;

  // 最小長チェック（2文字以上必要）
  if (trimmed.length < 2) return false;

  // 無効な名前の完全一致チェック
  if (INVALID_NAMES.includes(trimmed)) return false;

  // 無効なパターンチェック
  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  return true;
}

/**
 * 演者名を正規化（クリーンアップ）
 * @param name 演者名
 * @returns 正規化された演者名（無効な場合null）
 */
export function normalizePerformerName(name: string | null | undefined): string | null {
  if (!name) return null;

  let normalized = name.trim();

  // 全角スペースを半角に
  normalized = normalized.replace(/　/g, ' ');

  // 連続する空白を1つに
  normalized = normalized.replace(/\s+/g, ' ');

  // 前後の記号を削除
  normalized = normalized.replace(/^[・●○◎◇◆□■△▲▽▼※☆★♪♫【】「」『』（）()［］\[\]]+/, '');
  normalized = normalized.replace(/[・●○◎◇◆□■△▲▽▼※☆★♪♫【】「」『』（）()［］\[\]]+$/, '');

  // 括弧内の読み仮名を削除（例: "山田花子（やまだはなこ）" → "山田花子"）
  normalized = normalized.replace(/[（(][ぁ-んァ-ヶー]+[）)]/g, '');

  // 「AKA」や「別名」などを削除
  normalized = normalized.replace(/\s*(aka|a\.k\.a\.?|別名|旧名|現|旧)\s*[:：]?\s*/gi, ' ');

  // 再度トリム
  normalized = normalized.trim();

  // バリデーション
  if (!isValidPerformerName(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * 演者名のリストをパースして有効な名前のみ返す
 * @param rawPerformers 生の演者名文字列（カンマ区切りなど）
 * @param delimiters 区切り文字のパターン（デフォルト: カンマ、読点、スラッシュ）
 * @returns 有効な演者名の配列
 */
export function parsePerformerNames(
  rawPerformers: string | null | undefined,
  delimiters: RegExp = /[、,\/・\n\t]+/
): string[] {
  if (!rawPerformers) return [];

  const names = rawPerformers.split(delimiters);
  const validNames: string[] = [];

  for (const name of names) {
    const normalized = normalizePerformerName(name);
    if (normalized && !validNames.includes(normalized)) {
      validNames.push(normalized);
    }
  }

  return validNames;
}

/**
 * 演者名が有効で、かつ商品タイトルと異なることを確認
 * @param performerName 演者名
 * @param productTitle 商品タイトル
 * @returns 有効な場合true
 */
export function isValidPerformerForProduct(
  performerName: string | null | undefined,
  productTitle: string | null | undefined
): boolean {
  if (!isValidPerformerName(performerName)) return false;

  // タイトルと完全一致する場合は無効（タイトルを誤って演者名として取得している可能性）
  if (productTitle && performerName?.trim().toLowerCase() === productTitle.trim().toLowerCase()) {
    return false;
  }

  return true;
}
