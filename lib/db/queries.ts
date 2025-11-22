import { getDb } from './index';
import { products, performers, productPerformers, tags, productTags, productSources, productCache } from './schema';
import { eq, and, or, like, desc, asc, gte, lte, sql } from 'drizzle-orm';
import type { Product as ProductType, Actress as ActressType, ProductCategory } from '@/types/product';
import type { InferSelectModel } from 'drizzle-orm';
import { mapLegacyProvider, mapLegacyServices } from '@/lib/provider-utils';

type DbProduct = InferSelectModel<typeof products>;
type DbPerformer = InferSelectModel<typeof performers>;

/**
 * 女優名からIDを生成（プロバイダープレフィックスなし）
 */
export function generateActressId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, '-')
    .replace(/^-+|-+$/g, '');
}


/**
 * 商品をIDで取得
 */
export async function getProductById(id: string): Promise<ProductType | null> {
  try {
    const db = getDb();

    // 商品の基本情報を取得
    const result = await db
      .select()
      .from(products)
      .where(eq(products.id, parseInt(id)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const product = result[0];

    // 出演者情報を取得
    const performerData = await db
      .select({
        id: performers.id,
        name: performers.name,
        nameKana: performers.nameKana,
      })
      .from(productPerformers)
      .innerJoin(performers, eq(productPerformers.performerId, performers.id))
      .where(eq(productPerformers.productId, product.id));

    // タグ情報を取得
    const tagData = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, product.id));

    // ASP情報とキャッシュを取得（最初の1件）
    const sourceData = await db
      .select()
      .from(productSources)
      .where(eq(productSources.productId, product.id))
      .limit(1);

    const cacheData = await db
      .select()
      .from(productCache)
      .where(eq(productCache.productId, product.id))
      .limit(1);

    return mapProductToType(product, performerData, tagData, sourceData[0], cacheData[0]);
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    throw error;
  }
}

/**
 * 商品を商品IDで検索（normalizedProductIdまたはoriginalProductId）
 */
export async function searchProductByProductId(productId: string): Promise<ProductType | null> {
  try {
    const db = getDb();

    // まずnormalizedProductIdで検索
    const productByNormalizedId = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, productId))
      .limit(1);

    if (productByNormalizedId.length > 0) {
      const product = productByNormalizedId[0];

      // 出演者情報を取得
      const performerData = await db
        .select({
          id: performers.id,
          name: performers.name,
          nameKana: performers.nameKana,
        })
        .from(productPerformers)
        .innerJoin(performers, eq(productPerformers.performerId, performers.id))
        .where(eq(productPerformers.productId, product.id));

      // タグ情報を取得
      const tagData = await db
        .select({
          id: tags.id,
          name: tags.name,
          category: tags.category,
        })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(eq(productTags.productId, product.id));

      // ASP情報とキャッシュを取得
      const sourceData = await db
        .select()
        .from(productSources)
        .where(eq(productSources.productId, product.id))
        .limit(1);

      const cacheData = await db
        .select()
        .from(productCache)
        .where(eq(productCache.productId, product.id))
        .limit(1);

      return mapProductToType(product, performerData, tagData, sourceData[0], cacheData[0]);
    }

    // originalProductIdで検索
    const sourceByOriginalId = await db
      .select()
      .from(productSources)
      .where(eq(productSources.originalProductId, productId))
      .limit(1);

    if (sourceByOriginalId.length === 0) {
      return null;
    }

    const source = sourceByOriginalId[0];

    // 商品情報を取得
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, source.productId))
      .limit(1);

    if (product.length === 0) {
      return null;
    }

    const productData = product[0];

    // 出演者情報を取得
    const performerData = await db
      .select({
        id: performers.id,
        name: performers.name,
        nameKana: performers.nameKana,
      })
      .from(productPerformers)
      .innerJoin(performers, eq(productPerformers.performerId, performers.id))
      .where(eq(productPerformers.productId, productData.id));

    // タグ情報を取得
    const tagData = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, productData.id));

    // キャッシュを取得
    const cacheData = await db
      .select()
      .from(productCache)
      .where(eq(productCache.productId, productData.id))
      .limit(1);

    return mapProductToType(productData, performerData, tagData, source, cacheData[0]);
  } catch (error) {
    console.error(`Error searching product by product ID ${productId}:`, error);
    throw error;
  }
}

/**
 * 商品一覧を取得
 */
export type SortOption = 
  | 'releaseDateDesc'    // リリース日（新しい順）
  | 'releaseDateAsc'     // リリース日（古い順）
  | 'priceDesc'          // 価格（高い順）
  | 'priceAsc'           // 価格（安い順）
  | 'ratingDesc'         // 評価（高い順）
  | 'ratingAsc'          // 評価（低い順）
  | 'titleAsc';          // タイトル（あいうえお順）

export interface GetProductsOptions {
  limit?: number;
  offset?: number;
  category?: string;
  provider?: string;
  actressId?: string;
  isFeatured?: boolean;
  isNew?: boolean;
  query?: string;
  sortBy?: SortOption;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[]; // 対象タグIDの配列（いずれかを含む）
  excludeTags?: string[]; // 除外タグIDの配列（いずれも含まない）
}

export async function getProducts(options?: GetProductsOptions): Promise<ProductType[]> {
  try {
    const db = getDb();
    const conditions = [];

    // プロバイダー（ASP）でフィルタ
    if (options?.provider) {
      // Map frontend provider names to ASP names
      const aspMapping: Record<string, string[]> = {
        'duga': ['DUGA', 'APEX'],
        'dti': ['DTI'],
        'dmm': ['DMM'],
        'sokmil': ['SOKMIL'],
      };
      const aspNames = aspMapping[options.provider.toLowerCase()] || [options.provider];

      // サブクエリでこのASPを持つ商品IDを取得
      const productIds = await db
        .selectDistinct({ productId: productSources.productId })
        .from(productSources)
        .where(sql`${productSources.aspName} IN ${sql.raw(`('${aspNames.join("','")}')`)}`)

      if (productIds.length > 0) {
        conditions.push(
          sql`${products.id} IN ${sql.raw(`(${productIds.map(p => p.productId).join(',')})`)}`
        );
      } else {
        // 該当商品なし
        return [];
      }
    }

    // 価格フィルタ（productSourcesの価格を使用）
    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      const priceConditions = [];
      if (options.minPrice !== undefined) {
        priceConditions.push(sql`${productSources.price} >= ${options.minPrice}`);
      }
      if (options.maxPrice !== undefined) {
        priceConditions.push(sql`${productSources.price} <= ${options.maxPrice}`);
      }

      // サブクエリで価格条件を満たす商品IDを取得
      const productIds = await db
        .selectDistinct({ productId: productSources.productId })
        .from(productSources)
        .where(and(...priceConditions));

      if (productIds.length > 0) {
        conditions.push(
          sql`${products.id} IN ${sql.raw(`(${productIds.map(p => p.productId).join(',')})`)}`
        );
      } else {
        // 該当商品なし
        return [];
      }
    }

    // 女優IDでフィルタ（多対多リレーション）
    if (options?.actressId) {
      const performerId = parseInt(options.actressId);
      if (!isNaN(performerId)) {
        // サブクエリで出演者を持つ商品IDを取得
        const productIds = await db
          .selectDistinct({ productId: productPerformers.productId })
          .from(productPerformers)
          .where(eq(productPerformers.performerId, performerId));

        if (productIds.length > 0) {
          conditions.push(
            sql`${products.id} IN ${sql.raw(`(${productIds.map(p => p.productId).join(',')})`)}`
          );
        } else {
          // 該当商品なし
          return [];
        }
      }
    }

    // タグでフィルタ（対象タグ - いずれかを含む）
    if (options?.tags && options.tags.length > 0) {
      const tagIds = options.tags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        // サブクエリでタグを持つ商品IDを取得
        const productIds = await db
          .selectDistinct({ productId: productTags.productId })
          .from(productTags)
          .where(sql`${productTags.tagId} IN ${sql.raw(`(${tagIds.join(',')})`)}`);

        if (productIds.length > 0) {
          conditions.push(
            sql`${products.id} IN ${sql.raw(`(${productIds.map(p => p.productId).join(',')})`)}`
          );
        } else {
          // 該当商品なし
          return [];
        }
      }
    }

    // 除外タグでフィルタ（いずれも含まない）
    if (options?.excludeTags && options.excludeTags.length > 0) {
      const excludeTagIds = options.excludeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (excludeTagIds.length > 0) {
        // サブクエリで除外タグを持つ商品IDを取得
        const excludedProductIds = await db
          .selectDistinct({ productId: productTags.productId })
          .from(productTags)
          .where(sql`${productTags.tagId} IN ${sql.raw(`(${excludeTagIds.join(',')})`)}`);

        if (excludedProductIds.length > 0) {
          conditions.push(
            sql`${products.id} NOT IN ${sql.raw(`(${excludedProductIds.map(p => p.productId).join(',')})`)}`
          );
        }
      }
    }

    // 検索クエリ（タイトル、説明を検索）- 類似性ベースのあいまい検索を使用
    if (options?.query) {
      // pg_trgmを使用した類似性検索（similarity > 0.2 の結果を返す）
      conditions.push(
        or(
          sql`similarity(${products.title}, ${options.query}) > 0.2`,
          sql`similarity(${products.description}, ${options.query}) > 0.15`,
          sql`${products.title} ILIKE ${'%' + options.query + '%'}`,
          sql`${products.description} ILIKE ${'%' + options.query + '%'}`
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ソート処理
    // 価格ソートの場合は特別な処理が必要（productSourcesとJOIN）
    if (options?.sortBy === 'priceAsc' || options?.sortBy === 'priceDesc') {
      // 価格でソートする場合、productSourcesとJOINしてソート
      const results = await db
        .selectDistinct({
          product: products,
          price: productSources.price,
        })
        .from(products)
        .innerJoin(productSources, eq(products.id, productSources.productId))
        .where(whereClause)
        .orderBy(
          options.sortBy === 'priceAsc'
            ? asc(productSources.price)
            : desc(productSources.price)
        )
        .limit(options?.limit || 100)
        .offset(options?.offset || 0);

      // バッチでデータを取得（N+1問題解消）
      const productIds = results.map(r => r.product.id);
      if (productIds.length === 0) return [];

      const [allPerformers, allTags, allSources, allCaches] = await Promise.all([
        db
          .select({
            productId: productPerformers.productId,
            id: performers.id,
            name: performers.name,
            nameKana: performers.nameKana,
          })
          .from(productPerformers)
          .innerJoin(performers, eq(productPerformers.performerId, performers.id))
          .where(sql`${productPerformers.productId} IN ${sql.raw(`(${productIds.join(',')})`)}`),
        db
          .select({
            productId: productTags.productId,
            id: tags.id,
            name: tags.name,
            category: tags.category,
          })
          .from(productTags)
          .innerJoin(tags, eq(productTags.tagId, tags.id))
          .where(sql`${productTags.productId} IN ${sql.raw(`(${productIds.join(',')})`)}`),
        db
          .select()
          .from(productSources)
          .where(sql`${productSources.productId} IN ${sql.raw(`(${productIds.join(',')})`)}`),
        db
          .select()
          .from(productCache)
          .where(sql`${productCache.productId} IN ${sql.raw(`(${productIds.join(',')})`)}`),
      ]);

      // Map by productId
      const performersMap = new Map<number, typeof allPerformers>();
      for (const p of allPerformers) {
        if (!performersMap.has(p.productId)) performersMap.set(p.productId, []);
        performersMap.get(p.productId)!.push(p);
      }

      const tagsMap = new Map<number, typeof allTags>();
      for (const t of allTags) {
        if (!tagsMap.has(t.productId)) tagsMap.set(t.productId, []);
        tagsMap.get(t.productId)!.push(t);
      }

      const sourcesMap = new Map<number, typeof allSources[0]>();
      for (const s of allSources) {
        if (!sourcesMap.has(s.productId)) sourcesMap.set(s.productId, s);
      }

      const cachesMap = new Map<number, typeof allCaches[0]>();
      for (const c of allCaches) {
        if (!cachesMap.has(c.productId)) cachesMap.set(c.productId, c);
      }

      return results.map((row) => {
        const product = row.product;
        const performerData = (performersMap.get(product.id) || []).map(p => ({
          id: p.id,
          name: p.name,
          nameKana: p.nameKana,
        }));
        const tagData = (tagsMap.get(product.id) || []).map(t => ({
          id: t.id,
          name: t.name,
          category: t.category,
        }));
        return mapProductToType(product, performerData, tagData, sourcesMap.get(product.id), cachesMap.get(product.id));
      });
    }

    // 通常のソート処理
    let orderByClause;
    switch (options?.sortBy) {
      case 'releaseDateAsc':
        orderByClause = [asc(products.releaseDate), asc(products.createdAt)];
        break;
      case 'titleAsc':
        orderByClause = [asc(products.title)];
        break;
      case 'releaseDateDesc':
      default:
        orderByClause = [desc(products.releaseDate), desc(products.createdAt)];
        break;
    }

    const results = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(options?.limit || 100)
      .offset(options?.offset || 0);

    // バッチでデータを取得（N+1問題解消）
    const productIds = results.map(p => p.id);
    if (productIds.length === 0) return [];

    const [allPerformers, allTags, allSources, allCaches] = await Promise.all([
      db
        .select({
          productId: productPerformers.productId,
          id: performers.id,
          name: performers.name,
          nameKana: performers.nameKana,
        })
        .from(productPerformers)
        .innerJoin(performers, eq(productPerformers.performerId, performers.id))
        .where(sql`${productPerformers.productId} IN ${sql.raw(`(${productIds.join(',')})`)}`),
      db
        .select({
          productId: productTags.productId,
          id: tags.id,
          name: tags.name,
          category: tags.category,
        })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(sql`${productTags.productId} IN ${sql.raw(`(${productIds.join(',')})`)}`),
      db
        .select()
        .from(productSources)
        .where(sql`${productSources.productId} IN ${sql.raw(`(${productIds.join(',')})`)}`),
      db
        .select()
        .from(productCache)
        .where(sql`${productCache.productId} IN ${sql.raw(`(${productIds.join(',')})`)}`),
    ]);

    // Map by productId
    const performersMap = new Map<number, typeof allPerformers>();
    for (const p of allPerformers) {
      if (!performersMap.has(p.productId)) performersMap.set(p.productId, []);
      performersMap.get(p.productId)!.push(p);
    }

    const tagsMap = new Map<number, typeof allTags>();
    for (const t of allTags) {
      if (!tagsMap.has(t.productId)) tagsMap.set(t.productId, []);
      tagsMap.get(t.productId)!.push(t);
    }

    const sourcesMap = new Map<number, typeof allSources[0]>();
    for (const s of allSources) {
      if (!sourcesMap.has(s.productId)) sourcesMap.set(s.productId, s);
    }

    const cachesMap = new Map<number, typeof allCaches[0]>();
    for (const c of allCaches) {
      if (!cachesMap.has(c.productId)) cachesMap.set(c.productId, c);
    }

    return results.map((product) => {
      const performerData = (performersMap.get(product.id) || []).map(p => ({
        id: p.id,
        name: p.name,
        nameKana: p.nameKana,
      }));
      const tagData = (tagsMap.get(product.id) || []).map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
      }));
      return mapProductToType(product, performerData, tagData, sourcesMap.get(product.id), cachesMap.get(product.id));
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

/**
 * 女優IDで商品を取得
 */
export async function getProductsByActress(actressId: string): Promise<ProductType[]> {
  try {
    return await getProducts({ actressId, sortBy: 'releaseDateDesc', limit: 1000 });
  } catch (error) {
    console.error(`Error fetching products for actress ${actressId}:`, error);
    throw error;
  }
}

/**
 * 女優一覧を取得
 */
export type ActressSortOption =
  | 'nameAsc'           // 名前（あいうえお順）
  | 'nameDesc'          // 名前（逆順）
  | 'productCountDesc'  // 作品数（多い順）
  | 'productCountAsc'   // 作品数（少ない順）
  | 'recent';           // 新着順

export async function getActresses(options?: {
  limit?: number;
  offset?: number;
  query?: string;
  includeTags?: string[];
  excludeTags?: string[];
  sortBy?: ActressSortOption;
}): Promise<ActressType[]> {
  try {
    const db = getDb();
    const conditions = [];

    // 対象タグでフィルタ（いずれかを含む）
    if (options?.includeTags && options.includeTags.length > 0) {
      const tagIds = options.includeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        // このタグのいずれかを持つ商品に出演している女優IDを取得
        const performerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productTags)
          .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
          .where(sql`${productTags.tagId} IN ${sql.raw(`(${tagIds.join(',')})`)}`);

        if (performerIds.length > 0) {
          conditions.push(
            sql`${performers.id} IN ${sql.raw(`(${performerIds.map(p => p.performerId).join(',')})`)}`
          );
        } else {
          // 該当女優なし
          return [];
        }
      }
    }

    // 除外タグでフィルタ（いずれも含まない）
    if (options?.excludeTags && options.excludeTags.length > 0) {
      const tagIds = options.excludeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        // この除外タグのいずれかを持つ商品に出演している女優IDを取得
        const excludedPerformerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productTags)
          .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
          .where(sql`${productTags.tagId} IN ${sql.raw(`(${tagIds.join(',')})`)}`);

        if (excludedPerformerIds.length > 0) {
          conditions.push(
            sql`${performers.id} NOT IN ${sql.raw(`(${excludedPerformerIds.map(p => p.performerId).join(',')})`)}`
          );
        }
      }
    }

    // 検索クエリ（名前を検索）- 類似性ベースのあいまい検索を使用
    if (options?.query) {
      // pg_trgmを使用した類似性検索（similarity > 0.2 の結果を返す）
      conditions.push(
        or(
          sql`similarity(${performers.name}, ${options.query}) > 0.2`,
          sql`similarity(${performers.nameKana}, ${options.query}) > 0.2`,
          sql`${performers.name} ILIKE ${'%' + options.query + '%'}`,
          sql`${performers.nameKana} ILIKE ${'%' + options.query + '%'}`
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ソート処理
    let orderByClause;
    const sortBy = options?.sortBy || 'nameAsc';

    if (sortBy === 'productCountDesc' || sortBy === 'productCountAsc') {
      // 作品数順の場合は、LEFT JOINして作品数でソート
      const results = await db
        .select({
          performer: performers,
          productCount: sql<number>`COALESCE(COUNT(${productPerformers.productId}), 0)`,
        })
        .from(performers)
        .leftJoin(productPerformers, eq(performers.id, productPerformers.performerId))
        .where(whereClause)
        .groupBy(performers.id)
        .orderBy(
          sortBy === 'productCountDesc'
            ? desc(sql`COALESCE(COUNT(${productPerformers.productId}), 0)`)
            : asc(sql`COALESCE(COUNT(${productPerformers.productId}), 0)`)
        )
        .limit(options?.limit || 100)
        .offset(options?.offset || 0);

      // バッチで作品数とサムネイルを取得
      const performerIds = results.map(r => r.performer.id);
      const [productCounts, thumbnails] = await Promise.all([
        batchGetPerformerProductCounts(db, performerIds),
        batchGetPerformerThumbnails(db, performerIds),
      ]);
      return results.map(r => mapPerformerToActressTypeSync(
        r.performer,
        productCounts.get(r.performer.id) || 0,
        thumbnails.get(r.performer.id)
      ));
    } else {
      // 名前順または新着順
      switch (sortBy) {
        case 'nameAsc':
          orderByClause = asc(performers.name);
          break;
        case 'nameDesc':
          orderByClause = desc(performers.name);
          break;
        case 'recent':
          orderByClause = desc(performers.createdAt);
          break;
        default:
          orderByClause = asc(performers.name);
      }

      const results = await db
        .select()
        .from(performers)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(options?.limit || 100)
        .offset(options?.offset || 0);

      // バッチで作品数とサムネイルを取得
      const performerIds = results.map(p => p.id);
      const [productCounts, thumbnails] = await Promise.all([
        batchGetPerformerProductCounts(db, performerIds),
        batchGetPerformerThumbnails(db, performerIds),
      ]);
      return results.map(performer => mapPerformerToActressTypeSync(
        performer,
        productCounts.get(performer.id) || 0,
        thumbnails.get(performer.id)
      ));
    }
  } catch (error) {
    console.error('Error fetching actresses:', error);
    throw error;
  }
}

/**
 * バッチで複数女優の作品数を取得
 */
async function batchGetPerformerProductCounts(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, number>> {
  if (performerIds.length === 0) return new Map();

  const results = await db
    .select({
      performerId: productPerformers.performerId,
      count: sql<number>`count(*)`,
    })
    .from(productPerformers)
    .where(sql`${productPerformers.performerId} IN ${sql.raw(`(${performerIds.join(',')})`)}`
    )
    .groupBy(productPerformers.performerId);

  const map = new Map<number, number>();
  for (const r of results) {
    map.set(r.performerId, Number(r.count));
  }
  return map;
}

/**
 * バッチで複数女優のサムネイル画像を取得（最新作品のサムネイルを使用）
 */
async function batchGetPerformerThumbnails(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, string>> {
  if (performerIds.length === 0) return new Map();

  // 各女優の最新作品のサムネイルURLを取得
  const results = await db
    .select({
      performerId: productPerformers.performerId,
      thumbnailUrl: productCache.thumbnailUrl,
    })
    .from(productPerformers)
    .innerJoin(productCache, eq(productPerformers.productId, productCache.productId))
    .where(
      and(
        sql`${productPerformers.performerId} IN ${sql.raw(`(${performerIds.join(',')})`)}`,
        sql`${productCache.thumbnailUrl} IS NOT NULL`
      )
    )
    .orderBy(desc(productCache.cachedAt))
    .limit(performerIds.length * 3); // 各女優に最大3件取得して重複に対応

  const map = new Map<number, string>();
  for (const r of results) {
    // 既に設定済みでなければ設定（最新のものを優先）
    if (!map.has(r.performerId) && r.thumbnailUrl) {
      map.set(r.performerId, r.thumbnailUrl);
    }
  }
  return map;
}

/**
 * タグ一覧を取得（カテゴリ別）
 */
export async function getTags(category?: string): Promise<Array<{ id: number; name: string; category: string | null; count: number }>> {
  try {
    const db = getDb();

    // タグとその使用数を取得
    const results = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
        count: sql<number>`count(${productTags.productId})`,
      })
      .from(tags)
      .leftJoin(productTags, eq(tags.id, productTags.tagId))
      .where(category ? eq(tags.category, category) : undefined)
      .groupBy(tags.id, tags.name, tags.category)
      .orderBy(desc(sql`count(${productTags.productId})`));

    return results.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      count: Number(r.count),
    }));
  } catch (error) {
    console.error('Error fetching tags:', error);
    throw error;
  }
}

/**
 * 女優の作品に絞ったタグ一覧を取得（カテゴリ別）
 */
export async function getTagsForActress(actressId: string, category?: string): Promise<Array<{ id: number; name: string; category: string | null; count: number }>> {
  try {
    const db = getDb();
    const performerId = parseInt(actressId);

    if (isNaN(performerId)) {
      return [];
    }

    // まず女優の作品IDを取得
    const actressProductIds = await db
      .selectDistinct({ productId: productPerformers.productId })
      .from(productPerformers)
      .where(eq(productPerformers.performerId, performerId));

    if (actressProductIds.length === 0) {
      return [];
    }

    const productIdList = actressProductIds.map(p => p.productId);

    // タグとその使用数を取得（女優の作品に絞る）
    const results = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
        count: sql<number>`count(${productTags.productId})`,
      })
      .from(tags)
      .innerJoin(productTags, eq(tags.id, productTags.tagId))
      .where(
        and(
          category ? eq(tags.category, category) : undefined,
          sql`${productTags.productId} IN ${sql.raw(`(${productIdList.join(',')})`)}`
        )
      )
      .groupBy(tags.id, tags.name, tags.category)
      .orderBy(desc(sql`count(${productTags.productId})`));

    return results.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      count: Number(r.count),
    }));
  } catch (error) {
    console.error('Error fetching tags for actress:', error);
    throw error;
  }
}

/**
 * 女優の総数を取得
 */
export async function getActressesCount(options?: {
  query?: string;
  includeTags?: string[];
  excludeTags?: string[];
}): Promise<number> {
  try {
    const db = getDb();
    const conditions = [];

    // 対象タグでフィルタ（いずれかを含む）
    if (options?.includeTags && options.includeTags.length > 0) {
      const tagIds = options.includeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        const performerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productTags)
          .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
          .where(sql`${productTags.tagId} IN ${sql.raw(`(${tagIds.join(',')})`)}`);

        if (performerIds.length > 0) {
          conditions.push(
            sql`${performers.id} IN ${sql.raw(`(${performerIds.map(p => p.performerId).join(',')})`)}`
          );
        } else {
          return 0;
        }
      }
    }

    // 除外タグでフィルタ（いずれも含まない）
    if (options?.excludeTags && options.excludeTags.length > 0) {
      const tagIds = options.excludeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        const excludedPerformerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productTags)
          .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
          .where(sql`${productTags.tagId} IN ${sql.raw(`(${tagIds.join(',')})`)}`);

        if (excludedPerformerIds.length > 0) {
          conditions.push(
            sql`${performers.id} NOT IN ${sql.raw(`(${excludedPerformerIds.map(p => p.performerId).join(',')})`)}`
          );
        }
      }
    }

    // 検索クエリ（名前を検索）- 類似性ベースのあいまい検索を使用
    if (options?.query) {
      // pg_trgmを使用した類似性検索（similarity > 0.2 の結果を返す）
      conditions.push(
        or(
          sql`similarity(${performers.name}, ${options.query}) > 0.2`,
          sql`similarity(${performers.nameKana}, ${options.query}) > 0.2`,
          sql`${performers.name} ILIKE ${'%' + options.query + '%'}`,
          sql`${performers.nameKana} ILIKE ${'%' + options.query + '%'}`
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(performers)
      .where(whereClause);

    return Number(result[0]?.count || 0);
  } catch (error) {
    console.error('Error counting actresses:', error);
    throw error;
  }
}

/**
 * 女優をIDで取得
 */
export async function getActressById(id: string): Promise<ActressType | null> {
  try {
    const db = getDb();
    const performerId = parseInt(id);

    if (isNaN(performerId)) {
      return null;
    }

    const result = await db
      .select()
      .from(performers)
      .where(eq(performers.id, performerId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return await mapPerformerToActressType(result[0]);
  } catch (error) {
    console.error(`Error fetching actress ${id}:`, error);
    throw error;
  }
}

/**
 * 新着商品を取得
 */
export async function getNewProducts(limit = 100): Promise<ProductType[]> {
  return getProducts({ isNew: true, sortBy: 'releaseDateDesc', limit });
}

/**
 * 注目商品を取得
 */
export async function getFeaturedProducts(limit = 100): Promise<ProductType[]> {
  return getProducts({ isFeatured: true, sortBy: 'releaseDateDesc', limit });
}

/**
 * 注目の女優を取得
 */
export async function getFeaturedActresses(limit = 3): Promise<ActressType[]> {
  try {
    return await getActresses({ limit });
  } catch (error) {
    console.error('Error fetching featured actresses:', error);
    throw error;
  }
}

/**
 * Valid product categories
 */
const VALID_CATEGORIES: ProductCategory[] = ['all', 'premium', 'mature', 'fetish', 'vr', 'cosplay', 'indies'];

function isValidCategory(value: string): value is ProductCategory {
  return VALID_CATEGORIES.includes(value as ProductCategory);
}

/**
 * データベースの商品をProduct型に変換
 */
function mapProductToType(
  product: DbProduct,
  performerData: Array<{ id: number; name: string; nameKana: string | null }> = [],
  tagData: Array<{ id: number; name: string; category: string | null }> = [],
  source?: any,
  cache?: any
): ProductType {
  // ASP情報から provider を取得
  const aspName = source?.aspName || 'DUGA';
  const mappedProvider = mapLegacyProvider(aspName);

  // ASP名を表示用ラベルにマッピング
  const providerLabelMap: Record<string, string> = {
    'APEX': 'DUGA',
    'DUGA': 'DUGA',
    'DTI': 'DTI',
    'DMM': 'DMM',
    'SOKMIL': 'ソクミル',
  };
  const providerLabel = providerLabelMap[aspName.toUpperCase()] || aspName;

  // キャッシュから価格・画像情報を取得
  const price = cache?.price || source?.price || 0;
  const imageUrl = cache?.thumbnailUrl || 'https://placehold.co/600x800/1f2937/ffffff?text=NO+IMAGE';
  const affiliateUrl = source?.affiliateUrl || cache?.affiliateUrl || '';

  // タグからカテゴリを推定（仮実装）
  const category: ProductCategory = 'premium';

  // 出演者情報
  const actressId = performerData.length > 0 ? String(performerData[0].id) : undefined;
  const actressName = performerData.length > 0 ? performerData[0].name : undefined;

  // タグ名の配列
  const tags = tagData.map(t => t.name);

  return {
    id: String(product.id),
    normalizedProductId: product.normalizedProductId || undefined,
    originalProductId: source?.originalProductId || undefined,
    title: product.title,
    description: product.description || '',
    price,
    category,
    imageUrl,
    affiliateUrl,
    provider: mappedProvider,
    providerLabel,
    actressId,
    actressName,
    releaseDate: product.releaseDate || undefined,
    duration: product.duration || undefined,
    format: undefined,
    rating: undefined,
    reviewCount: undefined,
    tags,
    isFeatured: false,
    isNew: false,
    discount: undefined,
    reviewHighlight: undefined,
    ctaLabel: undefined,
  };
}

const ACTRESS_PLACEHOLDER = 'https://placehold.co/400x520/1f2937/ffffff?text=NO+IMAGE';

/**
 * データベースの出演者(performer)をActress型に変換（同期版）
 */
function mapPerformerToActressTypeSync(performer: DbPerformer, releaseCount: number, thumbnailUrl?: string): ActressType {
  const imageUrl = thumbnailUrl || ACTRESS_PLACEHOLDER;
  return {
    id: String(performer.id),
    name: performer.name,
    catchcopy: '',
    description: '',
    heroImage: imageUrl,
    thumbnail: imageUrl,
    primaryGenres: ['premium'],
    services: [],
    metrics: {
      releaseCount,
      trendingScore: 0,
      fanScore: 0,
    },
    highlightWorks: [],
    tags: [],
  };
}

/**
 * データベースの出演者(performer)をActress型に変換（非同期版 - 単一取得用）
 */
async function mapPerformerToActressType(performer: DbPerformer): Promise<ActressType> {
  const db = getDb();

  // 作品数とサムネイルを並列取得
  const [productCountResult, thumbnailResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(productPerformers)
      .where(eq(productPerformers.performerId, performer.id)),
    db.select({ thumbnailUrl: productCache.thumbnailUrl })
      .from(productPerformers)
      .innerJoin(productCache, eq(productPerformers.productId, productCache.productId))
      .where(
        and(
          eq(productPerformers.performerId, performer.id),
          sql`${productCache.thumbnailUrl} IS NOT NULL`
        )
      )
      .orderBy(desc(productCache.cachedAt))
      .limit(1),
  ]);

  const releaseCount = productCountResult[0]?.count || 0;
  const thumbnailUrl = thumbnailResult[0]?.thumbnailUrl;

  return mapPerformerToActressTypeSync(performer, Number(releaseCount), thumbnailUrl ?? undefined);
}

/**
 * 商品をあいまい検索（メーカー品番、タイトル、normalizedProductIdで検索）
 * 複数の商品が見つかる可能性があります
 */
export async function fuzzySearchProducts(query: string, limit: number = 20): Promise<ProductType[]> {
  try {
    const db = getDb();
    const searchPattern = `%${query}%`;

    // product_sourcesテーブルでoriginal_product_idを検索
    const sourceMatches = await db
      .select({ productId: productSources.productId })
      .from(productSources)
      .where(sql`${productSources.originalProductId} ILIKE ${searchPattern}`)
      .limit(limit);

    // productsテーブルでnormalized_product_idとtitleを検索
    const productMatches = await db
      .select({ id: products.id })
      .from(products)
      .where(
        or(
          sql`${products.normalizedProductId} ILIKE ${searchPattern}`,
          sql`${products.title} ILIKE ${searchPattern}`
        )!
      )
      .limit(limit);

    // 重複を排除してproduct IDsを集める
    const productIds = new Set<string>();
    sourceMatches.forEach(m => productIds.add(m.productId.toString()));
    productMatches.forEach(m => productIds.add(m.id.toString()));

    if (productIds.size === 0) {
      return [];
    }

    // 各商品の詳細情報を取得
    const productDetails = await Promise.all(
      Array.from(productIds).slice(0, limit).map(id => getProductById(id))
    );

    return productDetails.filter((p): p is ProductType => p !== null);
  } catch (error) {
    console.error('Error in fuzzy search:', error);
    throw error;
  }
}

