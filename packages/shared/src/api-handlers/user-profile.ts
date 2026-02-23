import { NextRequest, NextResponse } from 'next/server';

export interface UserProfileHandlerDeps {
  getDb: () => any;
  products: any;
  productPerformers: any;
  productTags: any;
  performers: any;
  tags: any;
  inArray: any;
  eq: any;
  generateUserPreferenceProfile: (params: any) => Promise<any>;
}

export function createUserProfileHandler(deps: UserProfileHandlerDeps) {
  return async function POST(request: NextRequest) {
    try {
      const { history } = (await request.json()) as { history: Array<{ id: string; title: string }> };

      if (!history || !Array.isArray(history) || history.length < 5) {
        return NextResponse.json({
          success: false,
          profile: null,
          message: 'もう少し作品を閲覧するとプロファイルが生成されます（5件以上必要）',
        });
      }

      const db = deps.getDb();
      const productIds = history
        .slice(0, 20)
        .map((h) => parseInt(h.id, 10))
        .filter((id) => !isNaN(id));

      if (productIds.length < 5) {
        return NextResponse.json({ success: false, profile: null, message: '有効な履歴が不足しています' });
      }

      const [productData, performerData, tagData] = await Promise.all([
        db
          .select({ id: deps.products.id, title: deps.products.title, releaseDate: deps.products.releaseDate })
          .from(deps.products)
          .where(deps.inArray(deps.products.id, productIds)),
        db
          .select({ productId: deps.productPerformers.productId, performerName: deps.performers.name })
          .from(deps.productPerformers)
          .innerJoin(deps.performers, deps.eq(deps.productPerformers.performerId, deps.performers.id))
          .where(deps.inArray(deps.productPerformers.productId, productIds)),
        db
          .select({ productId: deps.productTags.productId, tagName: deps.tags.name, tagCategory: deps.tags.category })
          .from(deps.productTags)
          .innerJoin(deps.tags, deps.eq(deps.productTags.tagId, deps.tags.id))
          .where(deps.inArray(deps.productTags.productId, productIds)),
      ]);

      const uniquePerformers = new Set(performerData.map((p: any) => p.performerName));
      const uniqueGenres = new Set(
        tagData.filter((t: any) => t.tagCategory === 'genre' || !t.tagCategory).map((t: any) => t.tagName),
      );

      const recentProducts = productData.map((p: any) => ({
        title: p.title || '',
        performers: performerData.filter((pd: any) => pd.productId === p.id).map((pd: any) => pd.performerName),
        genres: tagData
          .filter((td: any) => td.productId === p.id && (td.tagCategory === 'genre' || !td.tagCategory))
          .map((td: any) => td.tagName),
        releaseDate: p.releaseDate ? new Date(p.releaseDate).toISOString().split('T')[0] : undefined,
      }));

      const availableGenresResult = await db
        .select({ name: deps.tags.name })
        .from(deps.tags)
        .where(deps.eq(deps.tags.category, 'genre'))
        .limit(50);
      const availableGenres = availableGenresResult.map((r: any) => r.name);

      const profile = await deps.generateUserPreferenceProfile({
        recentProducts,
        viewingStats: {
          totalViewed: history.length,
          uniquePerformers: uniquePerformers.size,
          uniqueGenres: uniqueGenres.size,
        },
        availableGenres,
      });

      if (!profile) {
        return NextResponse.json({ success: false, profile: null, message: 'プロファイル生成に失敗しました' });
      }

      return NextResponse.json({
        success: true,
        profile,
        stats: {
          totalViewed: history.length,
          uniquePerformers: uniquePerformers.size,
          uniqueGenres: uniqueGenres.size,
          topPerformers: [...uniquePerformers].slice(0, 5),
          topGenres: [...uniqueGenres].slice(0, 5),
        },
        message: 'プロファイルを生成しました',
      });
    } catch (error) {
      console.error('[User Profile API] Error:', error);
      return NextResponse.json({
        success: false,
        fallback: true,
        profile: null,
        message: 'プロファイル生成に失敗しました',
      });
    }
  };
}
