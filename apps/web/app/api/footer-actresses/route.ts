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

// フォールバック用の静的データ（DBにデータがない場合）
const FALLBACK_ACTRESSES = [
  { id: 61646, name: '新城由衣' },
  { id: 61645, name: '緒方千乃' },
  { id: 20898, name: '羽田真里' },
  { id: 25188, name: '仲間あずみ' },
  { id: 66312, name: '白杞りり' },
  { id: 30618, name: '吉岡蓮美' },
  { id: 14631, name: '青木桃' },
  { id: 47684, name: '森田みゆ' },
];

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

    // DBにデータがない場合はフォールバック
    if (actresses.length === 0) {
      return NextResponse.json({
        actresses: FALLBACK_ACTRESSES,
        source: 'fallback',
      });
    }

    return NextResponse.json({
      actresses: actresses.map(a => ({ id: a.id, name: a.name })),
      source: 'database',
      meta: {
        count: actresses.length,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to fetch footer actresses:', error);

    // エラー時もフォールバック
    return NextResponse.json({
      actresses: FALLBACK_ACTRESSES,
      source: 'fallback',
      error: 'Database error',
    });
  }
}
