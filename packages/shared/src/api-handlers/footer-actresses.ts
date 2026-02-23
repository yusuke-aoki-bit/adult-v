import { NextResponse } from 'next/server';
import { desc, type AnyColumn } from 'drizzle-orm';
import { logDbErrorAndReturn } from '../lib/db-logger';

export interface FooterActressesHandlerDeps {
  getDb: () => unknown;
  footerFeaturedActresses: {
    performerId: AnyColumn;
    performerName: AnyColumn;
    impressions: AnyColumn;
    position: AnyColumn;
    priorityScore: AnyColumn;
  };
}

export function createFooterActressesHandler(deps: FooterActressesHandlerDeps) {
  return async function GET() {
    const { getDb, footerFeaturedActresses } = deps;

    try {
      const db = getDb() as {
        select: (cols: Record<string, unknown>) => {
          from: (table: unknown) => {
            orderBy: (col: unknown) => {
              limit: (
                n: number,
              ) => Promise<Array<{ id: number; name: string; impressions: number | null; position: number | null }>>;
            };
          };
        };
      };

      // DBから優先度順で取得
      const actresses = await db
        .select({
          id: footerFeaturedActresses.performerId,
          name: footerFeaturedActresses.performerName,
          impressions: footerFeaturedActresses.impressions,
          position: footerFeaturedActresses.position,
        })
        .from(footerFeaturedActresses)
        .orderBy(desc(footerFeaturedActresses.priorityScore))
        .limit(8);

      return NextResponse.json({
        actresses: actresses.map((a: { id: number; name: string }) => ({ id: a.id, name: a.name })),
        source: 'database',
        meta: {
          count: actresses.length,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logDbErrorAndReturn(error, [], 'getFooterActresses');

      // エラー時は空配列を返す
      return NextResponse.json({
        actresses: [],
        source: 'error',
        error: 'Database error',
      });
    }
  };
}
