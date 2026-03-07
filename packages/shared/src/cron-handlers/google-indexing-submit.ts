/**
 * Google Indexing API 自動送信 Cron Handler
 *
 * 毎日、優先URL（人気女優+人気商品+静的ページ）を
 * Google Indexing APIに送信（1日200件制限）
 */

import { NextRequest, NextResponse } from 'next/server';
import { products, performers } from '@adult-v/database';
import { sql as _sql, desc as _desc, gt as _gt } from 'drizzle-orm';

const sqlOp = _sql as any;
const desc = _desc as any;
const gt = _gt as any;

interface GoogleIndexingSubmitDeps {
  verifyCronRequest: (request: NextRequest) => boolean | Promise<boolean>;
  unauthorizedResponse: () => NextResponse;
  getDb: () => any;
}

export function createGoogleIndexingSubmitHandler(deps: GoogleIndexingSubmitDeps) {
  const { verifyCronRequest, unauthorizedResponse, getDb } = deps;
  const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';
  const CRON_SECRET = process.env['CRON_SECRET'];

  async function POST(request: NextRequest) {
    if (!(await verifyCronRequest(request))) {
      return unauthorizedResponse();
    }

    try {
      const db = getDb();

      // 静的ページ
      const staticUrls = [
        SITE_URL,
        `${SITE_URL}/products`,
        `${SITE_URL}/actresses`,
        `${SITE_URL}/sales`,
        `${SITE_URL}/categories`,
        `${SITE_URL}/news`,
      ];

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // 新着商品（7日以内リリース、最大30件）— 最優先
      const newProducts = await db
        .select({ id: products.id })
        .from(products)
        .where(gt(products.releaseDate, sevenDaysAgo))
        .orderBy(desc(products.releaseDate))
        .limit(30);

      // 最近更新された商品（7日以内、最大50件）
      const recentProducts = await db
        .select({ id: products.id })
        .from(products)
        .where(gt(products.updatedAt, sevenDaysAgo))
        .orderBy(desc(products.updatedAt))
        .limit(50);

      // 人気女優TOP50（最近アクティブな女優を優先）
      const topPerformers = await db
        .select({ id: performers.id })
        .from(performers)
        .where(gt(performers.releaseCount, 5))
        .orderBy(desc(performers.latestReleaseDate))
        .limit(50);

      // 人気商品TOP50（レビュー数順）
      const topProducts = await db
        .select({ id: products.id })
        .from(products)
        .orderBy(desc(products.totalReviews))
        .limit(50);

      // URL構築（重複除去、200件制限）— 優先度順に追加
      const urlSet = new Set<string>(staticUrls);
      for (const p of newProducts) {
        urlSet.add(`${SITE_URL}/products/${p.id}`);
      }
      for (const p of recentProducts) {
        urlSet.add(`${SITE_URL}/products/${p.id}`);
      }
      for (const p of topPerformers) {
        urlSet.add(`${SITE_URL}/actress/${p.id}`);
      }
      for (const p of topProducts) {
        urlSet.add(`${SITE_URL}/products/${p.id}`);
      }

      const urls = Array.from(urlSet).slice(0, 200);

      // Google Indexing API送信（内部APIエンドポイント経由）
      const submitResponse = await fetch(`${SITE_URL}/api/indexing/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: CRON_SECRET ? `Bearer ${CRON_SECRET}` : '',
        },
        body: JSON.stringify({ urls, type: 'URL_UPDATED' }),
      });

      const submitResult = await submitResponse.json();

      // サイトマップpingも同時実行
      const pingResponse = await fetch(`${SITE_URL}/api/indexing/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: CRON_SECRET ? `Bearer ${CRON_SECRET}` : '',
        },
        body: JSON.stringify({ urls }),
      });

      const pingResult = await pingResponse.json();

      return NextResponse.json({
        success: true,
        totalUrls: urls.length,
        newProducts: newProducts.length,
        recentProducts: recentProducts.length,
        topPerformers: topPerformers.length,
        topProducts: topProducts.length,
        indexingResult: submitResult,
        pingResult,
      });
    } catch (error) {
      console.error('[Google Indexing Cron] Error:', error);
      return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
    }
  }

  async function GET(request: NextRequest) {
    if (!(await verifyCronRequest(request))) {
      return unauthorizedResponse();
    }

    try {
      const db = getDb();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentCount = await db
        .select({ count: sqlOp<number>`count(*)` })
        .from(products)
        .where(gt(products.updatedAt, sevenDaysAgo));

      const newCount = await db
        .select({ count: sqlOp<number>`count(*)` })
        .from(products)
        .where(gt(products.releaseDate, sevenDaysAgo));

      return NextResponse.json({
        status: 'ready',
        newProductReleases7d: Number(newCount[0]?.count || 0),
        recentProductUpdates7d: Number(recentCount[0]?.count || 0),
        dailyQuota: 200,
      });
    } catch (error) {
      return NextResponse.json({ error: 'Database error', details: String(error) }, { status: 500 });
    }
  }

  return { GET, POST };
}
