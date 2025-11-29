import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const db = getDb();

    // 1. ASP別 総合収集状況
    const aspSummary = await db.execute(sql`
      SELECT
        ps.asp_name,
        COUNT(DISTINCT ps.product_id) as total_products,
        COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NOT NULL AND p.default_thumbnail_url != '' AND p.default_thumbnail_url NOT LIKE '%placehold%' THEN ps.product_id END) as with_image,
        ROUND(COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NOT NULL AND p.default_thumbnail_url != '' AND p.default_thumbnail_url NOT LIKE '%placehold%' THEN ps.product_id END)::numeric / NULLIF(COUNT(DISTINCT ps.product_id), 0) * 100, 1) as image_pct,
        COUNT(DISTINCT pv.product_id) as with_video,
        ROUND(COUNT(DISTINCT pv.product_id)::numeric / NULLIF(COUNT(DISTINCT ps.product_id), 0) * 100, 1) as video_pct,
        COUNT(DISTINCT pp.product_id) as with_performer,
        ROUND(COUNT(DISTINCT pp.product_id)::numeric / NULLIF(COUNT(DISTINCT ps.product_id), 0) * 100, 1) as performer_pct
      FROM product_sources ps
      JOIN products p ON ps.product_id = p.id
      LEFT JOIN product_videos pv ON ps.product_id = pv.product_id
      LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
      GROUP BY ps.asp_name
      ORDER BY COUNT(DISTINCT ps.product_id) DESC
    `);

    // 2. 動画数詳細
    const videoStats = await db.execute(sql`
      SELECT
        asp_name,
        COUNT(*) as total_videos,
        COUNT(DISTINCT product_id) as products_with_video
      FROM product_videos
      GROUP BY asp_name
      ORDER BY total_videos DESC
    `);

    // 3. 演者統計
    // performer_aliasesテーブルが存在しない場合があるため別クエリで取得
    let totalAliases = '0';
    try {
      const aliasResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM performer_aliases`);
      totalAliases = String(aliasResult.rows[0]?.cnt ?? 0);
    } catch {
      // テーブルが存在しない場合は0
    }

    const performerStats = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM performers) as total_performers,
        (SELECT COUNT(*) FROM performers WHERE image_url IS NOT NULL AND image_url != '') as with_image,
        0 as with_wiki,
        (SELECT COUNT(DISTINCT performer_id) FROM product_performers) as with_products,
        (SELECT COUNT(*) FROM product_performers) as total_links
    `);

    // total_aliasesを追加
    const performerStatsData = { ...(performerStats.rows[0] as object), total_aliases: totalAliases };

    // 4. 全体統計
    const totalStats = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM products WHERE default_thumbnail_url IS NOT NULL AND default_thumbnail_url != '' AND default_thumbnail_url NOT LIKE '%placehold%') as products_with_image,
        (SELECT COUNT(DISTINCT product_id) FROM product_videos) as products_with_video,
        (SELECT COUNT(*) FROM product_videos) as total_videos,
        (SELECT COUNT(DISTINCT product_id) FROM product_performers) as products_with_performer
    `);

    // 5. 人気女優TOP10
    const topPerformers = await db.execute(sql`
      SELECT
        pe.id, pe.name,
        CASE WHEN pe.image_url IS NOT NULL AND pe.image_url != '' THEN true ELSE false END as has_image,
        false as has_wiki,
        COUNT(pp.product_id) as product_count
      FROM performers pe
      JOIN product_performers pp ON pe.id = pp.performer_id
      GROUP BY pe.id, pe.name, pe.image_url
      ORDER BY product_count DESC
      LIMIT 10
    `);

    // 6. 画像なし・作品多い女優TOP10
    const noImagePerformers = await db.execute(sql`
      SELECT
        pe.id, pe.name,
        COUNT(pp.product_id) as product_count
      FROM performers pe
      JOIN product_performers pp ON pe.id = pp.performer_id
      WHERE pe.image_url IS NULL OR pe.image_url = ''
      GROUP BY pe.id, pe.name
      ORDER BY product_count DESC
      LIMIT 10
    `);

    return NextResponse.json({
      aspSummary: aspSummary.rows,
      videoStats: videoStats.rows,
      performerStats: performerStatsData,
      totalStats: totalStats.rows[0],
      topPerformers: topPerformers.rows,
      noImagePerformers: noImagePerformers.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
