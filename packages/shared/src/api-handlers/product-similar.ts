import { sql, eq } from 'drizzle-orm';
import { logDbErrorAndReturn } from '../lib/db-logger';

export interface ProductSimilarHandlerDeps {
  getDb: () => {
    select: (fields: Record<string, unknown>) => {
      from: (table: unknown) => {
        where: (condition: unknown) => {
          limit: (n: number) => Promise<unknown[]>;
        };
      };
    };
    execute: (query: unknown) => Promise<{ rows: unknown[] }>;
  };
  products: unknown;
  getCache: <T>(key: string) => Promise<T | null>;
  setCache: (key: string, value: unknown, ttl: number) => Promise<void>;
  generateCacheKey: (prefix: string, params: Record<string, unknown>) => string;
  aspName: string;
}

export interface ProductSimilarHandlerOptions {
  siteMode: 'fanza' | 'mgs';
}

interface SimilarProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  thumbnailUrl: string | null;
  similarityScore: number;
  similarityReasons: string[];
  performerScore: number;
  makerScore: number;
  genreScore: number;
  hop: number; // 1=同じ出演者 or メーカー、2=ジャンル類似
}

interface NetworkEdge {
  source: number;
  target: number;
  weight: number;
}

interface ProductSimilarityResponse {
  success: boolean;
  product: {
    id: number;
    title: string;
    normalizedProductId: string | null;
    thumbnailUrl: string | null;
  };
  similar: SimilarProduct[];
  edges: NetworkEdge[];
  stats: {
    totalSimilarCount: number;
    avgSimilarityScore: number;
  };
}

const CACHE_TTL = 60 * 60; // 1時間

export function createProductSimilarHandler(deps: ProductSimilarHandlerDeps, options: ProductSimilarHandlerOptions) {
  const { getDb, products, getCache, setCache, generateCacheKey } = deps;
  const { siteMode } = options;
  const isFanza = siteMode === 'fanza';
  const cachePrefix = isFanza ? 'product-similar:fanza:v2' : 'product-similar:mgs:v2';

  return async function handleProductSimilar(
    productId: number,
    limit: number = 12,
  ): Promise<{ data?: ProductSimilarityResponse; error?: string; status: number }> {
    try {
      if (isNaN(productId)) {
        return { error: 'Invalid product ID', status: 400 };
      }

      const safeLimit = Math.min(limit, 30);

      // キャッシュチェック
      const cacheKey = generateCacheKey(cachePrefix, { productId, limit: safeLimit });
      const cached = await getCache<ProductSimilarityResponse>(cacheKey);
      if (cached) {
        return { data: cached, status: 200 };
      }

      const db = getDb();

      // 対象の作品情報を取得
      const productData = (await (db as ReturnType<typeof getDb>)
        .select({
          id: (products as { id: unknown }).id,
          title: (products as { title: unknown }).title,
          normalizedProductId: (products as { normalizedProductId: unknown }).normalizedProductId,
          defaultThumbnailUrl: (products as { defaultThumbnailUrl: unknown }).defaultThumbnailUrl,
        })
        .from(products)
        .where(eq((products as { id: unknown }).id as Parameters<typeof eq>[0], productId))
        .limit(1)) as unknown as Array<{
        id: number;
        title: string;
        normalizedProductId: string | null;
        defaultThumbnailUrl: string | null;
      }>;

      const product = productData[0];
      if (!product) {
        return { error: 'Product not found', status: 404 };
      }
      const limitPerHop = Math.ceil(safeLimit / 2);

      // ASPフィルター
      const aspFilter = isFanza ? sql`AND ps.asp_name = 'FANZA'` : sql`AND ps.asp_name IS NOT NULL`;

      // 1ホップ目：同じ出演者の他作品
      const hop1Query = await db.execute(sql`
        WITH target_performers AS (
          SELECT performer_id
          FROM product_performers
          WHERE product_id = ${productId}
        ),
        performer_products AS (
          SELECT
            p.id,
            p.title,
            p.normalized_product_id,
            p.default_thumbnail_url,
            p.release_date,
            COUNT(DISTINCT pp.performer_id) as shared_performers
          FROM products p
          INNER JOIN product_performers pp ON p.id = pp.product_id
          INNER JOIN product_sources ps ON p.id = ps.product_id
          INNER JOIN target_performers tp ON pp.performer_id = tp.performer_id
          WHERE p.id != ${productId}
            ${aspFilter}
          GROUP BY p.id, p.title, p.normalized_product_id, p.default_thumbnail_url, p.release_date
          ORDER BY shared_performers DESC, p.release_date DESC NULLS LAST
          LIMIT ${limitPerHop}
        )
        SELECT
          id,
          title,
          normalized_product_id as "normalizedProductId",
          default_thumbnail_url as "thumbnailUrl",
          shared_performers as "sharedPerformers",
          1 as hop,
          'performer' as similarity_type
        FROM performer_products
      `);

      let hop1Results = hop1Query.rows as Array<{
        id: number;
        title: string;
        normalizedProductId: string | null;
        thumbnailUrl: string | null;
        sharedPerformers: number;
        hop: number;
        similarity_type: string;
      }>;

      // 出演者がいない場合はメーカー類似にフォールバック
      if (hop1Results.length === 0 && product.normalizedProductId) {
        const makerPrefix = product.normalizedProductId.match(/^[A-Za-z]+/)?.[0];
        if (makerPrefix) {
          const makerQuery = await db.execute(sql`
            SELECT
              p.id,
              p.title,
              p.normalized_product_id as "normalizedProductId",
              p.default_thumbnail_url as "thumbnailUrl",
              1 as "sharedPerformers",
              1 as hop,
              'maker' as similarity_type
            FROM products p
            INNER JOIN product_sources ps ON p.id = ps.product_id
            WHERE p.id != ${productId}
              AND p.normalized_product_id LIKE ${makerPrefix + '%'}
              ${aspFilter}
            GROUP BY p.id, p.title, p.normalized_product_id, p.default_thumbnail_url, p.release_date
            ORDER BY p.release_date DESC NULLS LAST
            LIMIT ${limitPerHop}
          `);
          hop1Results = makerQuery.rows as typeof hop1Results;
        }
      }

      // 2ホップ目：同じジャンルタグの作品（条件緩和: 1ジャンル以上）
      const hop1Ids = hop1Results.map((r) => r.id);
      const excludeIds = [productId, ...hop1Ids];
      const excludeIdsArray = `{${excludeIds.join(',')}}`;

      const hop2Query = await db.execute(sql`
        WITH target_genres AS (
          SELECT DISTINCT pt.tag_id, t.name
          FROM product_tags pt
          INNER JOIN tags t ON pt.tag_id = t.id
          WHERE pt.product_id = ${productId}
            AND t.category = 'genre'
        ),
        genre_products AS (
          SELECT
            p.id,
            p.title,
            p.normalized_product_id,
            p.default_thumbnail_url,
            p.release_date,
            COUNT(DISTINCT pt.tag_id) as shared_genres,
            STRING_AGG(DISTINCT tg.name, ', ' ORDER BY tg.name) as genre_names
          FROM products p
          INNER JOIN product_tags pt ON p.id = pt.product_id
          INNER JOIN target_genres tg ON pt.tag_id = tg.tag_id
          INNER JOIN product_sources ps ON p.id = ps.product_id
          WHERE p.id != ALL(${excludeIdsArray}::int[])
            ${aspFilter}
          GROUP BY p.id, p.title, p.normalized_product_id, p.default_thumbnail_url, p.release_date
          HAVING COUNT(DISTINCT pt.tag_id) >= 1
          ORDER BY shared_genres DESC, p.release_date DESC NULLS LAST
          LIMIT ${limitPerHop}
        )
        SELECT
          id,
          title,
          normalized_product_id as "normalizedProductId",
          default_thumbnail_url as "thumbnailUrl",
          shared_genres as "sharedGenres",
          genre_names as "genreNames",
          2 as hop
        FROM genre_products
      `);

      const hop2Results = hop2Query.rows as Array<{
        id: number;
        title: string;
        normalizedProductId: string | null;
        thumbnailUrl: string | null;
        sharedGenres: number;
        genreNames: string;
        hop: number;
      }>;

      // スコア計算
      const similarProducts: SimilarProduct[] = [];

      // 1ホップ目：同じ出演者 or 同じメーカー
      const maxSharedPerformers = hop1Results.length > 0 ? Math.max(...hop1Results.map((r) => r.sharedPerformers)) : 1;

      const isMakerBased = hop1Results.length > 0 && hop1Results[0]?.similarity_type === 'maker';

      for (const r of hop1Results) {
        const score = 0.6 + 0.4 * (r.sharedPerformers / maxSharedPerformers);
        const reason = isMakerBased ? '同じメーカー' : `共通出演者${r.sharedPerformers}人`;
        similarProducts.push({
          id: r.id,
          title: r.title,
          normalizedProductId: r.normalizedProductId,
          thumbnailUrl: r.thumbnailUrl,
          similarityScore: score,
          similarityReasons: [reason],
          performerScore: isMakerBased ? 0 : score,
          makerScore: isMakerBased ? score : 0,
          genreScore: 0,
          hop: 1,
        });
      }

      // 2ホップ目：ジャンル類似
      const maxSharedGenres = hop2Results.length > 0 ? Math.max(...hop2Results.map((r) => r.sharedGenres)) : 1;

      for (const r of hop2Results) {
        const genreScore = 0.4 + 0.4 * (r.sharedGenres / maxSharedGenres);
        const genrePreview = r.genreNames.split(', ').slice(0, 2).join(', ');
        similarProducts.push({
          id: r.id,
          title: r.title,
          normalizedProductId: r.normalizedProductId,
          thumbnailUrl: r.thumbnailUrl,
          similarityScore: genreScore,
          similarityReasons: [`${genrePreview}など${r.sharedGenres}ジャンル一致`],
          performerScore: 0,
          makerScore: 0,
          genreScore,
          hop: 2,
        });
      }

      // ホップでソート、同じホップ内はスコアでソート
      similarProducts.sort((a, b) => {
        if (a.hop !== b.hop) return a.hop - b.hop;
        return b.similarityScore - a.similarityScore;
      });

      const finalResults = similarProducts.slice(0, safeLimit);

      const totalSimilarCount = finalResults.length;
      const avgSimilarityScore =
        totalSimilarCount > 0 ? finalResults.reduce((sum, p) => sum + p.similarityScore, 0) / totalSimilarCount : 0;

      // エッジを生成（中心から各ノードへ、類似度ベース）
      const edges: NetworkEdge[] = finalResults.map((p) => ({
        source: productId,
        target: p.id,
        weight: Math.round(p.similarityScore * 100),
      }));

      const response: ProductSimilarityResponse = {
        success: true,
        product: {
          id: product['id'],
          title: product['title'],
          normalizedProductId: product.normalizedProductId,
          thumbnailUrl: product['defaultThumbnailUrl'],
        },
        similar: finalResults,
        edges,
        stats: {
          totalSimilarCount,
          avgSimilarityScore,
        },
      };

      await setCache(cacheKey, response, CACHE_TTL);

      return { data: response, status: 200 };
    } catch (error) {
      logDbErrorAndReturn(error, null, 'getProductSimilar');
      return { error: 'Internal server error', status: 500 };
    }
  };
}
