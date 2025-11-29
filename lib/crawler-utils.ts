/**
 * クローラー共通ユーティリティ
 * リダイレクト検知、トップページ情報フィルタリングなど
 */

// トップページ/リダイレクトページの特徴的なパターン
const TOP_PAGE_PATTERNS = {
  titles: [
    /^ソクミル-\d+$/,                    // ソクミルプレースホルダー
    /^Japanska-\d+$/,                   // Japanskaプレースホルダー
    /^FC2動画アダルト$/,                 // FC2トップページ
    /^MGS動画\(成人認証\)/,              // MGS認証ページ
    /^アダルト動画.*ソクミル/,            // ソクミルトップ
    /^無修正動画.*カリビアンコム/,        // カリビアンコムトップ
  ],
  descriptions: [
    /アダルト動画・エロ動画ソクミル/,
    /人気のアダルトビデオを高画質・低価格/,
    /全作品無料のサンプル動画付き/,
    /18歳未満.*閲覧.*禁止/,
    /年齢確認.*18歳以上/,
  ],
};

export interface ProductValidation {
  isValid: boolean;
  reason?: string;
}

/**
 * 商品データがトップページ/リダイレクトページの情報かどうかを検証
 */
export function validateProductData(data: {
  title?: string;
  description?: string;
  aspName: string;
  originalId: string;
}): ProductValidation {
  const { title, description, aspName, originalId } = data;

  // タイトルが空またはASP名+IDのプレースホルダー形式
  if (!title || title.trim() === '') {
    return { isValid: false, reason: 'タイトルが空' };
  }

  // プレースホルダータイトルのチェック
  const placeholderPattern = new RegExp(`^${aspName}-${originalId}$`, 'i');
  if (placeholderPattern.test(title)) {
    return { isValid: false, reason: 'プレースホルダータイトル' };
  }

  // トップページタイトルパターンのチェック
  for (const pattern of TOP_PAGE_PATTERNS.titles) {
    if (pattern.test(title)) {
      return { isValid: false, reason: `トップページタイトル: ${title}` };
    }
  }

  // 説明文がトップページの汎用説明文かチェック
  if (description) {
    for (const pattern of TOP_PAGE_PATTERNS.descriptions) {
      if (pattern.test(description)) {
        return { isValid: false, reason: 'トップページ説明文を検出' };
      }
    }
  }

  // タイトルが極端に短い（5文字未満）
  if (title.length < 5) {
    return { isValid: false, reason: `タイトルが短すぎる: ${title}` };
  }

  return { isValid: true };
}

/**
 * URLがリダイレクトされたかどうかを検出
 */
export function detectRedirect(
  originalUrl: string,
  finalUrl: string
): { isRedirected: boolean; redirectType?: string } {
  const originalHost = new URL(originalUrl).hostname;
  const finalHost = new URL(finalUrl).hostname;

  // ホストが変わった場合
  if (originalHost !== finalHost) {
    return { isRedirected: true, redirectType: 'host_changed' };
  }

  // 詳細ページから一覧/トップページへリダイレクト
  const topPagePatterns = [
    /^\/?$/,                    // トップページ
    /\/\?.*$/,                  // クエリパラメータのみ
    /\/list\.html$/,            // 一覧ページ
    /\/search/,                 // 検索ページ
    /\/age[-_]?check/i,         // 年齢確認ページ
    /\/confirm/i,               // 確認ページ
  ];

  const finalPath = new URL(finalUrl).pathname;
  for (const pattern of topPagePatterns) {
    if (pattern.test(finalPath)) {
      return { isRedirected: true, redirectType: 'to_top_page' };
    }
  }

  return { isRedirected: false };
}

/**
 * Puppeteerでページ遷移時のリダイレクト検出
 */
export async function navigateWithRedirectCheck(
  page: any,
  url: string,
  options: { waitUntil?: string; timeout?: number } = {}
): Promise<{ success: boolean; finalUrl: string; wasRedirected: boolean; redirectType?: string }> {
  const { waitUntil = 'networkidle2', timeout = 30000 } = options;

  try {
    await page.goto(url, { waitUntil, timeout });
    const finalUrl = page.url();

    const redirectInfo = detectRedirect(url, finalUrl);

    return {
      success: true,
      finalUrl,
      wasRedirected: redirectInfo.isRedirected,
      redirectType: redirectInfo.redirectType,
    };
  } catch (error) {
    return {
      success: false,
      finalUrl: url,
      wasRedirected: false,
    };
  }
}

/**
 * HTMLコンテンツからトップページかどうかを検出
 */
export function isTopPageHtml(html: string, aspName: string): boolean {
  // 年齢確認ダイアログ/ページの検出
  const ageCheckPatterns = [
    /年齢確認/,
    /18歳以上/,
    /age[-_]?verification/i,
    /confirm.*age/i,
    /はい.*いいえ.*ボタン/,
  ];

  for (const pattern of ageCheckPatterns) {
    if (pattern.test(html)) {
      // ただし、商品詳細ページにも年齢確認のテキストがある場合があるので
      // 他の商品情報（価格、出演者など）がない場合のみ判定
      const hasProductInfo = /¥[\d,]+/.test(html) || /円/.test(html) || /出演/.test(html);
      if (!hasProductInfo) {
        return true;
      }
    }
  }

  // ASP固有のトップページパターン
  const aspPatterns: Record<string, RegExp[]> = {
    'ソクミル': [
      /ソクミル.*トップ/,
      /人気ランキング.*新着動画/,
    ],
    'MGS': [
      /MGS動画\(成人認証\)/,
      /年齢確認.*18歳以上/,
    ],
    'FC2': [
      /FC2動画.*トップ/,
      /FC2コンテンツマーケット/,
    ],
    'Japanska': [
      /Japanska.*トップ/,
      /無修正動画一覧/,
    ],
  };

  const patterns = aspPatterns[aspName] || [];
  for (const pattern of patterns) {
    if (pattern.test(html)) {
      return true;
    }
  }

  return false;
}

/**
 * 商品データのサニタイズ
 */
export function sanitizeProductData(data: {
  title?: string;
  description?: string;
}): { title: string; description: string } {
  let { title = '', description = '' } = data;

  // HTMLタグを除去
  title = title.replace(/<[^>]*>/g, '').trim();
  description = description.replace(/<[^>]*>/g, '').trim();

  // 不要な空白を正規化
  title = title.replace(/\s+/g, ' ');
  description = description.replace(/\s+/g, ' ');

  // 先頭・末尾の記号を除去
  title = title.replace(/^[【\[\(（『「]|[】\]\)）』」]$/g, '').trim();

  return { title, description };
}
