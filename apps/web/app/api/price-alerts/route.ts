/**
 * Price Alerts API Route
 *
 * POST: 価格アラート登録/更新
 * GET: 登録済みアラート一覧取得
 * DELETE: アラート削除
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// DB型定義
type DbInstance = ReturnType<typeof getDb>;

async function getSubscriptionByEndpoint(db: DbInstance, endpoint: string) {
  const result = await db.execute(
    sql`SELECT id, endpoint, keys FROM push_subscriptions WHERE endpoint = ${endpoint} LIMIT 1`
  );
  return (result.rows[0] as { id: number; endpoint: string; keys: unknown } | undefined) || null;
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { endpoint, productId, targetPrice, notifyOnAnySale = true } = body;

    if (!endpoint || !productId) {
      return NextResponse.json({ error: 'endpoint and productId are required' }, { status: 400 });
    }

    // 購読情報を取得
    const subscription = await getSubscriptionByEndpoint(db, endpoint);

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found. Please enable notifications first.' }, { status: 404 });
    }

    const subscriptionId = subscription.id;

    // 既存のアラートをチェック
    const existingResult = await db.execute(
      sql`
        SELECT id FROM price_alerts
        WHERE subscription_id = ${subscriptionId}
          AND product_id = ${productId}
        LIMIT 1
      `
    );

    if (existingResult.rows.length > 0) {
      const existingId = (existingResult.rows[0] as { id: number }).id;
      // 更新
      await db.execute(
        sql`
          UPDATE price_alerts
          SET target_price = ${targetPrice || null},
              notify_on_any_sale = ${notifyOnAnySale},
              is_active = true,
              updated_at = NOW()
          WHERE id = ${existingId}
        `
      );

      return NextResponse.json({ success: true, action: 'updated', alertId: existingId });
    } else {
      // 新規登録
      const insertResult = await db.execute(
        sql`
          INSERT INTO price_alerts (subscription_id, product_id, target_price, notify_on_any_sale)
          VALUES (${subscriptionId}, ${productId}, ${targetPrice || null}, ${notifyOnAnySale})
          RETURNING id
        `
      );

      return NextResponse.json({ success: true, action: 'created', alertId: (insertResult.rows[0] as { id: number }).id });
    }
  } catch (error) {
    console.error('Price alerts POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
    }

    // 購読情報を取得
    const subscription = await getSubscriptionByEndpoint(db, endpoint);

    if (!subscription) {
      return NextResponse.json({ alerts: [] });
    }

    // アラート一覧を取得
    const alertsResult = await db.execute(
      sql`
        SELECT
          pa.id,
          pa.product_id as "productId",
          pa.target_price as "targetPrice",
          pa.notify_on_any_sale as "notifyOnAnySale",
          pa.is_active as "isActive",
          pa.created_at as "createdAt",
          p.title as "productTitle",
          p.default_thumbnail_url as "productThumbnail"
        FROM price_alerts pa
        INNER JOIN products p ON pa.product_id = p.id
        WHERE pa.subscription_id = ${subscription.id}
          AND pa.is_active = true
        ORDER BY pa.created_at DESC
      `
    );

    return NextResponse.json({ alerts: alertsResult.rows });
  } catch (error) {
    console.error('Price alerts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { endpoint, productId } = body;

    if (!endpoint || !productId) {
      return NextResponse.json({ error: 'endpoint and productId are required' }, { status: 400 });
    }

    // 購読情報を取得
    const subscription = await getSubscriptionByEndpoint(db, endpoint);

    if (!subscription) {
      return NextResponse.json({ success: true });
    }

    // アラートを非アクティブ化
    await db.execute(
      sql`
        UPDATE price_alerts
        SET is_active = false, updated_at = NOW()
        WHERE subscription_id = ${subscription.id}
          AND product_id = ${productId}
      `
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Price alerts DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
