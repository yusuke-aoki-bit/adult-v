import { NextRequest, NextResponse } from 'next/server';

export interface RecommendationsFromHistoryHandlerDeps {
  getDb: () => any;
  products: any;
  productPerformers: any;
  productTags: any;
  performers: any;
  tags: any;
  eq: any;
  inArray: any;
  sql: any;
  desc: any;
  and: any;
  analyzeViewingHistory: (params: any) => Promise<any>;
}

export function createRecommendationsFromHistoryHandler(deps: RecommendationsFromHistoryHandlerDeps) {
  return async function POST(request: NextRequest) {
    try {
      const { history, limit = 12 } = (await request.json()) as {
        history: Array<{ id: string; title: string }>;
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

      const db = deps.getDb();
      const productIds = history
        .slice(0, 10)
        .map((h) => parseInt(h.id, 10))
        .filter((id) => !isNaN(id));
      if (productIds.length === 0) {
        return NextResponse.json({
          success: true,
          recommendations: [],
          analysis: null,
          message: '有効な履歴がありません',
        });
      }

      const [performerData, tagData, productData] = await Promise.all([
        db
          .select({
            productId: deps.productPerformers.productId,
            performerId: deps.productPerformers.performerId,
            performerName: deps.performers.name,
            profileImageUrl: deps.performers.profileImageUrl,
            productThumbnail: deps.products.defaultThumbnailUrl,
          })
          .from(deps.productPerformers)
          .innerJoin(deps.performers, deps.eq(deps.productPerformers.performerId, deps.performers.id))
          .innerJoin(deps.products, deps.eq(deps.productPerformers.productId, deps.products.id))
          .where(deps.inArray(deps.productPerformers.productId, productIds)),
        db
          .select({
            productId: deps.productTags.productId,
            tagId: deps.productTags.tagId,
            tagName: deps.tags.name,
            tagCategory: deps.tags.category,
          })
          .from(deps.productTags)
          .innerJoin(deps.tags, deps.eq(deps.productTags.tagId, deps.tags.id))
          .where(deps.inArray(deps.productTags.productId, productIds)),
        db
          .select({ id: deps.products.id, title: deps.products.title, duration: deps.products.duration })
          .from(deps.products)
          .where(deps.inArray(deps.products.id, productIds)),
      ]);

      const performerCounts = new Map<number, { name: string; count: number; thumbnailUrl: string | null }>();
      const tagCounts = new Map<number, { name: string; count: number }>();

      for (const p of performerData) {
        const current = performerCounts.get(p.performerId) || {
          name: p.performerName,
          count: 0,
          thumbnailUrl: p.profileImageUrl || p.productThumbnail,
        };
        if (!current.thumbnailUrl && p.productThumbnail) current.thumbnailUrl = p.productThumbnail;
        performerCounts.set(p.performerId, { ...current, count: current.count + 1 });
      }
      for (const t of tagData) {
        if (t.tagCategory === 'genre' || !t.tagCategory) {
          const current = tagCounts.get(t.tagId) || { name: t.tagName, count: 0 };
          tagCounts.set(t.tagId, { ...current, count: current.count + 1 });
        }
      }

      const topPerformers = [...performerCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);
      const topTags = [...tagCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
      const topPerformerIds = topPerformers.map(([id]) => id);
      const topTagIds = topTags.map(([id]) => id);

      const llmPromise = deps.analyzeViewingHistory({
        recentProducts: productData.map((p: any) => ({
          title: p.title || '',
          performers: performerData.filter((pd: any) => pd.productId === p.id).map((pd: any) => pd.performerName),
          genres: tagData
            .filter((td: any) => td.productId === p.id && (td.tagCategory === 'genre' || !td.tagCategory))
            .map((td: any) => td.tagName),
          duration: p.duration || undefined,
        })),
      });

      const recommendations: any[] = [];

      if (topPerformerIds.length > 0) {
        const performerProducts = await db
          .select({
            id: deps.products.id,
            title: deps.products.title,
            normalizedProductId: deps.products.normalizedProductId,
            imageUrl: deps.products.defaultThumbnailUrl,
            releaseDate: deps.products.releaseDate,
            matchScore: deps.sql`COUNT(DISTINCT ${deps.productPerformers.performerId})`.as('match_score'),
          })
          .from(deps.products)
          .innerJoin(deps.productPerformers, deps.eq(deps.products.id, deps.productPerformers.productId))
          .where(
            deps.and(
              deps.inArray(deps.productPerformers.performerId, topPerformerIds),
              deps.sql`${deps.products.id} NOT IN (${deps.sql.join(
                productIds.map((id: number) => deps.sql`${id}`),
                deps.sql`, `,
              )})`,
            ),
          )
          .groupBy(
            deps.products.id,
            deps.products.title,
            deps.products.normalizedProductId,
            deps.products.defaultThumbnailUrl,
            deps.products.releaseDate,
          )
          .orderBy(deps.desc(deps.sql`match_score`), deps.desc(deps.products.releaseDate))
          .limit(Math.ceil(limit / 2));

        for (const p of performerProducts) {
          const matchingPerformers = topPerformers
            .filter(([id]) => performerData.some((pd: any) => pd.productId === p.id && pd.performerId === id))
            .map(([, data]) => data.name);
          recommendations.push({
            id: p.id,
            title: p.title || '',
            normalizedProductId: p.normalizedProductId,
            imageUrl: p.imageUrl,
            releaseDate: p.releaseDate ? new Date(p.releaseDate).toISOString().split('T')[0] : null,
            matchType: 'performer',
            matchReason: matchingPerformers.length > 0 ? `${matchingPerformers[0]}出演` : undefined,
          });
        }
      }

      if (topTagIds.length > 0 && recommendations.length < limit) {
        const existingIds = [...productIds, ...recommendations.map((r) => r.id)];
        const tagProducts = await db
          .select({
            id: deps.products.id,
            title: deps.products.title,
            normalizedProductId: deps.products.normalizedProductId,
            imageUrl: deps.products.defaultThumbnailUrl,
            releaseDate: deps.products.releaseDate,
            matchScore: deps.sql`COUNT(DISTINCT ${deps.productTags.tagId})`.as('match_score'),
          })
          .from(deps.products)
          .innerJoin(deps.productTags, deps.eq(deps.products.id, deps.productTags.productId))
          .where(
            deps.and(
              deps.inArray(deps.productTags.tagId, topTagIds),
              deps.sql`${deps.products.id} NOT IN (${deps.sql.join(
                existingIds.map((id: number) => deps.sql`${id}`),
                deps.sql`, `,
              )})`,
            ),
          )
          .groupBy(
            deps.products.id,
            deps.products.title,
            deps.products.normalizedProductId,
            deps.products.defaultThumbnailUrl,
            deps.products.releaseDate,
          )
          .orderBy(deps.desc(deps.sql`match_score`), deps.desc(deps.products.releaseDate))
          .limit(limit - recommendations.length);

        for (const p of tagProducts) {
          const matchingGenres = topTags
            .filter(([id]) => tagData.some((td: any) => td.productId === p.id && td.tagId === id))
            .map(([, data]) => data.name);
          recommendations.push({
            id: p.id,
            title: p.title || '',
            normalizedProductId: p.normalizedProductId,
            imageUrl: p.imageUrl,
            releaseDate: p.releaseDate ? new Date(p.releaseDate).toISOString().split('T')[0] : null,
            matchType: 'genre',
            matchReason: matchingGenres.length > 0 ? `${matchingGenres.slice(0, 2).join('・')}好きに` : undefined,
          });
        }
      }

      let analysis = null;
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
      return NextResponse.json({
        success: false,
        fallback: true,
        recommendations: [],
        analysis: null,
        userProfile: { topPerformers: [], topGenres: [] },
        message: 'おすすめの取得に失敗しました',
      });
    }
  };
}
