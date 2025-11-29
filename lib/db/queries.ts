import { getDb } from './index';
import { products, performers, productPerformers, tags, productTags, productSources, performerAliases, productImages, productVideos } from './schema';
import { eq, and, or, like, desc, asc, gte, lte, sql, inArray, notInArray } from 'drizzle-orm';
import type { Product as ProductType, Actress as ActressType, ProductCategory, ProviderId } from '@/types/product';
import type { InferSelectModel } from 'drizzle-orm';
import { mapLegacyProvider, mapLegacyServices } from '@/lib/provider-utils';

type DbProduct = InferSelectModel<typeof products>;
type DbPerformer = InferSelectModel<typeof performers>;

/**
 * 無効な演者データをフィルタリングするヘルパー関数
 * クローリング時のパース エラーにより生成された無効なデータを除外
 */
function isValidPerformer(performer: { name: string }): boolean {
  const name = performer.name;

  // 1文字だけの名前は無効（例: 'デ', 'ラ', 'J', 'K'）
  if (name.length <= 1) return false;

  // 矢印記号を含む名前は無効（例: 'ゆ→な'）
  if (name.includes('→')) return false;

  // 特定の無効な名前
  const invalidNames = ['デ', 'ラ', 'ゆ', 'な', '他'];
  if (invalidNames.includes(name)) return false;

  return true;
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
 * 商品の関連データ（出演者、タグ、ソース、画像、動画）を並列取得するヘルパー関数
 */
async function fetchProductRelatedData(db: ReturnType<typeof getDb>, productId: number) {
  const [performerData, tagData, sourceData, imagesData, videosData] = await Promise.all([
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

    // サンプル画像を取得
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.displayOrder)),

    // サンプル動画を取得
    db
      .select()
      .from(productVideos)
      .where(eq(productVideos.productId, productId)),
  ]);

  return {
    performerData: performerData.filter(isValidPerformer),
    tagData,
    sourceData: sourceData[0],
    imagesData,
    videosData,
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
    const { performerData, tagData, sourceData, imagesData, videosData } = await fetchProductRelatedData(db, product.id);

    return mapProductToType(product, performerData, tagData, sourceData, undefined, imagesData, videosData);
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
      const { performerData, tagData, sourceData, imagesData, videosData } = await fetchProductRelatedData(db, product.id);

      return mapProductToType(product, performerData, tagData, sourceData, undefined, imagesData, videosData);
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

    // 関連データを並列で取得（sourceは既に取得済みなので、出演者、タグ、画像、動画）
    const [performerData, tagData, imagesData, videosData] = await Promise.all([
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

      // サンプル画像を取得
      db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, productData.id))
        .orderBy(asc(productImages.displayOrder)),

      // サンプル動画を取得
      db
        .select()
        .from(productVideos)
        .where(eq(productVideos.productId, productData.id)),
    ]);

    return mapProductToType(productData, performerData.filter(isValidPerformer), tagData, source, undefined, imagesData, videosData);
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

      // EXISTSを使用（IN配列を避ける）
      if (aspNames.length === 1) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${productSources} ps
            WHERE ps.product_id = ${products.id}
            AND ps.asp_name = ${aspNames[0]}
          )`
        );
      } else {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${productSources} ps
            WHERE ps.product_id = ${products.id}
            AND ps.asp_name IN (${sql.join(aspNames.map(name => sql`${name}`), sql`, `)})
          )`
        );
      }
    }

    // 価格フィルタ（productSourcesの価格を使用）
    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      const priceConditions = [];
      if (options.minPrice !== undefined) {
        priceConditions.push(sql`ps.price >= ${options.minPrice}`);
      }
      if (options.maxPrice !== undefined) {
        priceConditions.push(sql`ps.price <= ${options.maxPrice}`);
      }

      // EXISTSを使用
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${productSources} ps
          WHERE ps.product_id = ${products.id}
          AND ${sql.join(priceConditions, sql` AND `)}
        )`
      );
    }

    // 女優IDでフィルタ（多対多リレーション）
    if (options?.actressId) {
      const performerId = parseInt(options.actressId);
      if (!isNaN(performerId)) {
        // EXISTSを使用
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${productPerformers} pp
            WHERE pp.product_id = ${products.id}
            AND pp.performer_id = ${performerId}
          )`
        );
      }
    }

    // タグでフィルタ（対象タグ - いずれかを含む）
    if (options?.tags && options.tags.length > 0) {
      const tagIds = options.tags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        // EXISTSを使用
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${productTags} pt
            WHERE pt.product_id = ${products.id}
            AND pt.tag_id IN (${sql.join(tagIds.map(id => sql`${id}`), sql`, `)})
          )`
        );
      }
    }

    // 除外タグでフィルタ（いずれも含まない）
    if (options?.excludeTags && options.excludeTags.length > 0) {
      const excludeTagIds = options.excludeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (excludeTagIds.length > 0) {
        // NOT EXISTSを使用
        conditions.push(
          sql`NOT EXISTS (
            SELECT 1 FROM ${productTags} pt
            WHERE pt.product_id = ${products.id}
            AND pt.tag_id IN (${sql.join(excludeTagIds.map(id => sql`${id}`), sql`, `)})
          )`
        );
      }
    }

    // 検索クエリ（PostgreSQL Full Text Search使用）
    // search_vectorを使用した高速全文検索（GINインデックス使用）
    if (options?.query) {
      // Full Text Searchを使用（plainto_tsqueryで自動的にトークン化）
      conditions.push(
        sql`${products}.search_vector @@ plainto_tsquery('simple', ${options.query})`
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

      const [allPerformers, allTags, allSources, allImages] = await Promise.all([
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
        // サムネイルがない商品用に画像を取得
        db
          .select({
            productId: productImages.productId,
            imageUrl: productImages.imageUrl,
            imageType: productImages.imageType,
            displayOrder: productImages.displayOrder,
          })
          .from(productImages)
          .where(inArray(productImages.productId, productIds))
          .orderBy(asc(productImages.displayOrder)),
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

      const imagesMap = new Map<number, typeof allImages>();
      for (const img of allImages) {
        if (!imagesMap.has(img.productId)) imagesMap.set(img.productId, []);
        imagesMap.get(img.productId)!.push(img);
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
        const imagesData = imagesMap.get(product.id);
        return mapProductToType(product, performerData, tagData, sourcesMap.get(product.id), undefined, imagesData);
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

    const [allPerformers, allTags, allSources, allImages] = await Promise.all([
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
      // サムネイルがない商品用に画像を取得
      db
        .select({
          productId: productImages.productId,
          imageUrl: productImages.imageUrl,
          imageType: productImages.imageType,
          displayOrder: productImages.displayOrder,
        })
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.displayOrder)),
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

    const imagesMap = new Map<number, typeof allImages>();
    for (const img of allImages) {
      if (!imagesMap.has(img.productId)) imagesMap.set(img.productId, []);
      imagesMap.get(img.productId)!.push(img);
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
      const imagesData = imagesMap.get(product.id);
      return mapProductToType(product, performerData, tagData, sourcesMap.get(product.id), undefined, imagesData);
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
  includeAsps?: string[]; // ASPでフィルタ（いずれかを含む）
  excludeAsps?: string[]; // ASPで除外（いずれも含まない）
}): Promise<ActressType[]> {
  try {
    const db = getDb();

    const conditions = [];

    // 作品と紐付いている女優のみ表示（出演数0の女優を除外）
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${productPerformers} WHERE ${productPerformers.performerId} = ${performers.id})`
    );

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
          // このタグのいずれかを持つ商品に出演している女優IDを取得
          const performerIds = await db
            .selectDistinct({ performerId: productPerformers.performerId })
            .from(productTags)
            .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
            .where(inArray(productTags.tagId, tagIds));

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

    // ASPフィルタ（いずれかを含む）
    if (options?.includeAsps && options.includeAsps.length > 0) {
      try {
        // このASPのいずれかを持つ商品に出演している女優IDを取得
        const performerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productSources)
          .innerJoin(productPerformers, eq(productSources.productId, productPerformers.productId))
          .where(inArray(productSources.aspName, options.includeAsps));

        if (performerIds.length > 0) {
          const performerIdValues = performerIds.map(p => p.performerId);
          conditions.push(
            inArray(performers.id, performerIdValues)
          );
        } else {
          // 該当女優なし
          return [];
        }
      } catch (includeAspsError) {
        console.error('[GET ACTRESSES] Error in includeAsps processing:', includeAspsError);
        throw includeAspsError;
      }
    }

    // ASP除外フィルタ（いずれも含まない）
    if (options?.excludeAsps && options.excludeAsps.length > 0) {
      try {
        // この除外ASPのいずれかを持つ商品に出演している女優IDを取得
        const excludedPerformerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productSources)
          .innerJoin(productPerformers, eq(productSources.productId, productPerformers.productId))
          .where(inArray(productSources.aspName, options.excludeAsps));

        if (excludedPerformerIds.length > 0) {
          const excludedPerformerIdValues = excludedPerformerIds.map(p => p.performerId);
          conditions.push(
            notInArray(performers.id, excludedPerformerIdValues)
          );
        }
      } catch (excludeAspsError) {
        console.error('[GET ACTRESSES] Error in excludeAsps processing:', excludeAspsError);
        throw excludeAspsError;
      }
    }

    // 検索クエリ（名前を検索）
    // performer_aliases テーブルも検索対象に含める
    if (options?.query) {
      try {
        // 別名から一致する女優IDを取得
        // 頭文字検索（1文字）の場合は前方一致、2文字以上のヘッダー検索は中間一致
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
        // 作品数順の場合は、LEFT JOINして作品数でソート
        // 同じ作品数の場合はperformer.idでソートして順序を安定させる
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
              : asc(sql`COALESCE(COUNT(${productPerformers.productId}), 0)`),
            desc(performers.id)
          )
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);

        // バッチで作品数、サムネイル、ASPサービスを取得
        const performerIds = results.map(r => r.performer.id);
        const [productCounts, thumbnails, servicesMap] = await Promise.all([
          batchGetPerformerProductCounts(db, performerIds),
          batchGetPerformerThumbnails(db, performerIds),
          batchGetPerformerServices(db, performerIds),
        ]);

        const actresses = results
          .map(r => mapPerformerToActressTypeSync(
            r.performer,
            productCounts.get(r.performer.id) || 0,
            thumbnails.get(r.performer.id),
            servicesMap.get(r.performer.id)
          ));

        return actresses;
      } catch (sortError) {
        console.error('[GET ACTRESSES] Error in product count sort:', sortError);
        throw sortError;
      }
    } else if (sortBy === 'recent') {
      try {
        // 新着順の場合は、作品のリリース日でソート（最新の作品が出ている女優を先に表示）
        // release_dateがNULLの場合は最低優先順位（NULLS LAST）
        // 同じ日付の場合はperformer.idでソートして順序を安定させる
        const results = await db
          .select({
            performer: performers,
            latestDate: sql<Date>`MAX(${products.releaseDate})`,
          })
          .from(performers)
          .leftJoin(productPerformers, eq(performers.id, productPerformers.performerId))
          .leftJoin(products, eq(productPerformers.productId, products.id))
          .where(whereClause)
          .groupBy(performers.id)
          .orderBy(sql`MAX(${products.releaseDate}) DESC NULLS LAST`, desc(performers.id))
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);

        // バッチで作品数、サムネイル、ASPサービスを取得
        const performerIds = results.map(r => r.performer.id);
        const [productCounts, thumbnails, servicesMap] = await Promise.all([
          batchGetPerformerProductCounts(db, performerIds),
          batchGetPerformerThumbnails(db, performerIds),
          batchGetPerformerServices(db, performerIds),
        ]);

        const actresses = results
          .map(r => mapPerformerToActressTypeSync(
            r.performer,
            productCounts.get(r.performer.id) || 0,
            thumbnails.get(r.performer.id),
            servicesMap.get(r.performer.id)
          ));

        return actresses;
      } catch (sortError) {
        console.error('[GET ACTRESSES] Error in recent sort:', sortError);
        throw sortError;
      }
    } else {
      try {
        // 名前順
        // 同じ名前の場合はperformer.idでソートして順序を安定させる
        let orderByClauses;
        switch (sortBy) {
          case 'nameAsc':
            orderByClauses = [asc(performers.name), asc(performers.id)];
            break;
          case 'nameDesc':
            orderByClauses = [desc(performers.name), desc(performers.id)];
            break;
          default:
            orderByClauses = [asc(performers.name), asc(performers.id)];
        }

        const results = await db
          .select()
          .from(performers)
          .where(whereClause)
          .orderBy(...orderByClauses)
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);

        // バッチで作品数、サムネイル、ASPサービスを取得
        const performerIds = results.map(p => p.id);
        const [productCounts, thumbnails, servicesMap] = await Promise.all([
          batchGetPerformerProductCounts(db, performerIds),
          batchGetPerformerThumbnails(db, performerIds),
          batchGetPerformerServices(db, performerIds),
        ]);

        const actresses = results
          .map(performer => mapPerformerToActressTypeSync(
            performer,
            productCounts.get(performer.id) || 0,
            thumbnails.get(performer.id),
            servicesMap.get(performer.id)
          ));

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

  const results = await db
    .select({
      performerId: productPerformers.performerId,
      count: sql<number>`count(*)`,
    })
    .from(productPerformers)
    .where(inArray(productPerformers.performerId, performerIds))
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

  // 各女優の最新作品のサムネイルURLを取得
  const results = await db
    .select({
      performerId: productPerformers.performerId,
      thumbnailUrl: products.defaultThumbnailUrl,
    })
    .from(productPerformers)
    .innerJoin(products, eq(productPerformers.productId, products.id))
    .where(and(
      inArray(productPerformers.performerId, performerIds),
      sql`${products.defaultThumbnailUrl} IS NOT NULL`
    ))
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
 * バッチで複数女優のASPサービス一覧を取得
 */
async function batchGetPerformerServices(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, string[]>> {
  if (performerIds.length === 0) return new Map();

  const results = await db
    .selectDistinct({
      performerId: productPerformers.performerId,
      aspName: productSources.aspName,
    })
    .from(productPerformers)
    .innerJoin(productSources, eq(productPerformers.productId, productSources.productId))
    .where(inArray(productPerformers.performerId, performerIds));

  const map = new Map<number, string[]>();
  for (const r of results) {
    if (!r.aspName) continue;
    const services = map.get(r.performerId) || [];
    if (!services.includes(r.aspName)) {
      services.push(r.aspName);
      map.set(r.performerId, services);
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
  includeAsps?: string[];
  excludeAsps?: string[];
}): Promise<number> {
  try {
    const db = getDb();

    const conditions = [];

    // 作品と紐付いている女優のみカウント（出演数0の女優を除外）
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${productPerformers} WHERE ${productPerformers.performerId} = ${performers.id})`
    );

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
        const performerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productTags)
          .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
          .where(inArray(productTags.tagId, tagIds));

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

    // ASPフィルタ（いずれかを含む）
    if (options?.includeAsps && options.includeAsps.length > 0) {
      const performerIds = await db
        .selectDistinct({ performerId: productPerformers.performerId })
        .from(productSources)
        .innerJoin(productPerformers, eq(productSources.productId, productPerformers.productId))
        .where(inArray(productSources.aspName, options.includeAsps));

      if (performerIds.length > 0) {
        const performerIdValues = performerIds.map(p => p.performerId);
        conditions.push(
          inArray(performers.id, performerIdValues)
        );
      } else {
        return 0;
      }
    }

    // ASP除外フィルタ（いずれも含まない）
    if (options?.excludeAsps && options.excludeAsps.length > 0) {
      const excludedPerformerIds = await db
        .selectDistinct({ performerId: productPerformers.performerId })
        .from(productSources)
        .innerJoin(productPerformers, eq(productSources.productId, productPerformers.productId))
        .where(inArray(productSources.aspName, options.excludeAsps));

      if (excludedPerformerIds.length > 0) {
        const excludedPerformerIdValues = excludedPerformerIds.map(p => p.performerId);
        conditions.push(
          notInArray(performers.id, excludedPerformerIdValues)
        );
      }
    }

    // 検索クエリ（名前を検索）
    // performer_aliases テーブルも検索対象に含める
    if (options?.query) {
      // 別名から一致する女優IDを取得
      // 頭文字検索（1文字）の場合は前方一致、2文字以上のヘッダー検索は中間一致
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

    // すべての女優をカウント（商品紐付き必須を外す）
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
 * 女優のASP別作品数を取得（product_sourcesベース）
 */
export async function getActressProductCountByAsp(actressId: string): Promise<Array<{
  aspName: string;
  count: number;
}>> {
  try {
    const db = getDb();
    const performerId = parseInt(actressId);

    if (isNaN(performerId)) {
      return [];
    }

    const whereConditions = [
      eq(productPerformers.performerId, performerId),
      sql`${productSources.aspName} IS NOT NULL`,
    ];

    const results = await db
      .select({
        aspName: productSources.aspName,
        count: sql<number>`COUNT(DISTINCT ${productPerformers.productId})`,
      })
      .from(productPerformers)
      .innerJoin(productSources, eq(productPerformers.productId, productSources.productId))
      .where(and(...whereConditions))
      .groupBy(productSources.aspName)
      .orderBy(desc(sql<number>`COUNT(DISTINCT ${productPerformers.productId})`));

    return results
      .filter(r => r.aspName !== null)
      .map(r => ({
        aspName: r.aspName!,
        count: Number(r.count),
      }));
  } catch (error) {
    console.error(`Error fetching product count by ASP for actress ${actressId}:`, error);
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
  cache?: any,
  imagesData?: Array<{ imageUrl: string; imageType: string; displayOrder: number | null }>,
  videosData?: Array<{ videoUrl: string; videoType: string; quality: string | null; duration: number | null }>
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
    'MGS': 'MGS動画',
    'SOKMIL': 'ソクミル',
    'ソクミル': 'ソクミル',
    'B10F': 'b10f.jp',
    'JAPANSKA': 'Japanska',
    'FC2': 'FC2',
  };
  const providerLabel = providerLabelMap[aspName.toUpperCase()] || aspName;

  // キャッシュから価格・画像情報を取得
  const price = cache?.price || source?.price || 0;

  // サムネイル画像を取得（product.defaultThumbnailUrl → imagesDataのthumbnail → imagesDataの最初の画像）
  let imageUrl = cache?.thumbnailUrl || product.defaultThumbnailUrl;
  if (!imageUrl && imagesData && imagesData.length > 0) {
    // thumbnailタイプの画像を優先、なければ最初の画像
    const thumbnailImg = imagesData.find(img => img.imageType === 'thumbnail');
    imageUrl = thumbnailImg?.imageUrl || imagesData[0].imageUrl;
  }
  if (!imageUrl) {
    imageUrl = 'https://placehold.co/600x800/1f2937/ffffff?text=NO+IMAGE';
  }

  const affiliateUrl = source?.affiliateUrl || cache?.affiliateUrl || '';

  // サンプル画像を取得（product_imagesテーブルまたはcache）
  const sampleImages = imagesData && imagesData.length > 0
    ? imagesData.map(img => img.imageUrl)
    : (cache?.sampleImages as string[] | undefined);

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

  // サンプル動画を整形
  const sampleVideos = videosData && videosData.length > 0
    ? videosData.map(video => ({
        url: video.videoUrl,
        type: video.videoType,
        quality: video.quality || undefined,
        duration: video.duration || undefined,
      }))
    : undefined;

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
    sampleVideos,
  };
}

const ACTRESS_PLACEHOLDER = 'https://placehold.co/400x520/1f2937/ffffff?text=NO+IMAGE';

/**
 * データベースの出演者(performer)をActress型に変換（同期版）
 */
function mapPerformerToActressTypeSync(performer: DbPerformer, releaseCount: number, thumbnailUrl?: string, services?: string[]): ActressType {
  const imageUrl = thumbnailUrl || ACTRESS_PLACEHOLDER;
  // ASP名をProviderId型に変換
  const aspToProviderId: Record<string, ProviderId> = {
    'DUGA': 'duga',
    'duga': 'duga',
    'Sokmil': 'sokmil',
    'sokmil': 'sokmil',
    'MGS': 'mgs',
    'mgs': 'mgs',
    'b10f': 'b10f',
    'B10F': 'b10f',
    'FC2': 'fc2',
    'fc2': 'fc2',
    'Japanska': 'japanska',
    'japanska': 'japanska',
  };
  const providerIds = (services || [])
    .map(s => aspToProviderId[s])
    .filter((p): p is ProviderId => p !== undefined);

  return {
    id: String(performer.id),
    name: performer.name,
    catchcopy: '',
    description: '',
    heroImage: imageUrl,
    thumbnail: imageUrl,
    primaryGenres: ['premium'],
    services: providerIds,
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

  // 作品数、サムネイル、ASPサービスを並列取得
  const [productCountResult, thumbnailResult, servicesResult] = await Promise.all([
    // 作品数
    db.select({ count: sql<number>`count(*)` })
      .from(productPerformers)
      .where(eq(productPerformers.performerId, performer.id)),
    // サムネイル（最新作品から取得）
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
    // ASPサービス一覧
    db.selectDistinct({ aspName: productSources.aspName })
      .from(productPerformers)
      .innerJoin(productSources, eq(productPerformers.productId, productSources.productId))
      .where(eq(productPerformers.performerId, performer.id)),
  ]);

  const releaseCount = productCountResult[0]?.count || 0;
  const thumbnailUrl = thumbnailResult[0]?.thumbnailUrl;
  const services = servicesResult
    .map(r => r.aspName)
    .filter((s): s is string => s !== null);

  return mapPerformerToActressTypeSync(performer, Number(releaseCount), thumbnailUrl ?? undefined, services);
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
    // release_dateはtext型（YYYY-MM-DD形式）なので、同じ形式で比較
    const recentDateStr = recentDate.toISOString().split('T')[0];

    // Use raw SQL query to avoid Drizzle ORM issues with aggregation
    // release_dateはDATE型なので、::dateでキャストして比較
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
      WHERE pr.release_date >= ${recentDateStr}::date
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

/**
 * 最新の商品を取得（RSS用）
 */
export async function getRecentProducts(options?: {
  limit?: number;
}): Promise<ProductType[]> {
  try {
    const db = getDb();
    const limit = options?.limit || 100;

    // 最新の商品を取得
    const results = await db
      .select()
      .from(products)
      .orderBy(desc(products.releaseDate), desc(products.createdAt))
      .limit(limit);

    // 関連データを並列で取得
    const productsWithData = await Promise.all(
      results.map(async (product) => {
        const { performerData, tagData, sourceData } = await fetchProductRelatedData(db, product.id);

        return {
          id: product.id,
          title: product.title,
          thumbnailUrl: product.defaultThumbnailUrl || null,
          releaseDate: product.releaseDate,
          duration: product.duration,
          provider: sourceData?.aspName || null,
          performers: performerData.map(p => ({
            id: p.id,
            name: p.name,
          })),
        } as ProductType;
      })
    );

    return productsWithData;
  } catch (error) {
    console.error('Error getting recent products:', error);
    throw error;
  }
}

/**
 * 出演者なし作品（未整理作品）を取得
 */
export async function getUncategorizedProducts(options?: {
  limit?: number;
  offset?: number;
}): Promise<ProductType[]> {
  try {
    const db = getDb();
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // 出演者がいない商品を取得
    const query = sql`
      SELECT p.*
      FROM products p
      WHERE NOT EXISTS (
        SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id
      )
      ORDER BY p.release_date DESC NULLS LAST, p.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const results = await db.execute(query);

    // 関連データを並列で取得
    const productsWithData = await Promise.all(
      (results.rows as any[]).map(async (product) => {
        const { tagData, sourceData, imagesData, videosData } = await fetchProductRelatedData(db, product.id);

        return {
          id: String(product.id),
          title: product.title || '',
          description: product.description || '',
          normalizedProductId: product.normalized_product_id,
          imageUrl: product.default_thumbnail_url || '',
          releaseDate: product.release_date,
          duration: product.duration,
          price: product.price || 0,
          category: 'all' as const,
          affiliateUrl: sourceData?.affiliateUrl || '',
          provider: (sourceData?.aspName?.toLowerCase() || 'duga') as any,
          providerLabel: sourceData?.aspName || '',
          performers: [],
          tags: tagData.map(t => t.name),
          sampleImages: imagesData.map(img => img.imageUrl),
          sampleVideos: videosData.map(v => ({
            url: v.videoUrl,
            type: v.videoType || 'streaming',
            quality: v.quality || undefined,
            duration: v.duration || undefined,
          })),
        } as ProductType;
      })
    );

    return productsWithData;
  } catch (error) {
    console.error('Error getting uncategorized products:', error);
    throw error;
  }
}

/**
 * 出演者なし作品（未整理作品）の数を取得
 */
export async function getUncategorizedProductsCount(): Promise<number> {
  try {
    const db = getDb();

    const query = sql`
      SELECT COUNT(*) as count
      FROM products p
      WHERE NOT EXISTS (
        SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id
      )
    `;

    const result = await db.execute(query);
    return Number((result.rows[0] as any).count);
  } catch (error) {
    console.error('Error getting uncategorized products count:', error);
    throw error;
  }
}

/**
 * マルチASP女優を取得（複数のサイトに出演している女優）
 * コンセプト: アフィリエイトサイトを横断して作品を探す
 */
export async function getMultiAspActresses(options: {
  limit?: number;
  minAspCount?: number; // 最低何サイト以上に出演しているか
} = {}): Promise<ActressType[]> {
  const { limit = 20, minAspCount = 2 } = options;

  try {
    const db = getDb();

    // 複数ASPに商品がある女優を取得
    const result = await db.execute<{
      performer_id: number;
      asp_count: string;
      total_products: string;
    }>(sql`
      WITH performer_asp_stats AS (
        SELECT
          pp.performer_id,
          COUNT(DISTINCT ps.asp_name) as asp_count,
          COUNT(DISTINCT pp.product_id) as total_products
        FROM product_performers pp
        INNER JOIN product_sources ps ON pp.product_id = ps.product_id
        WHERE ps.asp_name IS NOT NULL
          AND ps.asp_name != 'DTI'
        GROUP BY pp.performer_id
        HAVING COUNT(DISTINCT ps.asp_name) >= ${minAspCount}
      )
      SELECT performer_id, asp_count, total_products
      FROM performer_asp_stats
      ORDER BY asp_count DESC, total_products DESC
      LIMIT ${limit}
    `);

    if (!result.rows || result.rows.length === 0) {
      return [];
    }

    // ActressType形式に変換
    const actresses = await Promise.all(
      result.rows.map(async (row) => {
        const fullActress = await getActressById(row.performer_id.toString());
        return fullActress;
      })
    );

    return actresses.filter((a): a is ActressType => a !== null);
  } catch (error) {
    console.error('Error getting multi-ASP actresses:', error);
    return [];
  }
}

/**
 * ASP別人気女優を取得
 */
export async function getActressesByAsp(options: {
  aspName: string;
  limit?: number;
} = { aspName: 'DUGA' }): Promise<ActressType[]> {
  const { aspName, limit = 10 } = options;

  try {
    const db = getDb();

    // 指定ASPで作品数が多い女優を取得
    const result = await db.execute<{
      performer_id: number;
      product_count: string;
    }>(sql`
      SELECT
        pp.performer_id,
        COUNT(DISTINCT pp.product_id) as product_count
      FROM product_performers pp
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      WHERE ps.asp_name = ${aspName}
      GROUP BY pp.performer_id
      ORDER BY COUNT(DISTINCT pp.product_id) DESC
      LIMIT ${limit}
    `);

    if (!result.rows || result.rows.length === 0) {
      return [];
    }

    // ActressType形式に変換
    const actresses = await Promise.all(
      result.rows.map(async (row) => {
        const fullActress = await getActressById(row.performer_id.toString());
        return fullActress;
      })
    );

    return actresses.filter((a): a is ActressType => a !== null);
  } catch (error) {
    console.error(`Error getting actresses for ASP ${aspName}:`, error);
    return [];
  }
}

/**
 * プロバイダー（ASP）別商品数を取得（フィルター表示用）
 * providerMeta のIDをキーとした件数を返す
 */
export async function getProviderProductCounts(): Promise<Record<string, number>> {
  try {
    const db = getDb();

    const result = await db.execute<{
      asp_name: string;
      count: string;
    }>(sql`
      SELECT
        ps.asp_name,
        COUNT(DISTINCT ps.product_id) as count
      FROM product_sources ps
      WHERE ps.asp_name IS NOT NULL
      GROUP BY ps.asp_name
    `);

    if (!result.rows) return {};

    // ASP名からproviderIdへのマッピング
    const aspToProviderId: Record<string, string> = {
      'DUGA': 'duga',
      'APEX': 'duga',
      'DTI': 'dti',
      'DMM': 'dmm',
      'MGS': 'mgs',
      'SOKMIL': 'sokmil',
      'Sokmil': 'sokmil',
      'B10F': 'b10f',
      'b10f': 'b10f',
      'FC2': 'fc2',
      'Japanska': 'japanska',
      'JAPANSKA': 'japanska',
    };

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      const providerId = aspToProviderId[row.asp_name];
      if (providerId) {
        // 同じproviderIdに対して複数のASP名がある場合は合算
        counts[providerId] = (counts[providerId] || 0) + parseInt(row.count, 10);
      }
    }

    return counts;
  } catch (error) {
    console.error('Error getting provider product counts:', error);
    return {};
  }
}

/**
 * ASP別商品数統計を取得
 * DTIも含めて全ASPの統計を返す（UIレベルでフィルタリング可能）
 */
export async function getAspStats(): Promise<Array<{ aspName: string; productCount: number; actressCount: number }>> {
  try {
    const db = getDb();

    const result = await db.execute<{
      asp_name: string;
      product_count: string;
      actress_count: string;
    }>(sql`
      SELECT
        ps.asp_name,
        COUNT(DISTINCT ps.product_id) as product_count,
        COUNT(DISTINCT pp.performer_id) as actress_count
      FROM product_sources ps
      LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
      WHERE ps.asp_name IS NOT NULL
      GROUP BY ps.asp_name
      ORDER BY COUNT(DISTINCT ps.product_id) DESC
    `);

    if (!result.rows) return [];

    return result.rows.map(row => ({
      aspName: row.asp_name,
      productCount: parseInt(row.product_count, 10),
      actressCount: parseInt(row.actress_count, 10),
    }));
  } catch (error) {
    console.error('Error getting ASP stats:', error);
    return [];
  }
}

