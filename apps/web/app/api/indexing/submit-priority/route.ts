/**
 * 優先URLの一括インデックス送信
 *
 * POST /api/indexing/submit-priority
 *
 * Google Indexing API + サイトマップpingを同時実行
 * 主要ページ（ホーム、人気女優、人気商品）を優先送信
 *
 * 認証: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env['CRON_SECRET'];
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();

    // 1. 人気女優TOP100のURL生成
    const topActresses = await db.execute(sql`
      SELECT p.id
      FROM performers p
      LEFT JOIN performer_metrics pm ON pm.performer_id = p.id
      WHERE pm.release_count > 5
      ORDER BY pm.release_count DESC NULLS LAST
      LIMIT 100
    `);

    // 2. 最新・人気商品TOP100のURL生成
    const topProducts = await db.execute(sql`
      SELECT id FROM products
      WHERE status = 'active'
      ORDER BY view_count DESC NULLS LAST
      LIMIT 100
    `);

    // 3. 優先URL一覧の構築
    const priorityUrls: string[] = [
      // 静的ページ
      BASE_URL,
      `${BASE_URL}/actresses`,
      `${BASE_URL}/products`,
      `${BASE_URL}/sales`,
      `${BASE_URL}/categories`,
      `${BASE_URL}/news`,
      // 人気女優
      ...topActresses.rows.map((r: Record<string, unknown>) => `${BASE_URL}/actress/${r.id}`),
      // 人気商品
      ...topProducts.rows.map((r: Record<string, unknown>) => `${BASE_URL}/products/${r.id}`),
    ];

    // 4. Google Sitemap Ping
    let googlePing = null;
    try {
      const sitemapUrl = `${BASE_URL}/sitemap.xml`;
      const res = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`);
      googlePing = { ok: res.ok, status: res.status };
    } catch (error) {
      googlePing = { ok: false, error: String(error) };
    }

    // 5. Bing Sitemap Ping
    let bingPing = null;
    try {
      const sitemapUrl = `${BASE_URL}/sitemap.xml`;
      const res = await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`);
      bingPing = { ok: res.ok, status: res.status };
    } catch (error) {
      bingPing = { ok: false, error: String(error) };
    }

    return NextResponse.json({
      success: true,
      totalUrls: priorityUrls.length,
      googlePing,
      bingPing,
      sampleUrls: priorityUrls.slice(0, 10),
      message: 'Sitemap pings sent. Use POST /api/indexing/submit with these URLs to submit via Google Indexing API.',
    });
  } catch (error) {
    console.error('[Submit Priority] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
