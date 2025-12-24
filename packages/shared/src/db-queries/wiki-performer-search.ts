/**
 * Wiki出演者インデックスから出演者名を検索
 * 商品タイトル、メーカー名から出演者を検索
 * 依存性注入パターンでDBとスキーマを外部から受け取る
 */

import { sql, ilike, eq, or } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyColumn = any;

// 依存性の型定義
export interface WikiPerformerSearchDeps {
  db: {
    select: () => {
      from: (table: unknown) => {
        where: (condition: unknown) => {
          limit: (n: number) => Promise<WikiPerformerRow[]>;
        };
      };
    };
  };
  wikiPerformerIndex: {
    maker: AnyColumn;
    performerName: AnyColumn;
    performerNameRomaji: AnyColumn;
    performerNameVariants: AnyColumn;
    productTitle: AnyColumn;
    productCode: AnyColumn;
    source: AnyColumn;
    confidence: AnyColumn;
  };
}

interface WikiPerformerRow {
  performerName: string;
  performerNameRomaji: string | null;
  performerNameVariants: string[] | null;
  maker: string | null;
  productTitle: string | null;
  productCode: string | null;
  source: string;
  confidence: number | null;
}

export interface WikiPerformerSearchResult {
  performerName: string;
  performerNameRomaji?: string | null;
  performerNameVariants?: string[] | null;
  maker: string | null;
  productTitle: string | null;
  source: string;
  confidence: number | null;
}

export interface WikiPerformerSearchQueries {
  searchPerformerByMakerAndTitle: (
    maker: string,
    title: string
  ) => Promise<WikiPerformerSearchResult[]>;
  searchPerformerByName: (name: string) => Promise<WikiPerformerSearchResult[]>;
  detectPerformerFromTitle: (
    productTitle: string
  ) => Promise<WikiPerformerSearchResult | null>;
  searchPerformerByProductCode: (
    productCode: string
  ) => Promise<WikiPerformerSearchResult[]>;
}

/**
 * Wiki出演者検索クエリを生成
 */
export function createWikiPerformerSearchQueries(
  deps: WikiPerformerSearchDeps
): WikiPerformerSearchQueries {
  const { db, wikiPerformerIndex } = deps;

  /**
   * メーカーと作品名から出演者を検索
   * @param maker メーカー名（tokyo247, g-area, s-cute等）
   * @param title 作品タイトル（「まゆみ」「MAYUMI」等）
   */
  async function searchPerformerByMakerAndTitle(
    maker: string,
    title: string
  ): Promise<WikiPerformerSearchResult[]> {
    const normalizedMaker = maker.toLowerCase().replace(/[-_\s]/g, '');

    // タイトルから出演者名を抽出する処理
    // 例: "G-AREA まゆみ" → "まゆみ"
    // 例: "Tokyo247 MAYUMI" → "MAYUMI"
    const nameMatch = title.match(
      /(?:G[-]?AREA|Tokyo247|S-Cute)\s+([^\s【】（）\(\)]+)/i
    );
    const extractedName = nameMatch ? nameMatch[1] : title;

    const results = await db
      .select()
      .from(wikiPerformerIndex)
      .where(
        or(
          // メーカー完全一致 + タイトル部分一致
          sql`lower(${wikiPerformerIndex.maker}) = ${normalizedMaker} AND (
            lower(${wikiPerformerIndex.performerName}) = ${extractedName.toLowerCase()} OR
            lower(${wikiPerformerIndex.performerNameRomaji}) = ${extractedName.toLowerCase()} OR
            lower(${wikiPerformerIndex.productTitle}) LIKE ${'%' + extractedName.toLowerCase() + '%'}
          )`,
          // 名前の変換候補にマッチ
          sql`lower(${wikiPerformerIndex.maker}) = ${normalizedMaker} AND
            ${wikiPerformerIndex.performerNameVariants}::text ILIKE ${'%' + extractedName + '%'}`
        )
      )
      .limit(10);

    return results.map((r) => ({
      performerName: r.performerName,
      performerNameRomaji: r.performerNameRomaji,
      performerNameVariants: r.performerNameVariants as string[] | null,
      maker: r.maker,
      productTitle: r.productTitle,
      source: r.source,
      confidence: r.confidence,
    }));
  }

  /**
   * 出演者名から検索（あいまい検索）
   * @param name 出演者名（ひらがな、カタカナ、ローマ字対応）
   */
  async function searchPerformerByName(
    name: string
  ): Promise<WikiPerformerSearchResult[]> {
    const results = await db
      .select()
      .from(wikiPerformerIndex)
      .where(
        or(
          ilike(wikiPerformerIndex.performerName, `%${name}%`),
          ilike(wikiPerformerIndex.performerNameRomaji, `%${name}%`),
          sql`${wikiPerformerIndex.performerNameVariants}::text ILIKE ${'%' + name + '%'}`
        )
      )
      .limit(20);

    return results.map((r) => ({
      performerName: r.performerName,
      performerNameRomaji: r.performerNameRomaji,
      performerNameVariants: r.performerNameVariants as string[] | null,
      maker: r.maker,
      productTitle: r.productTitle,
      source: r.source,
      confidence: r.confidence,
    }));
  }

  /**
   * 商品タイトルから出演者を自動検出
   * メーカー名と出演者名をタイトルから抽出して検索
   * @param productTitle 商品タイトル全体
   */
  async function detectPerformerFromTitle(
    productTitle: string
  ): Promise<WikiPerformerSearchResult | null> {
    // メーカー名パターン
    const makerPatterns: { pattern: RegExp; maker: string }[] = [
      { pattern: /G[-]?AREA/i, maker: 'g-area' },
      { pattern: /Tokyo[-\s]?247/i, maker: 'tokyo247' },
      { pattern: /S[-]?Cute/i, maker: 's-cute' },
    ];

    for (const { pattern, maker } of makerPatterns) {
      if (pattern.test(productTitle)) {
        // タイトルから名前を抽出
        const afterMaker = productTitle.replace(pattern, '').trim();
        // 最初の単語（スペース、カッコの前まで）を名前として取得
        const nameMatch = afterMaker.match(/^([^\s【】（）\(\)]+)/);
        if (nameMatch) {
          const name = nameMatch[1];
          const results = await searchPerformerByMakerAndTitle(maker, name);
          if (results.length > 0) {
            return results[0];
          }
        }
      }
    }

    return null;
  }

  /**
   * 商品コードから出演者を検索
   * @param productCode 商品コード（例: "GAREA-123"）
   */
  async function searchPerformerByProductCode(
    productCode: string
  ): Promise<WikiPerformerSearchResult[]> {
    const results = await db
      .select()
      .from(wikiPerformerIndex)
      .where(eq(wikiPerformerIndex.productCode, productCode))
      .limit(10);

    return results.map((r) => ({
      performerName: r.performerName,
      performerNameRomaji: r.performerNameRomaji,
      performerNameVariants: r.performerNameVariants as string[] | null,
      maker: r.maker,
      productTitle: r.productTitle,
      source: r.source,
      confidence: r.confidence,
    }));
  }

  return {
    searchPerformerByMakerAndTitle,
    searchPerformerByName,
    detectPerformerFromTitle,
    searchPerformerByProductCode,
  };
}
