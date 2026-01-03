import { NextRequest, NextResponse } from 'next/server';
import { generateActressProfile } from '@adult-v/shared';
import { getActressById } from '@/lib/db/queries';
import { getDb } from '@/lib/db';
import { productPerformers, productTags, productSources, tags, products } from '@/lib/db/schema';
import { sql, desc, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 女優プロフィール自動生成API
 * 女優IDから情報を取得し、AIでプロフィールを生成
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const performerId = Number(id);

    if (isNaN(performerId)) {
      return NextResponse.json(
        { error: '無効なIDです' },
        { status: 400 }
      );
    }

    // 女優情報を取得
    const actress = await getActressById(id, 'ja');

    if (!actress) {
      return NextResponse.json(
        { error: '女優が見つかりません' },
        { status: 404 }
      );
    }

    const db = getDb();

    // 出演作品のIDを取得
    const productLinks = await db
      .select({ productId: productPerformers.productId })
      .from(productPerformers)
      .where(sql`${productPerformers.performerId} = ${performerId}`)
      .limit(100);

    const productIds = productLinks.map(p => p.productId);

    // 最古の作品年を取得
    let debutYear: number | undefined;
    if (productIds.length > 0) {
      const [oldestProduct] = await db
        .select({ releaseDate: products.releaseDate })
        .from(products)
        .where(inArray(products.id, productIds))
        .orderBy(products.releaseDate)
        .limit(1);
      if (oldestProduct?.releaseDate) {
        debutYear = new Date(oldestProduct.releaseDate).getFullYear();
      }
    }

    // よく出演するジャンルを取得
    let topGenres: string[] = [];
    if (productIds.length > 0) {
      const genreStats = await db
        .select({
          tagId: productTags.tagId,
          count: sql<number>`count(*)`,
        })
        .from(productTags)
        .where(inArray(productTags.productId, productIds))
        .groupBy(productTags.tagId)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      if (genreStats.length > 0) {
        const tagIds = genreStats.map(g => g.tagId);
        const tagData = await db
          .select({ id: tags.id, name: tags.name })
          .from(tags)
          .where(inArray(tags.id, tagIds));
        const tagMap = new Map(tagData.map(t => [t.id, t.name]));
        topGenres = genreStats.map(g => tagMap.get(g.tagId) || '').filter(Boolean);
      }
    }

    // よく出演するメーカー（ASP名）を取得
    let topMakers: string[] = [];
    if (productIds.length > 0) {
      const makerStats = await db
        .select({
          aspName: productSources.aspName,
          count: sql<number>`count(*)`,
        })
        .from(productSources)
        .where(inArray(productSources.productId, productIds))
        .groupBy(productSources.aspName)
        .orderBy(desc(sql`count(*)`))
        .limit(5);
      topMakers = makerStats.map(m => m.aspName).filter(Boolean);
    }

    // 最近の作品を取得
    let recentWorks: string[] = [];
    if (productIds.length > 0) {
      const recentProducts = await db
        .select({ title: products.title })
        .from(products)
        .where(inArray(products.id, productIds))
        .orderBy(desc(products.releaseDate))
        .limit(5);
      recentWorks = recentProducts.map(p => p.title);
    }

    // プロフィールを生成
    const profile = await generateActressProfile({
      name: actress.name,
      aliases: actress.aliases || undefined,
      totalWorks: actress.releaseCount || undefined,
      debutYear,
      topGenres: topGenres.length > 0 ? topGenres : undefined,
      topMakers: topMakers.length > 0 ? topMakers : undefined,
      recentWorks: recentWorks.length > 0 ? recentWorks : undefined,
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'プロフィールの生成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Generate Profile API] Error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
