/**
 * クローラー共通ユーティリティ
 * リダイレクト検知、トップページ情報フィルタリングなど
 */
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>;

// トップページ/リダイレクトページの特徴的なパターン
const TOP_PAGE_PATTERNS = {
  titles: [
    /^ソクミル-\d+$/, // ソクミルプレースホルダー
    /^Japanska-\d+$/, // Japanskaプレースホルダー
    /^FC2動画アダルト$/, // FC2トップページ
    /^MGS動画\(成人認証\)/, // MGS認証ページ
    /^アダルト動画.*ソクミル/, // ソクミルトップ
    /^無修正動画.*カリビアンコム/, // カリビアンコムトップ
    // MGS トップページパターン
    /^エロ動画・アダルトビデオ\s*-MGS動画/, // MGSトップページタイトル
    /^MGS動画＜プレステージ\s*グループ＞$/, // MGSトップページ（リダイレクト後）
  ],
  descriptions: [
    /アダルト動画・エロ動画ソクミル/,
    /人気のアダルトビデオを高画質・低価格/,
    /全作品無料のサンプル動画付き/,
    /18歳未満.*閲覧.*禁止/,
    /年齢確認.*18歳以上/,
    // MGS トップページ説明文
    /プレステージグループのMGS動画は、10年以上の運営実績/,
    /独占作品をはじめ、人気AV女優、素人、アニメ、VR作品など/,
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
  finalUrl: string,
): { isRedirected: boolean; redirectType?: string } {
  const originalHost = new URL(originalUrl).hostname;
  const finalHost = new URL(finalUrl).hostname;

  // ホストが変わった場合
  if (originalHost !== finalHost) {
    return { isRedirected: true, redirectType: 'host_changed' };
  }

  // 詳細ページから一覧/トップページへリダイレクト
  const topPagePatterns = [
    /^\/?$/, // トップページ
    /\/\?.*$/, // クエリパラメータのみ
    /\/list\.html$/, // 一覧ページ
    /\/search/, // 検索ページ
    /\/age[-_]?check/i, // 年齢確認ページ
    /\/confirm/i, // 確認ページ
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
// Puppeteer Page型のインターフェース（実際の依存を避けるため最小限定義）
interface PuppeteerPage {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  url(): string;
}

export async function navigateWithRedirectCheck(
  page: PuppeteerPage,
  url: string,
  options: { waitUntil?: string; timeout?: number } = {},
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
      ...(redirectInfo.redirectType !== undefined && { redirectType: redirectInfo.redirectType }),
    };
  } catch {
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
  const ageCheckPatterns = [/年齢確認/, /18歳以上/, /age[-_]?verification/i, /confirm.*age/i, /はい.*いいえ.*ボタン/];

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
    ソクミル: [/ソクミル.*トップ/, /人気ランキング.*新着動画/],
    MGS: [/MGS動画\(成人認証\)/, /年齢確認.*18歳以上/],
    FC2: [/FC2動画.*トップ/, /FC2コンテンツマーケット/],
    Japanska: [
      /Japanska.*トップ/,
      /無修正動画一覧/,
      /幅広いジャンル.*30日/, // Japanskaホームページ
    ],
    // b10f
    b10f: [/b10f.*トップ/i, /b10f\.jp.*ホーム/i],
    // DTI系サイト
    一本道: [/一本道.*トップ/, /1pondo\.tv.*ホーム/i],
    カリビアンコム: [/カリビアンコム.*トップ/, /caribbeancom\.com.*ホーム/i],
    カリビアンコムプレミアム: [/カリビアンコムプレミアム.*トップ/, /caribbeancompr\.com.*ホーム/i],
    HEYZO: [/HEYZO.*トップ/i, /heyzo\.com.*ホーム/i],
    天然むすめ: [/天然むすめ.*トップ/, /10musume\.com.*ホーム/i],
    DTI: [/DTI.*トップ/i, /アフィリエイトサービス/],
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
export function sanitizeProductData(data: { title?: string; description?: string }): {
  title: string;
  description: string;
} {
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

/**
 * Google Search APIを使って女優名を取得（フォールバック用）
 * クローラーで女優名が取得できなかった場合に使用
 *
 * @param productCode 商品コード (例: "SIRO-5000")
 * @param existingPerformers 既に取得済みの女優名（重複防止用）
 * @returns 新しく見つかった女優名の配列
 */
export async function fetchPerformersFromGoogleSearch(
  productCode: string,
  existingPerformers: string[] = [],
): Promise<string[]> {
  try {
    // 動的インポートでGoogle APIを読み込み
    const { searchPerformerByProductCode } = await import('./google-apis');
    const { isValidPerformerName, normalizePerformerName } = await import('./performer-validation');

    const performers = await searchPerformerByProductCode(productCode);

    // バリデーションと重複チェック
    const validPerformers: string[] = [];
    const existingSet = new Set(existingPerformers.map((n) => n.toLowerCase()));

    for (const name of performers) {
      const normalized = normalizePerformerName(name);
      if (
        normalized &&
        isValidPerformerName(normalized) &&
        !existingSet.has(normalized.toLowerCase()) &&
        !validPerformers.includes(normalized)
      ) {
        validPerformers.push(normalized);
      }
    }

    return validPerformers;
  } catch (error) {
    console.warn(`[Google Search] 女優名取得失敗 (${productCode}):`, error);
    return [];
  }
}

/**
 * 演者をバッチでUPSERTし、product_performersリレーションを作成
 * N+1クエリを防ぐためのバッチ処理関数
 *
 * 演者名の検索順序:
 * 1. performers['name'] で完全一致を検索
 * 2. performer_aliases.alias_name で別名を検索
 * 3. 見つからなければ新規作成
 *
 * @param db - Drizzle DBインスタンス
 * @param productId - 商品ID
 * @param performerNames - 演者名の配列
 * @returns 挿入/更新された演者数
 */
export async function savePerformersBatch(db: AnyDb, productId: number, performerNames: string[]): Promise<number> {
  if (performerNames.length === 0) {
    return 0;
  }

  const performerMap = new Map<string, number>();

  // 1. まず performers['name'] で既存の演者を検索
  const existingPerformers = await db.execute(sql`
    SELECT id, name FROM performers
    WHERE name = ANY(ARRAY[${sql.join(
      performerNames.map((n) => sql`${n}`),
      sql`, `,
    )}]::text[])
  `);
  for (const row of existingPerformers.rows as { id: number; name: string }[]) {
    performerMap.set(row['name'], row['id']);
  }

  // 2. 見つからなかった名前について performer_aliases で別名検索
  const notFoundNames = performerNames.filter((name) => !performerMap.has(name));
  if (notFoundNames.length > 0) {
    const aliasResults = await db.execute(sql`
      SELECT pa.alias_name, pa.performer_id, p.name as performer_name
      FROM performer_aliases pa
      JOIN performers p ON pa.performer_id = p.id
      WHERE pa.alias_name = ANY(ARRAY[${sql.join(
        notFoundNames.map((n) => sql`${n}`),
        sql`, `,
      )}]::text[])
    `);
    for (const row of aliasResults.rows as { alias_name: string; performer_id: number; performer_name: string }[]) {
      // 別名で見つかった場合、その演者IDを使用
      performerMap.set(row.alias_name, row.performer_id);
      console.log(`  📝 別名マッチ: "${row.alias_name}" → "${row.performer_name}" (ID: ${row.performer_id})`);
    }
  }

  // 3. まだ見つからない名前は新規作成
  const stillNotFound = performerNames.filter((name) => !performerMap.has(name));
  if (stillNotFound.length > 0) {
    const upsertResult = await db.execute(sql`
      INSERT INTO performers (name)
      SELECT unnest(ARRAY[${sql.join(
        stillNotFound.map((n) => sql`${n}`),
        sql`, `,
      )}]::text[])
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `);
    for (const row of upsertResult.rows as { id: number; name: string }[]) {
      performerMap.set(row['name'], row['id']);
    }
  }

  // 4. product_performers リレーションを一括作成
  const performerIds = performerNames
    .map((name) => performerMap.get(name))
    .filter((id): id is number => id !== undefined);

  if (performerIds.length > 0) {
    await db.execute(sql`
      INSERT INTO product_performers (product_id, performer_id)
      SELECT ${productId}, unnest(ARRAY[${sql.join(
        performerIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::integer[])
      ON CONFLICT DO NOTHING
    `);
  }

  return performerIds.length;
}

/**
 * wiki_crawl_data優先で演者を保存
 *
 * 全ASPクローラーで使用する統合関数。
 * 1. wiki_crawl_dataから品番で正しい演者名を検索
 * 2. 見つかった場合はそれを使用（クローラーから取得した演者名は無視）
 * 3. 見つからない場合はクローラーから取得した演者名を使用
 *
 * @param db - Drizzle DBインスタンス
 * @param productId - 商品ID
 * @param productCode - 商品コード（品番）例: mfcs00191, MFCS-191, 300MIUM-1000
 * @param crawledPerformers - クローラーから取得した演者名（フォールバック用）
 * @param aspPrefix - ASPプレフィックス（省略可能）
 * @returns 保存された演者数
 */
export async function savePerformersWithWikiPriority(
  db: AnyDb,
  productId: number,
  productCode: string,
  crawledPerformers: string[],
  aspPrefix?: string,
): Promise<number> {
  // 1. wiki_crawl_dataから演者名を検索
  const wikiPerformers = await getPerformersFromWikiCrawlData(db, productCode, aspPrefix);

  // 2. wiki_crawl_dataで見つかった場合はそれを使用
  let performerNames: string[];
  if (wikiPerformers.length > 0) {
    performerNames = wikiPerformers;
    if (crawledPerformers.length > 0) {
      console.log(`    ℹ️ クローラー取得演者をスキップ: ${crawledPerformers.join(', ')}`);
    }
  } else {
    // 見つからない場合はクローラーから取得した演者名を使用
    performerNames = crawledPerformers;
  }

  if (performerNames.length === 0) {
    return 0;
  }

  // 3. 演者を保存
  return savePerformersBatch(db, productId, performerNames);
}

/**
 * タグをバッチでUPSERTし、product_tagsリレーションを作成
 * N+1クエリを防ぐためのバッチ処理関数
 *
 * @param db - Drizzle DBインスタンス
 * @param productId - 商品ID
 * @param tagNames - タグ名の配列
 * @returns 挿入/更新されたタグ数
 */
export async function saveTagsBatch(db: AnyDb, productId: number, tagNames: string[]): Promise<number> {
  if (tagNames.length === 0) {
    return 0;
  }

  // 1. 全タグを一括でUPSERT
  const upsertResult = await db.execute(sql`
    INSERT INTO tags (name)
    SELECT unnest(ARRAY[${sql.join(
      tagNames.map((n) => sql`${n}`),
      sql`, `,
    )}]::text[])
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, name
  `);

  const tagMap = new Map<string, number>();
  for (const row of upsertResult.rows as { id: number; name: string }[]) {
    tagMap.set(row['name'], row['id']);
  }

  // 2. product_tags リレーションを一括作成
  const tagIds = tagNames.map((name) => tagMap.get(name)).filter((id): id is number => id !== undefined);

  if (tagIds.length > 0) {
    await db.execute(sql`
      INSERT INTO product_tags (product_id, tag_id)
      SELECT ${productId}, unnest(ARRAY[${sql.join(
        tagIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::integer[])
      ON CONFLICT DO NOTHING
    `);
  }

  return tagIds.length;
}

/**
 * 品番ID（normalized_product_id）から複数の検索用品番形式を抽出
 *
 * 例:
 *   FANZA-gvh00802 → ['FANZA-GVH00802', 'GVH00802', 'GVH-802']
 *   FANZA-mfcs00191 → ['FANZA-MFCS00191', 'MFCS00191', 'MFCS-191']
 *   425bdsx-01902 → ['425BDSX-01902', 'BDSX-01902', 'BDSX01902']
 */
export function extractProductCodes(normalizedId: string): string[] {
  const codes: string[] = [];
  const upper = normalizedId.toUpperCase();

  // そのままの形式を追加
  codes.push(upper);

  // FANZA-xxx形式からプレフィックスを除去
  if (upper.startsWith('FANZA-')) {
    const withoutFanza = upper.replace('FANZA-', '');
    codes.push(withoutFanza);

    // gvh00802 → GVH-802 形式に変換（先頭0を除去）
    const match = withoutFanza.match(/^([A-Z]+)(\d+)$/);
    if (match && match[1] && match[2]) {
      const letters = match[1];
      const numbers = match[2].replace(/^0+/, ''); // 先頭の0を除去
      codes.push(`${letters}-${numbers}`);
      codes.push(`${letters}${numbers}`); // ハイフンなし版も追加
    }
  }

  // MGS形式: 425bdsx-01902 → BDSX-01902
  const mgsMatch = upper.match(/^\d+([A-Z]+)-?(\d+)$/);
  if (mgsMatch && mgsMatch[1] && mgsMatch[2]) {
    const letters = mgsMatch[1];
    const numbers = mgsMatch[2].replace(/^0+/, '');
    codes.push(`${letters}-${numbers}`);
    codes.push(`${letters}${mgsMatch[2]}`); // ハイフンなし版も追加
  }

  // 数字プレフィックス + 品番形式: 425BDSX-01902 → BDSX-01902
  const numPrefixMatch = upper.match(/^(\d{2,3})([A-Z]+)-?(\d+)$/);
  if (numPrefixMatch && numPrefixMatch[2] && numPrefixMatch[3]) {
    const letters = numPrefixMatch[2];
    const numbers = numPrefixMatch[3];
    codes.push(`${letters}-${numbers}`);
    codes.push(`${letters}-${numbers.replace(/^0+/, '')}`);
  }

  return [...new Set(codes)];
}

/**
 * wiki_crawl_dataテーブルから品番で演者名を検索
 *
 * 全ASPのクローラーで演者名を取得する前に、
 * まずwiki_crawl_dataから正しい演者名を検索するために使用
 *
 * @param db - Drizzle DBインスタンス
 * @param productCode - 商品コード（例: mfcs00191, MFCS-191, 300MIUM-1000）
 * @param aspPrefix - ASPプレフィックス（例: 'FANZA', 'MGS'）省略可能
 * @returns 見つかった演者名の配列（見つからない場合は空配列）
 */
export async function getPerformersFromWikiCrawlData(
  db: AnyDb,
  productCode: string,
  aspPrefix?: string,
): Promise<string[]> {
  // 品番から複数の検索用品番形式を生成
  const normalizedId = aspPrefix ? `${aspPrefix}-${productCode}` : productCode;
  const productCodes = extractProductCodes(normalizedId);

  // 品番そのものも追加（大文字小文字両方）
  productCodes.push(productCode.toUpperCase());
  productCodes.push(productCode);

  // 重複除去
  const uniqueCodes = [...new Set(productCodes)];

  // wiki_crawl_dataで検索
  const result = await db.execute(sql`
    SELECT DISTINCT performer_name
    FROM wiki_crawl_data
    WHERE UPPER(product_code) = ANY(ARRAY[${sql.join(
      uniqueCodes.map((c) => sql`${c.toUpperCase()}`),
      sql`, `,
    )}]::text[])
  `);

  const performers = (result.rows as { performer_name: string }[])
    .map((row) => row.performer_name)
    .filter((name) => name && name.length > 0);

  if (performers.length > 0) {
    console.log(`    📚 wiki_crawl_dataから演者取得: ${performers.join(', ')}`);
  }

  return performers;
}
