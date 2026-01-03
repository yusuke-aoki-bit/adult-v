/**
 * フッター用女優リストAPIハンドラ
 * GSCデータに基づいて動的に更新される女優リストを返す
 */

import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';

export interface FooterActressesHandlerDeps {
  getDb: () => {
    select: (columns: Record<string, unknown>) => {
      from: (table: unknown) => {
        orderBy: (column: unknown) => {
          limit: (n: number) => Promise<Array<{
            id: number;
            name: string;
            impressions: number | null;
            position: number | null;
          }>>;
        };
      };
    };
  };
  footerFeaturedActresses: {
    performerId: unknown;
    performerName: unknown;
    impressions: unknown;
    position: unknown;
    priorityScore: unknown;
  };
}

export function createFooterActressesHandler(deps: FooterActressesHandlerDeps) {
  return async function GET() {
    const { getDb, footerFeaturedActresses } = deps;

    try {
      const db = getDb();

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
      console.error('Failed to fetch footer actresses:', error);

      // エラー時は空配列を返す（嘘のデータを返さない）
      return NextResponse.json({
        actresses: [],
        source: 'error',
        error: 'Database error',
      });
    }
  };
}
