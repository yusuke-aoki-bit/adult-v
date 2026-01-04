import { NextRequest, NextResponse } from 'next/server';
import { sql, or, ilike, desc } from 'drizzle-orm';
import { createApiErrorResponse } from '../lib/api-logger';

interface AutocompleteResult {
  type: 'product' | 'actress' | 'tag' | 'product_id';
  id: string | number;
  name: string;
  image?: string;
  category?: string;
  count?: number;
}

interface DbClient {
  select: (fields: Record<string, unknown>) => {
    from: (table: unknown) => {
      leftJoin: (
        table: unknown,
        condition: unknown
      ) => {
        where: (condition: unknown) => {
          groupBy: (...fields: unknown[]) => {
            orderBy: (order: unknown) => {
              limit: (n: number) => Promise<Record<string, unknown>[]>;
            };
          };
          limit: (n: number) => Promise<Record<string, unknown>[]>;
        };
      };
      where: (condition: unknown) => {
        limit: (n: number) => Promise<Record<string, unknown>[]>;
      };
    };
  };
}

export interface SearchAutocompleteHandlerDeps {
  getDb: () => DbClient;
  products: {
    id: unknown;
    title: unknown;
    normalizedProductId: unknown;
    defaultThumbnailUrl: unknown;
  };
  performers: {
    id: unknown;
    name: unknown;
    profileImageUrl: unknown;
  };
  tags: {
    id: unknown;
    name: unknown;
    category: unknown;
  };
  productSources: {
    productId: unknown;
    originalProductId: unknown;
  };
}

/**
 * 無効な演者データをフィルタリングするヘルパー関数
 * クローリング時のパースエラーにより生成された無効なデータを除外
 */
function isValidPerformer(performer: { name: string }): boolean {
  const name = performer.name;

  // 1文字だけの名前は無効
  if (name.length <= 1) return false;

  // 矢印記号を含む名前は無効
  if (name.includes('→')) return false;

  // 特定の無効な名前
  const invalidNames = ['デ', 'ラ', 'ゆ', 'な', '他'];
  if (invalidNames.includes(name)) return false;

  return true;
}

export function createSearchAutocompleteHandler(deps: SearchAutocompleteHandlerDeps) {
  return async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q');

      if (!query || query.length < 2) {
        return NextResponse.json({ results: [] });
      }

      const db = deps.getDb();
      const limit = 5;

      // Run all searches in parallel for better performance
      const [productIdMatches, actressMatches, tagMatches, titleMatches] = await Promise.all([
        // 1. 品番検索（最優先）
        db
          .select({
            id: deps.products.id,
            title: deps.products.title,
            normalizedProductId: deps.products.normalizedProductId,
            originalProductId: deps.productSources.originalProductId,
            thumbnail: deps.products.defaultThumbnailUrl,
          })
          .from(deps.products)
          .leftJoin(
            deps.productSources,
            sql`${deps.products.id} = ${deps.productSources.productId}`
          )
          .where(
            or(
              sql`${deps.products.normalizedProductId} ILIKE ${`%${query}%`}`,
              sql`${deps.productSources.originalProductId} ILIKE ${`%${query}%`}`
            )
          )
          .limit(limit) as Promise<{
            id: number;
            title: string | null;
            normalizedProductId: string | null;
            originalProductId: string | null;
            thumbnail: string | null;
          }[]>,

        // 2. 女優名検索
        db
          .select({
            id: deps.performers.id,
            name: deps.performers.name,
            image: deps.performers.profileImageUrl,
            productCount: sql<number>`COUNT(DISTINCT pp.product_id)`.as(
              'product_count'
            ),
          })
          .from(deps.performers)
          .leftJoin(
            sql`product_performers pp`,
            sql`${deps.performers.id} = pp.performer_id`
          )
          .where(ilike(deps.performers.name as never, `%${query}%`))
          .groupBy(
            deps.performers.id,
            deps.performers.name,
            deps.performers.profileImageUrl
          )
          .orderBy(desc(sql`product_count`))
          .limit(limit) as Promise<{
            id: number;
            name: string;
            image: string | null;
            productCount: number;
          }[]>,

        // 3. タグ検索
        db
          .select({
            id: deps.tags.id,
            name: deps.tags.name,
            category: deps.tags.category,
            productCount: sql<number>`COUNT(DISTINCT pt.product_id)`.as(
              'product_count'
            ),
          })
          .from(deps.tags)
          .leftJoin(sql`product_tags pt`, sql`${deps.tags.id} = pt.tag_id`)
          .where(ilike(deps.tags.name as never, `%${query}%`))
          .groupBy(deps.tags.id, deps.tags.name, deps.tags.category)
          .orderBy(desc(sql`product_count`))
          .limit(limit) as Promise<{
            id: number;
            name: string;
            category: string | null;
            productCount: number;
          }[]>,

        // 4. 商品タイトル検索（FTS使用）
        db
          .select({
            id: deps.products.id,
            title: deps.products.title,
            thumbnail: deps.products.defaultThumbnailUrl,
          })
          .from(deps.products)
          .where(
            sql`${deps.products}.search_vector @@ plainto_tsquery('simple', ${query})`
          )
          .limit(5) as Promise<{
            id: number;
            title: string | null;
            thumbnail: string | null;
          }[]>,
      ]);

      // Combine results with type priority
      const results: AutocompleteResult[] = [];

      // 1. 品番検索結果
      productIdMatches.forEach((match) => {
        results.push({
          type: 'product_id',
          id: match.id,
          name:
            match.originalProductId ||
            match.normalizedProductId ||
            String(match.id),
          image: match.thumbnail || undefined,
          category: '品番',
        });
      });

      // 2. 女優名検索結果
      actressMatches.filter(isValidPerformer).forEach((match) => {
        results.push({
          type: 'actress',
          id: match.id,
          name: match.name,
          image: match.image || undefined,
          count: Number(match.productCount || 0),
          category: '女優',
        });
      });

      // 3. タグ検索結果
      tagMatches.forEach((match) => {
        results.push({
          type: 'tag',
          id: match.id,
          name: match.name,
          count: Number(match.productCount || 0),
          category: match.category || 'タグ',
        });
      });

      // 4. 商品タイトル検索結果（上限まで追加）
      titleMatches.forEach((match) => {
        results.push({
          type: 'product',
          id: match.id,
          name: match.title || '',
          image: match.thumbnail || undefined,
          category: '作品',
        });
      });

      // 重複排除（IDとtypeの組み合わせでユニーク）
      const uniqueResults = results.reduce((acc, current) => {
        const key = `${current.type}-${current.id}`;
        if (!acc.has(key)) {
          acc.set(key, current);
        }
        return acc;
      }, new Map<string, AutocompleteResult>());

      const finalResults = Array.from(uniqueResults.values()).slice(0, 10);

      return NextResponse.json({
        results: finalResults,
        query,
      });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch autocomplete results', 500, {
        endpoint: '/api/search/autocomplete',
      });
    }
  };
}
