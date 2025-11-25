import { getDb } from './index';
import { products, performers, productPerformers, tags, productTags, productSources, performerAliases } from './schema';
import { eq, and, or, like, desc, asc, gte, lte, sql, inArray, notInArray } from 'drizzle-orm';
import type { Product as ProductType, Actress as ActressType, ProductCategory } from '@/types/product';
import type { InferSelectModel } from 'drizzle-orm';
import { mapLegacyProvider, mapLegacyServices } from '@/lib/provider-utils';

type DbProduct = InferSelectModel<typeof products>;
type DbPerformer = InferSelectModel<typeof performers>;

/**
 * DTI系サイトを除外するためのヘルパー関数
 * DMM affiliateの規約によりDTI系サイト（カリビアンコム、一本道、HEYZO等）は非表示にする必要がある
 * データはクローラで収集を続けるが、フロントエンドには表示しない
 */
async function excludeDTIProducts(db: ReturnType<typeof getDb>): Promise<number[]> {
  const dtiProducts = await db
    .selectDistinct({ productId: productSources.productId })
    .from(productSources)
    .where(eq(productSources.aspName, 'DTI'));

  return dtiProducts.map(p => p.productId);
}

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
 * 商品の関連データ（出演者、タグ、ソース、キャッシュ）を並列取得するヘルパー関数
 */
async function fetchProductRelatedData(db: ReturnType<typeof getDb>, productId: number) {
  const [performerData, tagData, sourceData] = await Promise.all([
    // 出演者情報を取得
    db
      .select({
        id: performers.id,
        name: performers.name,
        nameKana: performers.nameKana,
      })
      .from(productPerformers)
      .innerJoin(performers, eq(productPerformers.performerId, performers.id))
      .where(eq(productPerformers.productId, productId)),

    // タグ情報を取得
    db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, productId)),

    // ASP情報を取得
    db
      .select()
      .from(productSources)
      .where(eq(productSources.productId, productId))
      .limit(1),
  ]);

  return {
    performerData,
    tagData,
    sourceData: sourceData[0],
  };
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

    // 関連データを並列で取得
    const { performerData, tagData, sourceData } = await fetchProductRelatedData(db, product.id);

    return mapProductToType(product, performerData, tagData, sourceData);
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

      // 関連データを並列で取得
      const { performerData, tagData, sourceData } = await fetchProductRelatedData(db, product.id);

      return mapProductToType(product, performerData, tagData, sourceData);
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

    // 関連データを並列で取得（sourceは既に取得済みなので、出演者とタグのみ）
    const [performerData, tagData] = await Promise.all([
      db
        .select({
          id: performers.id,
          name: performers.name,
          nameKana: performers.nameKana,
        })
        .from(productPerformers)
        .innerJoin(performers, eq(productPerformers.performerId, performers.id))
        .where(eq(productPerformers.productId, productData.id)),

      db
        .select({
          id: tags.id,
          name: tags.name,
          category: tags.category,
        })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(eq(productTags.productId, productData.id)),
    ]);

    return mapProductToType(productData, performerData, tagData, source);
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

    // DTI系商品を除外（DMMアフィリエイト規約遵守）
    const dtiProductIds = await excludeDTIProducts(db);
    if (dtiProductIds.length > 0) {
      conditions.push(notInArray(products.id, dtiProductIds));
    }

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
        .where(inArray(productSources.aspName, aspNames));

      if (productIds.length > 0) {
        const productIdValues = productIds.map(p => p.productId);
        conditions.push(
          inArray(products.id, productIdValues)
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
        const productIdValues = productIds.map(p => p.productId);
        conditions.push(
          inArray(products.id, productIdValues)
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
          const productIdValues = productIds.map(p => p.productId);
          conditions.push(
            inArray(products.id, productIdValues)
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
          .where(inArray(productTags.tagId, tagIds));

        if (productIds.length > 0) {
          const productIdValues = productIds.map(p => p.productId);
          conditions.push(
            inArray(products.id, productIdValues)
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
          .where(inArray(productTags.tagId, excludeTagIds));

        if (excludedProductIds.length > 0) {
          const excludedProductIdValues = excludedProductIds.map(p => p.productId);
          conditions.push(
            notInArray(products.id, excludedProductIdValues)
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

      const [allPerformers, allTags, allSources] = await Promise.all([
        db
          .select({
            productId: productPerformers.productId,
            id: performers.id,
            name: performers.name,
            nameKana: performers.nameKana,
          })
          .from(productPerformers)
          .innerJoin(performers, eq(productPerformers.performerId, performers.id))
          .where(inArray(productPerformers.productId, productIds)),
        db
          .select({
            productId: productTags.productId,
            id: tags.id,
            name: tags.name,
            category: tags.category,
          })
          .from(productTags)
          .innerJoin(tags, eq(productTags.tagId, tags.id))
          .where(inArray(productTags.productId, productIds)),
        db
          .select()
          .from(productSources)
          .where(inArray(productSources.productId, productIds)),
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
        return mapProductToType(product, performerData, tagData, sourcesMap.get(product.id));
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

    const [allPerformers, allTags, allSources] = await Promise.all([
      db
        .select({
          productId: productPerformers.productId,
          id: performers.id,
          name: performers.name,
          nameKana: performers.nameKana,
        })
        .from(productPerformers)
        .innerJoin(performers, eq(productPerformers.performerId, performers.id))
        .where(inArray(productPerformers.productId, productIds)),
      db
        .select({
          productId: productTags.productId,
          id: tags.id,
          name: tags.name,
          category: tags.category,
        })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(inArray(productTags.productId, productIds)),
      db
        .select()
        .from(productSources)
        .where(inArray(productSources.productId, productIds)),
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
      return mapProductToType(product, performerData, tagData, sourcesMap.get(product.id));
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
  excludeInitials?: boolean; // 'etc'フィルタ用: 50音・アルファベット以外
}): Promise<ActressType[]> {
  try {
    const db = getDb();

    // DTI系商品を除外
    const dtiProductIds = await excludeDTIProducts(db);

    const conditions = [];

    // 'etc'フィルタ: 50音・アルファベット以外で始まる名前
    if (options?.excludeInitials) {
      conditions.push(
        sql`NOT (
          LEFT(${performers.name}, 1) ~ '^[ぁ-んァ-ヴーA-Za-z]'
        )`
      );
    }

    // 対象タグでフィルタ（いずれかを含む）
    if (options?.includeTags && options.includeTags.length > 0) {
      try {
        const tagIds = options.includeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
        if (tagIds.length > 0) {
          // DTI系商品を除外した条件を追加
          const tagWhereConditions = [inArray(productTags.tagId, tagIds)];
          if (dtiProductIds.length > 0) {
            tagWhereConditions.push(notInArray(productTags.productId, dtiProductIds));
          }

          // このタグのいずれかを持つ商品に出演している女優IDを取得（DTI除外）
          const performerIds = await db
            .selectDistinct({ performerId: productPerformers.performerId })
            .from(productTags)
            .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
            .where(and(...tagWhereConditions));

          if (performerIds.length > 0) {
            const performerIdValues = performerIds.map(p => p.performerId);
            conditions.push(
              inArray(performers.id, performerIdValues)
            );
          } else {
            // 該当女優なし
            return [];
          }
        }
      } catch (includeTagsError) {
        console.error('[GET ACTRESSES] Error in includeTags processing:', includeTagsError);
        throw includeTagsError;
      }
    }

    // 除外タグでフィルタ（いずれも含まない）
    if (options?.excludeTags && options.excludeTags.length > 0) {
      try {
        const tagIds = options.excludeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
        if (tagIds.length > 0) {
          // この除外タグのいずれかを持つ商品に出演している女優IDを取得
          const excludedPerformerIds = await db
            .selectDistinct({ performerId: productPerformers.performerId })
            .from(productTags)
            .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
            .where(inArray(productTags.tagId, tagIds));

          if (excludedPerformerIds.length > 0) {
            const excludedPerformerIdValues = excludedPerformerIds.map(p => p.performerId);
            conditions.push(
              notInArray(performers.id, excludedPerformerIdValues)
            );
          }
        }
      } catch (excludeTagsError) {
        console.error('[GET ACTRESSES] Error in excludeTags processing:', excludeTagsError);
        throw excludeTagsError;
      }
    }

    // 検索クエリ（名前を検索）- 類似性ベースのあいまい検索を使用
    // performer_aliases テーブルも検索対象に含める
    if (options?.query) {
      try {
        // 別名から一致する女優IDを取得
        // 頭文字検索（1文字）の場合は前方一致、それ以外はあいまい検索
        const isInitialSearch = options.query.length === 1;
        const searchPattern = isInitialSearch ? options.query + '%' : '%' + options.query + '%';

        const matchingPerformerIds = await db
          .selectDistinct({ performerId: performerAliases.performerId })
          .from(performerAliases)
          .where(
            or(
              sql`similarity(${performerAliases.aliasName}, ${options.query}) > 0.2`,
              sql`${performerAliases.aliasName} ILIKE ${searchPattern}`
            )!
          );

        // pg_trgmを使用した類似性検索（similarity > 0.2 の結果を返す）
        // 主名前、カナ名、または別名のいずれかに一致
        // 頭文字検索の場合、nameKanaがあればnameKanaで、なければnameで検索
        const nameConditions = isInitialSearch
          ? or(
              sql`(${performers.nameKana} IS NOT NULL AND ${performers.nameKana} ILIKE ${searchPattern})`,
              sql`(${performers.nameKana} IS NULL AND ${performers.name} ILIKE ${searchPattern})`
            )!
          : or(
              sql`similarity(${performers.name}, ${options.query}) > 0.2`,
              sql`similarity(${performers.nameKana}, ${options.query}) > 0.2`,
              sql`${performers.name} ILIKE ${searchPattern}`,
              sql`${performers.nameKana} ILIKE ${searchPattern}`
            )!;

        // 別名から一致した女優IDがあれば追加
        if (matchingPerformerIds.length > 0) {
          conditions.push(
            or(
              nameConditions,
              inArray(performers.id, matchingPerformerIds.map(p => p.performerId))
            )!
          );
        } else {
          conditions.push(nameConditions);
        }
      } catch (queryError) {
        console.error('[GET ACTRESSES] Error in query processing:', queryError);
        throw queryError;
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ソート処理
    let orderByClause;
    const sortBy = options?.sortBy || 'nameAsc';

    if (sortBy === 'productCountDesc' || sortBy === 'productCountAsc') {
      try {
        // DTI商品を除外したwhereClause
        const productCountWhereConditions = whereClause ? [whereClause] : [];
        if (dtiProductIds.length > 0) {
          productCountWhereConditions.push(
            or(
              sql`${productPerformers.productId} IS NULL`,
              notInArray(productPerformers.productId, dtiProductIds)
            )!
          );
        }

        // 作品数順の場合は、LEFT JOINして作品数でソート（DTI除外）
        const results = await db
          .select({
            performer: performers,
            productCount: sql<number>`COALESCE(COUNT(${productPerformers.productId}), 0)`,
          })
          .from(performers)
          .leftJoin(productPerformers, eq(performers.id, productPerformers.performerId))
          .where(productCountWhereConditions.length > 0 ? and(...productCountWhereConditions) : undefined)
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

        const actresses = results
          .map(r => mapPerformerToActressTypeSync(
            r.performer,
            productCounts.get(r.performer.id) || 0,
            thumbnails.get(r.performer.id)
          ))
          .filter(actress => actress.metrics && actress.metrics.releaseCount > 0); // DTI除外により作品数が0になった女優を非表示

        return actresses;
      } catch (sortError) {
        console.error('[GET ACTRESSES] Error in product count sort:', sortError);
        throw sortError;
      }
    } else if (sortBy === 'recent') {
      try {
        // DTI商品を除外したwhereClause
        const recentWhereConditions = whereClause ? [whereClause] : [];
        if (dtiProductIds.length > 0) {
          recentWhereConditions.push(
            or(
              sql`${products.id} IS NULL`,
              notInArray(products.id, dtiProductIds)
            )!
          );
        }

        // 新着順の場合は、作品のリリース日でソート（最新の作品が出ている女優を先に表示、DTI除外）
        const results = await db
          .select({
            performer: performers,
            latestReleaseDate: sql<Date>`MAX(${products.releaseDate})`,
          })
          .from(performers)
          .leftJoin(productPerformers, eq(performers.id, productPerformers.performerId))
          .leftJoin(products, eq(productPerformers.productId, products.id))
          .where(recentWhereConditions.length > 0 ? and(...recentWhereConditions) : undefined)
          .groupBy(performers.id)
          .orderBy(desc(sql`MAX(${products.releaseDate})`))
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);

        // バッチで作品数とサムネイルを取得
        const performerIds = results.map(r => r.performer.id);
        const [productCounts, thumbnails] = await Promise.all([
          batchGetPerformerProductCounts(db, performerIds),
          batchGetPerformerThumbnails(db, performerIds),
        ]);

        const actresses = results
          .map(r => mapPerformerToActressTypeSync(
            r.performer,
            productCounts.get(r.performer.id) || 0,
            thumbnails.get(r.performer.id)
          ))
          .filter(actress => actress.metrics && actress.metrics.releaseCount > 0); // DTI除外により作品数が0になった女優を非表示

        return actresses;
      } catch (sortError) {
        console.error('[GET ACTRESSES] Error in recent sort:', sortError);
        throw sortError;
      }
    } else {
      try {
        // 名前順
        switch (sortBy) {
          case 'nameAsc':
            orderByClause = asc(performers.name);
            break;
          case 'nameDesc':
            orderByClause = desc(performers.name);
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

        const actresses = results
          .map(performer => mapPerformerToActressTypeSync(
            performer,
            productCounts.get(performer.id) || 0,
            thumbnails.get(performer.id)
          ))
          .filter(actress => actress.metrics && actress.metrics.releaseCount > 0); // DTI除外により作品数が0になった女優を非表示

        return actresses;
      } catch (sortError) {
        console.error('[GET ACTRESSES] Error in name sort:', sortError);
        throw sortError;
      }
    }
  } catch (error) {
    // Create a simplified error for React Server Components serialization
    // Only include message, no stack or other properties
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch actresses: ${errorMessage}`);
  }
}

/**
 * バッチで複数女優の作品数を取得
 */
async function batchGetPerformerProductCounts(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, number>> {
  if (performerIds.length === 0) return new Map();

  // DTI系商品を除外
  const dtiProductIds = await excludeDTIProducts(db);

  const whereConditions = [inArray(productPerformers.performerId, performerIds)];
  if (dtiProductIds.length > 0) {
    whereConditions.push(notInArray(productPerformers.productId, dtiProductIds));
  }

  const results = await db
    .select({
      performerId: productPerformers.performerId,
      count: sql<number>`count(*)`,
    })
    .from(productPerformers)
    .where(and(...whereConditions))
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
// Force HMR update
async function batchGetPerformerThumbnails(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, string>> {
  if (performerIds.length === 0) return new Map();

  // DTI系商品を除外
  const dtiProductIds = await excludeDTIProducts(db);

  const whereConditions = [
    inArray(productPerformers.performerId, performerIds),
    sql`${products.defaultThumbnailUrl} IS NOT NULL`
  ];
  if (dtiProductIds.length > 0) {
    whereConditions.push(notInArray(products.id, dtiProductIds));
  }

  // 各女優の最新作品のサムネイルURLを取得
  const results = await db
    .select({
      performerId: productPerformers.performerId,
      thumbnailUrl: products.defaultThumbnailUrl,
    })
    .from(productPerformers)
    .innerJoin(products, eq(productPerformers.productId, products.id))
    .where(and(...whereConditions))
    .orderBy(desc(products.createdAt))
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
          inArray(productTags.productId, productIdList)
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
  excludeInitials?: boolean; // 'etc'フィルタ用: 50音・アルファベット以外
}): Promise<number> {
  try {
    const db = getDb();

    // DTI系商品を除外
    const dtiProductIds = await excludeDTIProducts(db);

    const conditions = [];

    // 'etc'フィルタ: 50音・アルファベット以外で始まる名前
    if (options?.excludeInitials) {
      conditions.push(
        sql`NOT (
          LEFT(${performers.name}, 1) ~ '^[ぁ-んァ-ヴーA-Za-z]'
        )`
      );
    }

    // 対象タグでフィルタ（いずれかを含む）
    if (options?.includeTags && options.includeTags.length > 0) {
      const tagIds = options.includeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        // DTI除外条件を追加
        const tagWhereConditions = [inArray(productTags.tagId, tagIds)];
        if (dtiProductIds.length > 0) {
          tagWhereConditions.push(notInArray(productTags.productId, dtiProductIds));
        }

        const performerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productTags)
          .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
          .where(and(...tagWhereConditions));

        if (performerIds.length > 0) {
          const performerIdValues = performerIds.map(p => p.performerId);
          conditions.push(
            inArray(performers.id, performerIdValues)
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
          .where(inArray(productTags.tagId, tagIds));

        if (excludedPerformerIds.length > 0) {
          const excludedPerformerIdValues = excludedPerformerIds.map(p => p.performerId);
          conditions.push(
            notInArray(performers.id, excludedPerformerIdValues)
          );
        }
      }
    }

    // 検索クエリ（名前を検索）- 類似性ベースのあいまい検索を使用
    // performer_aliases テーブルも検索対象に含める
    if (options?.query) {
      // 別名から一致する女優IDを取得
      // 頭文字検索（1文字）の場合は前方一致、それ以外はあいまい検索
      const isInitialSearch = options.query.length === 1;
      const searchPattern = isInitialSearch ? options.query + '%' : '%' + options.query + '%';

      const matchingPerformerIds = await db
        .selectDistinct({ performerId: performerAliases.performerId })
        .from(performerAliases)
        .where(
          or(
            sql`similarity(${performerAliases.aliasName}, ${options.query}) > 0.2`,
            sql`${performerAliases.aliasName} ILIKE ${searchPattern}`
          )!
        );

      // pg_trgmを使用した類似性検索（similarity > 0.2 の結果を返す）
      // 主名前、カナ名、または別名のいずれかに一致
      // 頭文字検索の場合、nameKanaがあればnameKanaで、なければnameで検索
      const nameConditions = isInitialSearch
        ? or(
            sql`(${performers.nameKana} IS NOT NULL AND ${performers.nameKana} ILIKE ${searchPattern})`,
            sql`(${performers.nameKana} IS NULL AND ${performers.name} ILIKE ${searchPattern})`
          )!
        : or(
            sql`similarity(${performers.name}, ${options.query}) > 0.2`,
            sql`similarity(${performers.nameKana}, ${options.query}) > 0.2`,
            sql`${performers.name} ILIKE ${searchPattern}`,
            sql`${performers.nameKana} ILIKE ${searchPattern}`
          )!;

      // 別名から一致した女優IDがあれば追加
      if (matchingPerformerIds.length > 0) {
        conditions.push(
          or(
            nameConditions,
            inArray(performers.id, matchingPerformerIds.map(p => p.performerId))
          )!
        );
      } else {
        conditions.push(nameConditions);
      }
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
 * 女優の別名を取得
 */
export async function getPerformerAliases(performerId: number): Promise<Array<{
  id: number;
  aliasName: string;
  source: string | null;
  isPrimary: boolean | null;
  createdAt: Date;
}>> {
  try {
    const db = getDb();

    const aliases = await db
      .select()
      .from(performerAliases)
      .where(eq(performerAliases.performerId, performerId))
      .orderBy(desc(performerAliases.isPrimary), asc(performerAliases.aliasName));

    return aliases;
  } catch (error) {
    console.error(`Error fetching aliases for performer ${performerId}:`, error);
    return [];
  }
}

/**
 * 女優のサイト別作品数を取得
 */
export async function getActressProductCountBySite(actressId: string): Promise<Array<{
  siteName: string;
  count: number;
}>> {
  try {
    const db = getDb();
    const performerId = parseInt(actressId);

    if (isNaN(performerId)) {
      return [];
    }

    const results = await db
      .select({
        siteName: tags.name,
        count: sql<number>`COUNT(DISTINCT ${products.id})`,
      })
      .from(products)
      .innerJoin(productPerformers, eq(products.id, productPerformers.productId))
      .innerJoin(productTags, eq(products.id, productTags.productId))
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(and(
        eq(productPerformers.performerId, performerId),
        eq(tags.category, 'site')
      ))
      .groupBy(tags.name)
      .orderBy(desc(sql<number>`COUNT(DISTINCT ${products.id})`));

    return results.map(r => ({
      siteName: r.siteName,
      count: Number(r.count),
    }));
  } catch (error) {
    console.error(`Error fetching product count by site for actress ${actressId}:`, error);
    return [];
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
 * 商品の全ASPソース情報を取得（E-E-A-T強化用）
 */
export async function getProductSources(productId: number) {
  try {
    const db = getDb();
    const sources = await db
      .select({
        aspName: productSources.aspName,
        originalProductId: productSources.originalProductId,
        price: productSources.price,
        affiliateUrl: productSources.affiliateUrl,
      })
      .from(productSources)
      .where(eq(productSources.productId, productId));

    return sources;
  } catch (error) {
    console.error(`Error fetching product sources for product ${productId}:`, error);
    return [];
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

  // サンプル画像を取得（JSONBフィールド）
  const sampleImages = cache?.sampleImages as string[] | undefined;

  // タグからカテゴリを推定（仮実装）
  const category: ProductCategory = 'premium';

  // 出演者情報（後方互換性のため最初の1人も保持）
  const actressId = performerData.length > 0 ? String(performerData[0].id) : undefined;
  const actressName = performerData.length > 0 ? performerData[0].name : undefined;

  // 全出演者情報
  const performers = performerData.map(p => ({
    id: String(p.id),
    name: p.name
  }));

  // タグ名の配列
  const tags = tagData.map(t => t.name);

  // 新作判定：リリース日が7日以内の場合
  const isNew = product.releaseDate ? (() => {
    const releaseDate = new Date(product.releaseDate);
    const now = new Date();
    const diffTime = now.getTime() - releaseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  })() : false;

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
    performers: performers.length > 0 ? performers : undefined,
    releaseDate: product.releaseDate || undefined,
    duration: product.duration || undefined,
    format: undefined,
    rating: undefined,
    reviewCount: undefined,
    tags,
    isFeatured: false,
    isNew,
    discount: undefined,
    reviewHighlight: undefined,
    ctaLabel: undefined,
    sampleImages,
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
    db.select({ thumbnailUrl: products.defaultThumbnailUrl })
      .from(productPerformers)
      .innerJoin(products, eq(productPerformers.productId, products.id))
      .where(
        and(
          eq(productPerformers.performerId, performer.id),
          sql`${products.defaultThumbnailUrl} IS NOT NULL`
        )
      )
      .orderBy(desc(products.createdAt))
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

/**
 * 新作が出た女優を取得（最近リリースされた商品に出演している女優）
 */
export async function getActressesWithNewReleases(options: {
  limit?: number;
  daysAgo?: number; // 何日前までの新作を対象とするか（デフォルト: 30日）
} = {}) {
  const { limit = 20, daysAgo = 30 } = options;

  try {
    const db = getDb();

    // 指定期間内にリリースされた商品を取得し、その出演者をユニークに取得
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - daysAgo);

    // Use raw SQL query to avoid Drizzle ORM issues with aggregation
    const result = await db.execute<{
      id: number;
      name: string;
      name_kana: string | null;
      latest_release_date: string;
      product_count: string;
    }>(sql`
      SELECT
        p.id,
        p.name,
        p.name_kana,
        MAX(pr.release_date)::text as latest_release_date,
        COUNT(DISTINCT pr.id)::text as product_count
      FROM performers p
      INNER JOIN product_performers pp ON p.id = pp.performer_id
      INNER JOIN products pr ON pp.product_id = pr.id
      WHERE pr.release_date >= ${recentDate.toISOString()}
      GROUP BY p.id, p.name, p.name_kana
      ORDER BY MAX(pr.release_date) DESC
      LIMIT ${limit}
    `);

    // Check if result.rows exists and is an array
    if (!result || !result.rows || !Array.isArray(result.rows)) {
      console.warn('getActressesWithNewReleases: No rows returned from query');
      return [];
    }

    // ActressType形式に変換（getActressByIdで画像など取得）
    const actressesWithDetails = await Promise.all(
      result.rows.map(async (actress) => {
        const fullActress = await getActressById(actress.id.toString());
        return fullActress || {
          id: actress.id.toString(),
          name: actress.name,
          catchcopy: '',
          description: '',
          heroImage: '',
          thumbnail: '',
          primaryGenres: [],
          services: [],
          metrics: {
            releaseCount: parseInt(actress.product_count, 10),
            trendingScore: 0,
            fanScore: 0,
          },
          highlightWorks: [],
          tags: [],
        } as ActressType;
      })
    );

    return actressesWithDetails;
  } catch (error) {
    console.error('Error getting actresses with new releases:', error);
    throw error;
  }
}

/**
 * 人気タグ(作品数が多いタグ)を取得
 */
export async function getPopularTags(options: {
  category?: string;
  limit?: number;
} = {}): Promise<Array<{ id: number; name: string; category: string | null; count: number }>> {
  try {
    const { category, limit = 20 } = options;
    const db = getDb();

    // タグとその作品数を取得
    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
        count: sql<number>`CAST(COUNT(DISTINCT ${productTags.productId}) AS INTEGER)`,
      })
      .from(tags)
      .leftJoin(productTags, eq(tags.id, productTags.tagId))
      .where(category ? eq(tags.category, category) : undefined)
      .groupBy(tags.id, tags.name, tags.category)
      .orderBy(desc(sql`COUNT(DISTINCT ${productTags.productId})`))
      .limit(limit);

    return result;
  } catch (error) {
    console.error('Error getting popular tags:', error);
    throw error;
  }
}

