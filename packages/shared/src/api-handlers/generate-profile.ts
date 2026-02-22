import { NextRequest, NextResponse } from 'next/server';

export interface GenerateProfileHandlerDeps {
  getDb: () => any;
  getActressById: (id: string, locale: string) => Promise<any>;
  generateActressProfile: (params: any) => Promise<any>;
  products: any;
  productPerformers: any;
  productTags: any;
  productSources: any;
  tags: any;
  sql: any;
  desc: any;
  inArray: any;
}

export function createGenerateProfileHandler(deps: GenerateProfileHandlerDeps) {
  return async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const performerId = Number(id);
      if (isNaN(performerId)) {
        return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
      }

      const actress = await deps.getActressById(id, 'ja');
      if (!actress) {
        return NextResponse.json({ error: '女優が見つかりません' }, { status: 404 });
      }

      const db = deps.getDb();

      const productLinks = await db
        .select({ productId: deps.productPerformers.productId })
        .from(deps.productPerformers)
        .where(deps.sql`${deps.productPerformers.performerId} = ${performerId}`)
        .limit(100);

      const productIds = productLinks.map((p: any) => p.productId);

      let debutYear: number | undefined;
      if (productIds.length > 0) {
        const [oldestProduct] = await db
          .select({ releaseDate: deps.products.releaseDate })
          .from(deps.products)
          .where(deps.inArray(deps.products.id, productIds))
          .orderBy(deps.products.releaseDate)
          .limit(1);
        if (oldestProduct?.releaseDate) {
          debutYear = new Date(oldestProduct.releaseDate).getFullYear();
        }
      }

      let topGenres: string[] = [];
      if (productIds.length > 0) {
        const genreStats = await db
          .select({ tagId: deps.productTags.tagId, count: deps.sql`count(*)` })
          .from(deps.productTags)
          .where(deps.inArray(deps.productTags.productId, productIds))
          .groupBy(deps.productTags.tagId)
          .orderBy(deps.desc(deps.sql`count(*)`))
          .limit(10);
        if (genreStats.length > 0) {
          const tagIds = genreStats.map((g: any) => g.tagId);
          const tagData = await db.select({ id: deps.tags.id, name: deps.tags.name }).from(deps.tags).where(deps.inArray(deps.tags.id, tagIds));
          const tagMap = new Map(tagData.map((t: any) => [t.id, t.name]));
          topGenres = genreStats.map((g: any) => tagMap.get(g.tagId) || '').filter(Boolean);
        }
      }

      let topMakers: string[] = [];
      if (productIds.length > 0) {
        const makerStats = await db
          .select({ aspName: deps.productSources.aspName, count: deps.sql`count(*)` })
          .from(deps.productSources)
          .where(deps.inArray(deps.productSources.productId, productIds))
          .groupBy(deps.productSources.aspName)
          .orderBy(deps.desc(deps.sql`count(*)`))
          .limit(5);
        topMakers = makerStats.map((m: any) => m.aspName).filter(Boolean);
      }

      let recentWorks: string[] = [];
      if (productIds.length > 0) {
        const recentProducts = await db
          .select({ title: deps.products.title }).from(deps.products)
          .where(deps.inArray(deps.products.id, productIds))
          .orderBy(deps.desc(deps.products.releaseDate)).limit(5);
        recentWorks = recentProducts.map((p: any) => p.title);
      }

      const profile = await deps.generateActressProfile({
        name: actress.name,
        aliases: actress.aliases || undefined,
        totalWorks: actress.releaseCount || undefined,
        debutYear,
        topGenres: topGenres.length > 0 ? topGenres : undefined,
        topMakers: topMakers.length > 0 ? topMakers : undefined,
        recentWorks: recentWorks.length > 0 ? recentWorks : undefined,
      });

      if (!profile) {
        return NextResponse.json({ error: 'プロフィールの生成に失敗しました' }, { status: 500 });
      }
      return NextResponse.json(profile);
    } catch (error) {
      console.error('[Generate Profile API] Error:', error);
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
  };
}
