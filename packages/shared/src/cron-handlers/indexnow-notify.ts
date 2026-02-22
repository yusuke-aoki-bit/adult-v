/**
 * IndexNow 自動通知 Cron Handler
 *
 * 最近更新・追加されたページを検索エンジンに自動通知
 */

import { NextRequest, NextResponse } from 'next/server';
import { products, performers, productPerformers } from '@adult-v/database';
import { sql as _sql, desc as _desc, gt as _gt, inArray as _inArray } from 'drizzle-orm';

// Cast to bridge drizzle-orm type mismatch between packages
const sqlOp = _sql as any;
const desc = _desc as any;
const gt = _gt as any;
const inArray = _inArray as any;

interface IndexNowNotifyDeps {
  verifyCronRequest: (request: NextRequest) => boolean | Promise<boolean>;
  unauthorizedResponse: () => NextResponse;
  getDb: () => any;
  siteBaseUrl?: string;
}

export function createIndexNowNotifyHandler(deps: IndexNowNotifyDeps) {
  const { verifyCronRequest, unauthorizedResponse, getDb } = deps;
  const SITE_URL = deps.siteBaseUrl || process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';
  const CRON_SECRET = process.env['CRON_SECRET'];

  async function POST(request: NextRequest) {
    if (!await verifyCronRequest(request)) {
      return unauthorizedResponse();
    }

    try {
      const db = getDb();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      // 最近更新された商品（最大500件）
      const recentProducts = await db
        .select({ id: products.id })
        .from(products)
        .where(gt(products.updatedAt, twoHoursAgo))
        .orderBy(desc(products.updatedAt))
        .limit(500);

      // 最近更新された商品に出演している女優を取得
      let recentPerformerIds: number[] = [];
      if (recentProducts.length > 0) {
        const productIds = recentProducts.map((p: { id: number }) => p.id);
        const performersOfRecentProducts = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productPerformers)
          .where(inArray(productPerformers.productId, productIds))
          .limit(200);
        recentPerformerIds = performersOfRecentProducts.map((p: { performerId: number }) => p.performerId);
      }

      // URLリストを生成
      const urls: string[] = [];

      const staticPages = [
        '/',
        '/products',
        '/actresses',
        '/sales',
        '/categories',
        '/tags',
        '/rookies',
        '/hidden-gems',
        '/daily-pick',
      ];
      urls.push(...staticPages.map((p) => `${SITE_URL}${p}`));

      for (const product of recentProducts) {
        urls.push(`${SITE_URL}/products/${product.id}`);
      }

      for (const performerId of recentPerformerIds) {
        urls.push(`${SITE_URL}/actress/${performerId}`);
      }

      if (urls.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No recent updates to notify',
          submitted: 0,
        });
      }

      // IndexNow APIを呼び出し
      const indexNowResponse = await fetch(`${SITE_URL}/api/indexnow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: CRON_SECRET ? `Bearer ${CRON_SECRET}` : '',
        },
        body: JSON.stringify({ urls }),
      });

      const result = await indexNowResponse.json();

      return NextResponse.json({
        success: true,
        submitted: urls.length,
        recentProducts: recentProducts.length,
        recentPerformers: recentPerformerIds.length,
        staticPages: staticPages.length,
        indexNowResult: result,
      });
    } catch (error) {
      console.error('[IndexNow Cron] Error:', error);
      return NextResponse.json(
        { error: 'Internal server error', details: String(error) },
        { status: 500 }
      );
    }
  }

  async function GET(request: NextRequest) {
    if (!await verifyCronRequest(request)) {
      return unauthorizedResponse();
    }

    try {
      const db = getDb();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const productCount = await db
        .select({ count: sqlOp<number>`count(*)` })
        .from(products)
        .where(gt(products.updatedAt, twoHoursAgo));

      return NextResponse.json({
        status: 'ready',
        recentProductUpdates: Number(productCount[0]?.count || 0),
        windowHours: 2,
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Database error', details: String(error) },
        { status: 500 }
      );
    }
  }

  return { GET, POST };
}
