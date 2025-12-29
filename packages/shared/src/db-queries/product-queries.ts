/**
 * 共有商品DBクエリ
 * 依存性注入パターンでDBとスキーマを外部から受け取る
 */
import { eq, and, sql, inArray, desc, asc, SQL } from 'drizzle-orm';

// ============================================================
// Types
// ============================================================

// Note: DI型でanyを使用するのは意図的 - Drizzle ORMの具象型はアプリ固有のため
export interface ProductQueryDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productPerformers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tags: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productTags: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSources: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productImages: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productVideos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSales: any;
  /** Site mode ('all' = exclude FANZA, 'fanza-only' = include all) */
  siteMode?: 'all' | 'fanza-only';
  /** Function to map DB product to ProductType */
  mapProductToType: (
    product: unknown,
    performers: unknown[],
    tags: unknown[],
    source: unknown,
    cache: unknown,
    images: unknown[],
    videos: unknown[],
    locale: string,
    saleData?: {
      regularPrice: number;
      salePrice: number;
      discountPercent: number | null;
      endAt: Date | null;
    }
  ) => unknown;
  /** Function to fetch product related data (productId only) */
  fetchProductRelatedData: (
    productId: number
  ) => Promise<{
    performerData: unknown[];
    tagData: unknown[];
    sourceData: unknown;
    imagesData: unknown[];
    videosData: unknown[];
    saleData?: {
      regularPrice: number;
      salePrice: number;
      discountPercent: number | null;
      endAt: Date | null;
    };
  }>;
  /** Function to validate performer */
  isValidPerformer: (performer: { name: string }) => boolean;
  /** Function to generate product ID variations */
  generateProductIdVariations: (id: string) => string[];
}

export interface ProductSourceResult {
  id: number;
  productId: number;
  aspName: string;
  originalProductId: string | null;
  affiliateUrl: string | null;
  price: number | null;
  currency: string | null;
  productType: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ProductSourceWithSaleResult extends ProductSourceResult {
  salePrice: number | null;
  regularPrice: number | null;
  discountPercent: number | null;
  saleEndAt: Date | null;
  saleName: string | null;
}

// ============================================================
// Factory
// ============================================================

/**
 * 商品クエリファクトリー
 */
export function createProductQueries(deps: ProductQueryDeps) {
  const {
    getDb,
    products,
    performers,
    productPerformers,
    tags,
    productTags,
    productSources,
    productImages,
    productVideos,
    productSales,
    siteMode = 'fanza-only',
    mapProductToType,
    fetchProductRelatedData,
    isValidPerformer,
    generateProductIdVariations,
  } = deps;

  // siteMode 'all' = exclude FANZA (for adult-v site)
  // siteMode 'fanza-only' = include all (for fanza site)
  const excludeFanza = siteMode === 'all';

  /**
   * 商品IDで商品を取得
   */
  async function getProductById<T>(id: string, locale: string = 'ja'): Promise<T | null> {
    try {
      const db = getDb();

      const result = await db
        .select()
        .from(products)
        .where(eq(products.id, parseInt(id)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const product = result[0];
      const { performerData, tagData, sourceData, imagesData, videosData, saleData } =
        await fetchProductRelatedData(product.id);

      return mapProductToType(
        product,
        performerData,
        tagData,
        sourceData,
        undefined,
        imagesData,
        videosData,
        locale,
        saleData
      ) as T;
    } catch (error) {
      console.error(`Error fetching product ${id}:`, error);
      throw error;
    }
  }

  /**
   * 品番で商品を検索（バリエーション対応）
   */
  async function searchProductByProductId<T>(
    productId: string,
    locale: string = 'ja'
  ): Promise<T | null> {
    try {
      const db = getDb();
      const variants = generateProductIdVariations(productId);

      // まずnormalizedProductIdで検索
      const productByNormalizedId = await db
        .select()
        .from(products)
        .where(inArray(products.normalizedProductId, variants))
        .limit(1);

      if (productByNormalizedId.length > 0) {
        const product = productByNormalizedId[0];
        const { performerData, tagData, sourceData, imagesData, videosData, saleData } =
          await fetchProductRelatedData(product.id);

        return mapProductToType(
          product,
          performerData,
          tagData,
          sourceData,
          undefined,
          imagesData,
          videosData,
          locale,
          saleData
        ) as T;
      }

      // originalProductIdで検索
      const sourceByOriginalId = await db
        .select()
        .from(productSources)
        .where(inArray(productSources.originalProductId, variants))
        .limit(1);

      if (sourceByOriginalId.length === 0) {
        return null;
      }

      const source = sourceByOriginalId[0];
      const product = await db
        .select()
        .from(products)
        .where(eq(products.id, source.productId))
        .limit(1);

      if (product.length === 0) {
        return null;
      }

      const productData = product[0];

      const [performerData, tagData, imagesData, videosData, saleDataResult] = await Promise.all([
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
        db
          .select()
          .from(productImages)
          .where(eq(productImages.productId, productData.id))
          .orderBy(asc(productImages.displayOrder)),
        db
          .select()
          .from(productVideos)
          .where(eq(productVideos.productId, productData.id)),
        // セール情報を取得
        db
          .select({
            regularPrice: productSales.regularPrice,
            salePrice: productSales.salePrice,
            discountPercent: productSales.discountPercent,
            endAt: productSales.endAt,
          })
          .from(productSales)
          .innerJoin(productSources, eq(productSales.productSourceId, productSources.id))
          .where(
            and(
              eq(productSources.productId, productData.id),
              eq(productSales.isActive, true),
              sql`(${productSales.endAt} IS NULL OR ${productSales.endAt} > NOW())`
            )
          )
          .limit(1),
      ]);

      // セールデータの変換
      const saleData = saleDataResult[0] ? {
        regularPrice: saleDataResult[0].regularPrice,
        salePrice: saleDataResult[0].salePrice,
        discountPercent: saleDataResult[0].discountPercent,
        endAt: saleDataResult[0].endAt,
      } : undefined;

      return mapProductToType(
        productData,
        performerData.filter(isValidPerformer),
        tagData,
        source,
        undefined,
        imagesData,
        videosData,
        locale,
        saleData
      ) as T;
    } catch (error) {
      console.error(`Error searching product by product ID ${productId}:`, error);
      throw error;
    }
  }

  /**
   * 商品ソース情報を取得
   */
  async function getProductSources(productId: number): Promise<ProductSourceResult[]> {
    const db = getDb();

    const sources = await db
      .select()
      .from(productSources)
      .where(eq(productSources.productId, productId));

    return sources;
  }

  /**
   * 商品ソース情報をセール情報付きで取得
   * siteMode='all' の場合はFANZAを除外（adult-vサイト用）
   */
  async function getProductSourcesWithSales(
    productId: number
  ): Promise<ProductSourceWithSaleResult[]> {
    const db = getDb();

    // Build WHERE clause with optional FANZA exclusion
    const whereClause = excludeFanza
      ? sql`ps.product_id = ${productId} AND LOWER(ps.asp_name) != 'fanza'`
      : sql`ps.product_id = ${productId}`;

    const result = await db.execute(sql`
      SELECT
        ps.id,
        ps.product_id as "productId",
        ps.asp_name as "aspName",
        ps.original_product_id as "originalProductId",
        ps.affiliate_url as "affiliateUrl",
        ps.price,
        ps.currency,
        ps.product_type as "productType",
        ps.created_at as "createdAt",
        ps.updated_at as "updatedAt",
        psl.sale_price as "salePrice",
        psl.regular_price as "regularPrice",
        psl.discount_percent as "discountPercent",
        psl.end_at as "saleEndAt",
        psl.sale_name as "saleName"
      FROM product_sources ps
      LEFT JOIN product_sales psl ON ps.id = psl.product_source_id AND psl.is_active = TRUE
      WHERE ${whereClause}
      ORDER BY
        CASE WHEN psl.sale_price IS NOT NULL THEN 0 ELSE 1 END,
        psl.discount_percent DESC NULLS LAST,
        ps.price ASC NULLS LAST
    `);

    return result.rows as ProductSourceWithSaleResult[];
  }

  /**
   * 品番から商品ソース情報を取得（名寄せ用）
   */
  async function getProductSourcesByMakerCode(
    makerProductCode: string
  ): Promise<ProductSourceWithSaleResult[]> {
    const db = getDb();

    // 品番を正規化（空白・ハイフン除去、小文字化）
    const normalizedCode = makerProductCode.replace(/[-_\s]/g, '').toLowerCase();

    const result = await db.execute(sql`
      SELECT
        ps.id,
        ps.product_id as "productId",
        ps.asp_name as "aspName",
        ps.original_product_id as "originalProductId",
        ps.affiliate_url as "affiliateUrl",
        ps.price,
        ps.currency,
        ps.product_type as "productType",
        ps.created_at as "createdAt",
        ps.updated_at as "updatedAt",
        psl.sale_price as "salePrice",
        psl.regular_price as "regularPrice",
        psl.discount_percent as "discountPercent",
        psl.end_at as "saleEndAt",
        psl.sale_name as "saleName"
      FROM product_sources ps
      LEFT JOIN product_sales psl ON ps.id = psl.product_source_id AND psl.is_active = TRUE
      WHERE LOWER(REPLACE(REPLACE(ps.original_product_id, '-', ''), '_', '')) = ${normalizedCode}
         OR LOWER(REPLACE(REPLACE(ps.original_product_id, '-', ''), '_', '')) LIKE ${normalizedCode + '%'}
      ORDER BY
        CASE WHEN psl.sale_price IS NOT NULL THEN 0 ELSE 1 END,
        psl.discount_percent DESC NULLS LAST,
        ps.price ASC NULLS LAST
    `);

    return result.rows as ProductSourceWithSaleResult[];
  }

  /**
   * 品番から商品の品番を取得
   */
  async function getProductMakerCode(productId: number): Promise<string | null> {
    const db = getDb();

    const result = await db
      .select({
        normalizedProductId: products.normalizedProductId,
        makerProductCode: products.makerProductCode,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (result.length === 0) return null;

    return result[0].makerProductCode || result[0].normalizedProductId || null;
  }

  /**
   * 商品をあいまい検索（メーカー品番、タイトル、normalizedProductIdで検索）
   * 複数の商品が見つかる可能性があります
   */
  async function fuzzySearchProducts<T>(
    query: string,
    limit: number = 20,
    getProductByIdFn: (id: string, locale?: string) => Promise<T | null>
  ): Promise<T[]> {
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
          sql`${products.normalizedProductId} ILIKE ${searchPattern} OR ${products.title} ILIKE ${searchPattern}`
        )
        .limit(limit);

      // 重複を排除してproduct IDsを集める
      const productIds = new Set<string>();
      sourceMatches.forEach((m: { productId: number }) => productIds.add(m.productId.toString()));
      productMatches.forEach((m: { id: number }) => productIds.add(m.id.toString()));

      if (productIds.size === 0) {
        return [];
      }

      // 各商品の詳細情報を取得
      const productDetails = await Promise.all(
        Array.from(productIds).slice(0, limit).map(id => getProductByIdFn(id))
      );

      return productDetails.filter((p): p is NonNullable<typeof p> => p !== null) as T[];
    } catch (error) {
      console.error('Error in fuzzy search:', error);
      throw error;
    }
  }

  /**
   * 最新の商品を取得（RSS用）
   * @param options.limit - 取得する商品数（デフォルト: 100）
   * @param options.locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
   */
  async function getRecentProducts<T>(options?: {
    limit?: number;
    locale?: string;
  }): Promise<T[]> {
    try {
      const db = getDb();
      const limit = options?.limit || 100;
      const locale = options?.locale || 'ja';

      // 最新の商品を取得
      const results = await db
        .select()
        .from(products)
        .orderBy(desc(products.releaseDate), desc(products.createdAt))
        .limit(limit);

      // 関連データを並列で取得
      const productsWithData = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results.map(async (product: any) => {
          const { performerData, tagData, sourceData, imagesData, videosData } = await fetchProductRelatedData(product.id as number);

          return mapProductToType(
            product,
            performerData,
            tagData,
            sourceData,
            undefined,
            imagesData as unknown[],
            videosData as unknown[],
            locale
          );
        })
      );

      return productsWithData as T[];
    } catch (error) {
      console.error('Error getting recent products:', error);
      throw error;
    }
  }

  /**
   * 品番(maker_product_code)で同じ作品の全ASPからサンプル画像を取得
   * @param options.includeImageType - trueの場合、image_type, display_orderも返す (default: false)
   * @param options.filterImageTypes - フィルタするimage_type配列 (default: なし)
   * @param options.limit - 取得件数制限 (default: なし)
   */
  async function getSampleImagesByMakerCode(
    makerProductCode: string,
    options?: {
      includeImageType?: boolean;
      filterImageTypes?: string[];
      limit?: number;
    }
  ): Promise<Array<{
    imageUrl: string;
    imageType?: string;
    displayOrder?: number | null;
    aspName: string | null;
  }>> {
    if (!makerProductCode) return [];

    try {
      const db = getDb();
      const includeImageType = options?.includeImageType ?? false;
      const filterImageTypes = options?.filterImageTypes;
      const limit = options?.limit;

      if (includeImageType) {
        // image_type, display_orderを含む詳細版
        const imageTypeFilter = filterImageTypes && filterImageTypes.length > 0
          ? sql`AND pi.image_type IN (${sql.join(filterImageTypes.map(t => sql`${t}`), sql`, `)})`
          : sql``;
        const limitClause = limit ? sql`LIMIT ${limit}` : sql``;

        const result = await db.execute(sql`
          SELECT DISTINCT ON (pi.image_url)
            pi.image_url,
            pi.image_type,
            pi.display_order,
            pi.asp_name
          FROM ${productImages} pi
          JOIN ${products} p ON p.id = pi.product_id
          WHERE p.maker_product_code = ${makerProductCode}
            ${imageTypeFilter}
          ORDER BY pi.image_url, pi.display_order ASC NULLS LAST
          ${limitClause}
        `);

        type ImageRow = {
          image_url: string;
          image_type: string;
          display_order: number | null;
          asp_name: string | null;
        };
        const rows = (result.rows || []) as ImageRow[];
        return rows.map((row) => ({
          imageUrl: row.image_url,
          imageType: row.image_type,
          displayOrder: row.display_order,
          aspName: row.asp_name,
        }));
      } else {
        // シンプル版（imageUrl, aspNameのみ）
        const result = await db.execute(sql`
          SELECT DISTINCT pi.image_url, ps.asp_name
          FROM ${products} p
          JOIN ${productImages} pi ON p.id = pi.product_id
          LEFT JOIN ${productSources} ps ON p.id = ps.product_id
          WHERE p.maker_product_code = ${makerProductCode}
            AND pi.image_url IS NOT NULL
            AND pi.image_url != ''
          ORDER BY ps.asp_name NULLS LAST
        `);

        type SimpleImageRow = { image_url: string; asp_name: string | null };
        const rows = (result.rows || []) as SimpleImageRow[];
        return rows.map(row => ({
          imageUrl: row.image_url,
          aspName: row.asp_name,
        }));
      }
    } catch (error) {
      console.error(`Error fetching sample images by maker code ${makerProductCode}:`, error);
      return [];
    }
  }

  return {
    getProductById,
    searchProductByProductId,
    getProductSources,
    getProductSourcesWithSales,
    getProductSourcesByMakerCode,
    getProductMakerCode,
    fuzzySearchProducts,
    getRecentProducts,
    getSampleImagesByMakerCode,
  };
}

export type ProductQueries = ReturnType<typeof createProductQueries>;
