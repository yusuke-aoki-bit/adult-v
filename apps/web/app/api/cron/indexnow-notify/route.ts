/**
 * IndexNow 自動通知 Cron Job
 *
 * 最近更新・追加されたページを検索エンジンに自動通知
 * Cloud Scheduler等で定期実行（推奨: 1時間ごと）
 *
 * POST /api/cron/indexnow-notify
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products, performers, productPerformers } from '@/lib/db/schema';
import { sql, desc, gt, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';
const CRON_SECRET = process.env['CRON_SECRET'];

export async function POST(request: NextRequest) {
  // 認証チェック（CRON_SECRET未設定時も拒否: safe-by-default）
  const authHeader = request.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // 過去2時間以内に更新されたコンテンツを取得
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
      const productIds = recentProducts.map(p => p.id);
      const performersOfRecentProducts = await db
        .selectDistinct({ performerId: productPerformers.performerId })
        .from(productPerformers)
        .where(inArray(productPerformers.productId, productIds))
        .limit(200);
      recentPerformerIds = performersOfRecentProducts.map(p => p.performerId);
    }

    // URLリストを生成
    const urls: string[] = [];

    // 静的ページも常に通知（優先度高）
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

    // 商品ページURL
    for (const product of recentProducts) {
      urls.push(`${SITE_URL}/products/${product.id}`);
    }

    // 女優ページURL（最近更新された商品に出演している女優）
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

// GET: ステータス確認用
export async function GET(request: NextRequest) {
  // 認証チェック（CRON_SECRET未設定時も拒否: safe-by-default）
  const authHeader = request.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // 最近の更新数をカウント
    const productCount = await db
      .select({ count: sql<number>`count(*)` })
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
