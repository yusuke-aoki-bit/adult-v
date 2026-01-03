/**
 * フッター用内部リンクAPI
 * 人気ジャンル、シリーズ、メーカーを返す（SEO内部リンク強化用）
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tags, productTags } from '@/lib/db/schema';
import { desc, sql, eq } from 'drizzle-orm';

// 1時間キャッシュ
export const revalidate = 3600;

export async function GET() {
  try {
    const db = getDb();

    // 人気ジャンル取得（作品数順）
    const popularGenres = await db
      .select({
        id: tags.id,
        name: tags.name,
        productCount: sql<number>`COUNT(DISTINCT ${productTags.productId})`.as('product_count'),
      })
      .from(tags)
      .leftJoin(productTags, eq(tags.id, productTags.tagId))
      .where(eq(tags.category, 'genre'))
      .groupBy(tags.id, tags.name)
      .orderBy(desc(sql`product_count`))
      .limit(8);

    // 人気シリーズ取得（作品数順）
    const popularSeries = await db
      .select({
        id: tags.id,
        name: tags.name,
        productCount: sql<number>`COUNT(DISTINCT ${productTags.productId})`.as('product_count'),
      })
      .from(tags)
      .leftJoin(productTags, eq(tags.id, productTags.tagId))
      .where(eq(tags.category, 'series'))
      .groupBy(tags.id, tags.name)
      .orderBy(desc(sql`product_count`))
      .limit(5);

    // 人気メーカー取得（作品数順）- tagsテーブルのcategory='maker'から取得
    const popularMakers = await db
      .select({
        id: tags.id,
        name: tags.name,
        productCount: sql<number>`COUNT(DISTINCT ${productTags.productId})`.as('product_count'),
      })
      .from(tags)
      .leftJoin(productTags, eq(tags.id, productTags.tagId))
      .where(eq(tags.category, 'maker'))
      .groupBy(tags.id, tags.name)
      .orderBy(desc(sql`product_count`))
      .limit(5);

    return NextResponse.json({
      genres: popularGenres.map(g => ({ id: g.id, name: g.name })),
      series: popularSeries.map(s => ({ id: s.id, name: s.name })),
      makers: popularMakers
        .filter(m => m.id && m.name)
        .map(m => ({ id: m.id, name: m.name })),
      source: 'database',
      meta: {
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to fetch footer links:', error);

    // エラー時は空配列を返す（嘘のデータを返さない）
    return NextResponse.json({
      genres: [],
      series: [],
      makers: [],
      source: 'error',
      error: 'Database error',
    });
  }
}
