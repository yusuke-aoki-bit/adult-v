import { NextRequest, NextResponse } from 'next/server';

export interface RookiePerformersHandlerDeps {
  getDb: () => Promise<unknown>;
  performers: unknown;
  productPerformers: unknown;
  products: unknown;
  eq: (column: unknown, value: unknown) => unknown;
  desc: (column: unknown) => unknown;
  gte: (column: unknown, value: unknown) => unknown;
  and: (...conditions: unknown[]) => unknown;
  sql: unknown;
  count?: unknown;
}

export interface RookiePerformer {
  id: number;
  name: string;
  imageUrl: string | null;
  debutYear: number;
  productCount: number;
  latestProductTitle: string | null;
  latestProductDate: string | null;
}

/**
 * 新人女優ランキングAPI
 * - デビュー年が今年または前年の演者を「新人」と定義
 * - 作品数順でランキング
 */
export function createRookiePerformersHandler(deps: RookiePerformersHandlerDeps) {
  return async (request: NextRequest) => {
    const { getDb, performers, productPerformers, products, eq, desc, gte, and, sql } = deps;

    try {
      const db = await getDb() as Record<string, unknown>;
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '20', 10);
      const page = parseInt(searchParams.get('page') || '1', 10);
      const offset = (page - 1) * limit;

      // 新人の定義: 今年または前年デビュー
      const currentYear = new Date().getFullYear();
      const rookieYear = currentYear - 1; // 今年と前年を新人とする

      // 新人演者を取得（作品数でソート）
      const rookiePerformersQuery = await (db.select as CallableFunction)({
        id: (performers as Record<string, unknown>).id,
        name: (performers as Record<string, unknown>).name,
        imageUrl: (performers as Record<string, unknown>).profileImageUrl,
        debutYear: (performers as Record<string, unknown>).debutYear,
        productCount: (sql as CallableFunction)`CAST(COUNT(DISTINCT ${(productPerformers as Record<string, unknown>).productId}) AS INTEGER)`,
      })
        .from(performers)
        .leftJoin(
          productPerformers,
          eq((productPerformers as Record<string, unknown>).performerId, (performers as Record<string, unknown>).id)
        )
        .where(
          gte((performers as Record<string, unknown>).debutYear, rookieYear)
        )
        .groupBy(
          (performers as Record<string, unknown>).id,
          (performers as Record<string, unknown>).name,
          (performers as Record<string, unknown>).profileImageUrl,
          (performers as Record<string, unknown>).debutYear
        )
        .orderBy(desc((sql as CallableFunction)`COUNT(DISTINCT ${(productPerformers as Record<string, unknown>).productId})`))
        .limit(limit)
        .offset(offset);

      // 最新作品情報を取得
      const rookieIds = rookiePerformersQuery.map((p: { id: number }) => p.id);

      let latestProductsMap: Record<number, { title: string; releaseDate: string }> = {};

      if (rookieIds.length > 0) {
        // 各演者の最新作品を取得
        const latestProducts = await (db.select as CallableFunction)({
          performerId: (productPerformers as Record<string, unknown>).performerId,
          title: (products as Record<string, unknown>).title,
          releaseDate: (products as Record<string, unknown>).releaseDate,
        })
          .from(productPerformers)
          .innerJoin(
            products,
            eq((productPerformers as Record<string, unknown>).productId, (products as Record<string, unknown>).id)
          )
          .where(
            (sql as CallableFunction)`${(productPerformers as Record<string, unknown>).performerId} = ANY(${rookieIds})`
          )
          .orderBy(desc((products as Record<string, unknown>).releaseDate));

        // 各演者の最新作品をマップに格納（最初に見つかったものが最新）
        for (const product of latestProducts as Array<{ performerId: number; title: string; releaseDate: string }>) {
          if (!latestProductsMap[product.performerId]) {
            latestProductsMap[product.performerId] = {
              title: product.title,
              releaseDate: product.releaseDate,
            };
          }
        }
      }

      // 結果を整形
      const result: RookiePerformer[] = rookiePerformersQuery.map((p: {
        id: number;
        name: string;
        imageUrl: string | null;
        debutYear: number;
        productCount: number;
      }) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        debutYear: p.debutYear,
        productCount: p.productCount,
        latestProductTitle: latestProductsMap[p.id]?.title || null,
        latestProductDate: latestProductsMap[p.id]?.releaseDate || null,
      }));

      // 総数を取得
      const totalCountResult = await (db.select as CallableFunction)({
        count: (sql as CallableFunction)`COUNT(*)`,
      })
        .from(performers)
        .where(
          gte((performers as Record<string, unknown>).debutYear, rookieYear)
        );

      const totalCount = Number(totalCountResult[0]?.count || 0);

      return NextResponse.json({
        performers: result,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
        meta: {
          rookieYear,
          currentYear,
        },
      });
    } catch (error) {
      console.error('Failed to fetch rookie performers:', error);
      return NextResponse.json({ error: 'Failed to fetch rookie performers' }, { status: 500 });
    }
  };
}
