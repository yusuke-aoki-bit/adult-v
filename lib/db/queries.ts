import { getDb } from './index';
import { products, actresses } from './schema';
import { eq, and, or, like, desc, asc, gte, lte } from 'drizzle-orm';
import type { Product as ProductType, Actress as ActressType, ProductCategory } from '@/types/product';
import type { InferSelectModel } from 'drizzle-orm';
import { mapLegacyProvider, mapLegacyServices } from '@/lib/provider-utils';

type DbProduct = InferSelectModel<typeof products>;
type DbActress = InferSelectModel<typeof actresses>;

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
    const result = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const product = result[0];
    return mapProductToType(product);
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
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
}

export async function getProducts(options?: GetProductsOptions): Promise<ProductType[]> {
  try {
    const db = getDb();
    const conditions = [];

    if (options?.category && options.category !== 'all') {
      conditions.push(eq(products.category, options.category));
    }

    if (options?.provider) {
      conditions.push(eq(products.provider, options.provider));
    }

    if (options?.actressId) {
      conditions.push(eq(products.actressId, options.actressId));
    }

    if (options?.isFeatured) {
      conditions.push(eq(products.isFeatured, true));
    }

    if (options?.isNew) {
      conditions.push(eq(products.isNew, true));
    }

    // 価格フィルター
    if (options?.minPrice !== undefined) {
      conditions.push(gte(products.price, options.minPrice));
    }
    if (options?.maxPrice !== undefined) {
      conditions.push(lte(products.price, options.maxPrice));
    }

    // 検索クエリ（タイトル、説明、女優名、タグを検索）
    if (options?.query) {
      const searchPattern = `%${options.query}%`;
      conditions.push(
        or(
          like(products.title, searchPattern),
          like(products.description, searchPattern),
          like(products.actressName, searchPattern),
          like(products.tags, searchPattern),
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ソート処理
    let orderByClause;
    switch (options?.sortBy) {
      case 'releaseDateAsc':
        orderByClause = [asc(products.releaseDate), asc(products.createdAt)];
        break;
      case 'priceDesc':
        orderByClause = [desc(products.price)];
        break;
      case 'priceAsc':
        orderByClause = [asc(products.price)];
        break;
      case 'ratingDesc':
        orderByClause = [desc(products.rating)];
        break;
      case 'ratingAsc':
        orderByClause = [asc(products.rating)];
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

    return results.map(mapProductToType);
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
    const db = getDb();
    const results = await db
      .select()
      .from(products)
      .where(eq(products.actressId, actressId))
      .orderBy(desc(products.releaseDate));

    return results.map(mapProductToType);
  } catch (error) {
    console.error(`Error fetching products for actress ${actressId}:`, error);
    throw error;
  }
}

/**
 * 女優一覧を取得
 */
export async function getActresses(options?: {
  limit?: number;
  offset?: number;
  query?: string;
}): Promise<ActressType[]> {
  try {
    const db = getDb();
    const conditions = [];

    // 検索クエリ（名前、説明、タグを検索）
    if (options?.query) {
      const searchPattern = `%${options.query}%`;
      conditions.push(
        or(
          like(actresses.name, searchPattern),
          like(actresses.description, searchPattern),
          like(actresses.tags, searchPattern),
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(actresses)
      .where(whereClause)
      .orderBy(desc(actresses.releaseCount), desc(actresses.trendingScore))
      .limit(options?.limit || 100)
      .offset(options?.offset || 0);

    return results.map(mapActressToType);
  } catch (error) {
    console.error('Error fetching actresses:', error);
    throw error;
  }
}

/**
 * 女優をIDで取得
 */
export async function getActressById(id: string): Promise<ActressType | null> {
  try {
    const db = getDb();
    const result = await db
      .select()
      .from(actresses)
      .where(eq(actresses.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const actress = result[0];
    return mapActressToType(actress);
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
    const db = getDb();
    const results = await db
      .select()
      .from(actresses)
      .orderBy(desc(actresses.trendingScore))
      .limit(limit);

    return results.map(mapActressToType);
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
function mapProductToType(product: DbProduct): ProductType {
  // Map legacy provider using utility function
  const mappedProvider = mapLegacyProvider(product.provider);

  // Validate category
  const category: ProductCategory = product.category && isValidCategory(product.category)
    ? product.category
    : 'premium';

  return {
    id: product.id,
    title: product.title,
    description: product.description || '',
    price: product.price || 0,
    category,
    imageUrl: product.imageUrl || 'https://placehold.co/600x800/052e16/ffffff?text=DUGA',
    affiliateUrl: product.affiliateUrl,
    provider: mappedProvider,
    providerLabel: product.providerLabel,
    actressId: product.actressId || undefined,
    actressName: product.actressName || undefined,
    releaseDate: product.releaseDate || undefined,
    duration: product.duration || undefined,
    format: product.format || undefined,
    rating: product.rating || undefined,
    reviewCount: product.reviewCount || undefined,
    tags: product.tags ? JSON.parse(product.tags) : [],
    isFeatured: product.isFeatured || false,
    isNew: product.isNew || false,
    discount: product.discount || undefined,
    reviewHighlight: product.reviewHighlight || undefined,
    ctaLabel: product.ctaLabel || undefined,
  };
}

/**
 * データベースの女優をActress型に変換
 */
function mapActressToType(actress: DbActress): ActressType {
  // Map legacy services using utility function
  const rawServices: string[] = actress.services ? JSON.parse(actress.services) : [];
  const mappedServices = mapLegacyServices(rawServices);

  // Parse and validate primary genres
  const rawGenres: string[] = actress.primaryGenres ? JSON.parse(actress.primaryGenres) : [];
  const primaryGenres = rawGenres.filter(isValidCategory) as ProductCategory[];

  return {
    id: actress.id,
    name: actress.name,
    catchcopy: actress.catchcopy || '',
    description: actress.description || '',
    heroImage: actress.heroImage || 'https://placehold.co/600x800/052e16/ffffff?text=Actress',
    thumbnail: actress.thumbnail || actress.heroImage || 'https://placehold.co/400x520/052e16/ffffff?text=Actress',
    primaryGenres,
    services: mappedServices,
    metrics: {
      releaseCount: actress.releaseCount || 0,
      trendingScore: actress.trendingScore || 0,
      fanScore: actress.fanScore || 0,
    },
    highlightWorks: actress.highlightWorks ? JSON.parse(actress.highlightWorks) : [],
    tags: actress.tags ? JSON.parse(actress.tags) : [],
  };
}

