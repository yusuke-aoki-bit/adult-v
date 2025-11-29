import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products, performers, tags, productSources } from '@/lib/db/schema';
import { sql, or, ilike, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AutocompleteResult {
  type: 'product' | 'actress' | 'tag' | 'product_id';
  id: string | number;
  name: string;
  image?: string;
  category?: string;
  count?: number;
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const db = getDb();
    const results: AutocompleteResult[] = [];
    const limit = 5;

    // 1. 品番検索（最優先）
    const productIdMatches = await db
      .select({
        id: products.id,
        title: products.title,
        normalizedProductId: products.normalizedProductId,
        originalProductId: productSources.originalProductId,
        thumbnail: products.defaultThumbnailUrl,
      })
      .from(products)
      .leftJoin(productSources, sql`${products.id} = ${productSources.productId}`)
      .where(
        or(
          sql`${products.normalizedProductId} ILIKE ${`%${query}%`}`,
          sql`${productSources.originalProductId} ILIKE ${`%${query}%`}`
        )
      )
      .limit(limit);

    productIdMatches.forEach((match) => {
      results.push({
        type: 'product_id',
        id: match.id,
        name: match.originalProductId || match.normalizedProductId || match.id,
        image: match.thumbnail || undefined,
        category: '品番',
      });
    });

    // 2. 女優名検索
    const actressMatches = await db
      .select({
        id: performers.id,
        name: performers.name,
        image: performers.imageUrl,
        productCount: sql<number>`COUNT(DISTINCT pp.product_id)`.as('product_count'),
      })
      .from(performers)
      .leftJoin(sql`product_performers pp`, sql`${performers.id} = pp.performer_id`)
      .where(ilike(performers.name, `%${query}%`))
      .groupBy(performers.id, performers.name, performers.imageUrl)
      .orderBy(desc(sql`product_count`))
      .limit(limit);

    actressMatches
      .filter(isValidPerformer)
      .forEach((match) => {
        results.push({
          type: 'actress',
          id: match.id,
          name: match.name,
          image: match.image || undefined,
          count: Number(match.productCount || 0),
          category: '女優',
        });
      });

    // 3. タグ検索
    const tagMatches = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
        productCount: sql<number>`COUNT(DISTINCT pt.product_id)`.as('product_count'),
      })
      .from(tags)
      .leftJoin(sql`product_tags pt`, sql`${tags.id} = pt.tag_id`)
      .where(ilike(tags.name, `%${query}%`))
      .groupBy(tags.id, tags.name, tags.category)
      .orderBy(desc(sql`product_count`))
      .limit(limit);

    tagMatches.forEach((match) => {
      results.push({
        type: 'tag',
        id: match.id,
        name: match.name,
        count: Number(match.productCount || 0),
        category: match.category || 'タグ',
      });
    });

    // 4. 商品タイトル検索（FTS使用）
    if (results.length < 10) {
      const titleMatches = await db
        .select({
          id: products.id,
          title: products.title,
          thumbnail: products.defaultThumbnailUrl,
        })
        .from(products)
        .where(
          sql`${products}.search_vector @@ plainto_tsquery('simple', ${query})`
        )
        .limit(5);

      titleMatches.forEach((match) => {
        results.push({
          type: 'product',
          id: match.id,
          name: match.title || '',
          image: match.thumbnail || undefined,
          category: '作品',
        });
      });
    }

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
    console.error('Autocomplete error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch autocomplete results' },
      { status: 500 }
    );
  }
}
