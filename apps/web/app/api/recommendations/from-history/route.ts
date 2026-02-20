import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productPerformers, productTags, performers, tags } from '@/lib/db/schema';
import { eq, inArray, sql, desc, and } from 'drizzle-orm';
import { analyzeViewingHistory, type ViewingHistoryAnalysis } from '@adult-v/shared/lib/llm-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RecentlyViewedItem {
  id: string;
  title: string;
}

interface RecommendedProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  matchType: 'performer' | 'genre' | 'ai_suggested';
  matchReason?: string;
}

/**
 * 視聴履歴ベースのおすすめAPI
 * POST /api/recommendations/from-history
 */
export async function POST(request: NextRequest) {
  try {
    const { history, limit = 12 } = await request.json() as {
      history: RecentlyViewedItem[];
      limit?: number;
    };

    if (!history || !Array.isArray(history) || history.length === 0) {
      return NextResponse.json({
        success: true,
        recommendations: [],
        analysis: null,
        message: '閲覧履歴がありません',
      });
    }

    const db = getDb();
    const productIds = history.slice(0, 10).map(h => parseInt(h.id, 10)).filter(id => !isNaN(id));

    if (productIds.length === 0) {
      return NextResponse.json({
        success: true,
        recommendations: [],
        analysis: null,
        message: '有効な履歴がありません',
      });
    }

    // 1. 履歴の作品から女優・ジャンル情報を取得
    const [performerData, tagData, productData] = await Promise.all([
      // 出演女優
      db
        .select({
          productId: productPerformers.productId,
          performerId: productPerformers.performerId,
          performerName: performers.name,
          profileImageUrl: performers.profileImageUrl,
        })
        .from(productPerformers)
        .innerJoin(performers, eq(productPerformers.performerId, performers.id))
        .where(inArray(productPerformers.productId, productIds)),

      // タグ/ジャンル
      db
        .select({
          productId: productTags.productId,
          tagId: productTags.tagId,
          tagName: tags.name,
          tagCategory: tags.category,
        })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(inArray(productTags.productId, productIds)),

      // 作品情報（LLM分析用）
      db
        .select({
          id: products.id,
          title: products.title,
          duration: products.duration,
        })
        .from(products)
        .where(inArray(products.id, productIds)),
    ]);

    // 女優ID・タグIDを集計（頻度カウント）
    const performerCounts = new Map<number, { name: string; count: number; thumbnailUrl: string | null }>();
    const tagCounts = new Map<number, { name: string; count: number }>();

    for (const p of performerData) {
      const current = performerCounts.get(p.performerId) || { name: p.performerName, count: 0, thumbnailUrl: p.profileImageUrl };
      performerCounts.set(p.performerId, { ...current, count: current.count + 1 });
    }

    for (const t of tagData) {
      if (t.tagCategory === 'genre' || !t.tagCategory) {
        const current = tagCounts.get(t.tagId) || { name: t.tagName, count: 0 };
        tagCounts.set(t.tagId, { ...current, count: current.count + 1 });
      }
    }

    // 頻度順にソート
    const topPerformers = [...performerCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    const topPerformerIds = topPerformers.map(([id]) => id);
    const topTagIds = topTags.map(([id]) => id);

    // 2. LLM分析（非同期で並行実行）
    const llmPromise = analyzeViewingHistory({
      recentProducts: productData.map(p => {
        const productPerformerNames = performerData
          .filter(pd => pd.productId === p.id)
          .map(pd => pd.performerName);
        const productTagNames = tagData
          .filter(td => td.productId === p.id && (td.tagCategory === 'genre' || !td.tagCategory))
          .map(td => td.tagName);

        return {
          title: p.title || '',
          performers: productPerformerNames,
          genres: productTagNames,
          duration: p.duration || undefined,
        };
      }),
    });

    // 3. おすすめ作品を検索
    const recommendations: RecommendedProduct[] = [];

    // 3-1. 同じ女優の作品
    if (topPerformerIds.length > 0) {
      const performerProducts = await db
        .select({
          id: products.id,
          title: products.title,
          normalizedProductId: products.normalizedProductId,
          imageUrl: products.defaultThumbnailUrl,
          releaseDate: products.releaseDate,
          matchScore: sql<number>`COUNT(DISTINCT ${productPerformers.performerId})`.as('match_score'),
        })
        .from(products)
        .innerJoin(productPerformers, eq(products.id, productPerformers.productId))
        .where(
          and(
            inArray(productPerformers.performerId, topPerformerIds),
            sql`${products.id} NOT IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`
          )
        )
        .groupBy(products.id, products.title, products.normalizedProductId, products.defaultThumbnailUrl, products.releaseDate)
        .orderBy(desc(sql`match_score`), desc(products.releaseDate))
        .limit(Math.ceil(limit / 2));

      for (const p of performerProducts) {
        const matchingPerformers = topPerformers
          .filter(([id]) => performerData.some(pd => pd.productId === p.id && pd.performerId === id))
          .map(([, data]) => data.name);

        recommendations.push({
          id: p.id,
          title: p.title || '',
          normalizedProductId: p.normalizedProductId,
          imageUrl: p.imageUrl,
          releaseDate: p.releaseDate ? new Date(p.releaseDate).toISOString().split('T')[0] : null,
          matchType: 'performer',
          matchReason: matchingPerformers.length > 0
            ? `${matchingPerformers[0]}出演`
            : undefined,
        });
      }
    }

    // 3-2. 同じジャンルの作品
    if (topTagIds.length > 0 && recommendations.length < limit) {
      const existingIds = [...productIds, ...recommendations.map(r => r.id)];

      const tagProducts = await db
        .select({
          id: products.id,
          title: products.title,
          normalizedProductId: products.normalizedProductId,
          imageUrl: products.defaultThumbnailUrl,
          releaseDate: products.releaseDate,
          matchScore: sql<number>`COUNT(DISTINCT ${productTags.tagId})`.as('match_score'),
        })
        .from(products)
        .innerJoin(productTags, eq(products.id, productTags.productId))
        .where(
          and(
            inArray(productTags.tagId, topTagIds),
            sql`${products.id} NOT IN (${sql.join(existingIds.map(id => sql`${id}`), sql`, `)})`
          )
        )
        .groupBy(products.id, products.title, products.normalizedProductId, products.defaultThumbnailUrl, products.releaseDate)
        .orderBy(desc(sql`match_score`), desc(products.releaseDate))
        .limit(limit - recommendations.length);

      for (const p of tagProducts) {
        const matchingGenres = topTags
          .filter(([id]) => tagData.some(td => td.productId === p.id && td.tagId === id))
          .map(([, data]) => data.name);

        recommendations.push({
          id: p.id,
          title: p.title || '',
          normalizedProductId: p.normalizedProductId,
          imageUrl: p.imageUrl,
          releaseDate: p.releaseDate ? new Date(p.releaseDate).toISOString().split('T')[0] : null,
          matchType: 'genre',
          matchReason: matchingGenres.length > 0
            ? `${matchingGenres.slice(0, 2).join('・')}好きに`
            : undefined,
        });
      }
    }

    // 4. LLM分析結果を待つ
    let analysis: ViewingHistoryAnalysis | null = null;
    try {
      analysis = await llmPromise;
    } catch (error) {
      console.error('[Recommendations API] LLM analysis failed:', error);
    }

    return NextResponse.json({
      success: true,
      recommendations: recommendations.slice(0, limit),
      analysis,
      userProfile: {
        topPerformers: topPerformers.map(([id, data]) => ({ id, ...data })),
        topGenres: topTags.map(([id, data]) => ({ id, ...data })),
      },
      message: analysis?.personalizedMessage || 'あなたの視聴履歴に基づくおすすめです',
    });

  } catch (error) {
    console.error('[Recommendations API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
