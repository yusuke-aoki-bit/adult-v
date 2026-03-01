/**
 * サイトマップping + IndexNow エンドポイント
 *
 * POST /api/indexing/ping
 * Body: { urls?: string[] }
 *
 * Google: サイトマップpingはdeprecatedだがまだ動作する
 * Bing/Yandex: IndexNow APIで即時通知
 * 認証: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';
const INDEXNOW_KEY = process.env['INDEXNOW_KEY'] || '';

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env['CRON_SECRET'];
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const urls: string[] = body.urls || [];

    const results: Record<string, unknown> = {};

    // 1. Google Sitemap Ping
    try {
      const sitemapUrl = `${BASE_URL}/sitemap.xml`;
      const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
      const googleRes = await fetch(googlePingUrl);
      results.google = { ok: googleRes.ok, status: googleRes.status };
    } catch (error) {
      results.google = { ok: false, error: String(error) };
    }

    // 2. Bing IndexNow (supports Bing, Yandex, Naver, Seznam)
    if (INDEXNOW_KEY && urls.length > 0) {
      try {
        const indexNowRes = await fetch('https://api.indexnow.org/IndexNow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: new URL(BASE_URL).hostname,
            key: INDEXNOW_KEY,
            keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
            urlList: urls.slice(0, 10000),
          }),
        });
        results.indexNow = { ok: indexNowRes.ok, status: indexNowRes.status };
      } catch (error) {
        results.indexNow = { ok: false, error: String(error) };
      }
    } else if (!INDEXNOW_KEY) {
      results.indexNow = { skipped: true, reason: 'INDEXNOW_KEY not configured' };
    }

    // 3. Bing Sitemap Ping
    try {
      const sitemapUrl = `${BASE_URL}/sitemap.xml`;
      const bingPingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
      const bingRes = await fetch(bingPingUrl);
      results.bing = { ok: bingRes.ok, status: bingRes.status };
    } catch (error) {
      results.bing = { ok: false, error: String(error) };
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[Indexing Ping] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
