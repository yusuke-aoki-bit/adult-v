/**
 * フッター用女優リストAPI
 * GSCデータに基づいて動的に更新される女優リストを返す
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { footerFeaturedActresses } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

// 1時間キャッシュ
export const revalidate = 3600;

export async function GET() {
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
      actresses: actresses.map((a) => ({ id: a.id, name: a.name })),
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
}
