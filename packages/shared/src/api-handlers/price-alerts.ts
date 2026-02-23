import { NextRequest, NextResponse } from 'next/server';
import { createApiErrorResponse } from '../lib/api-logger';

export interface PriceAlertsHandlerDeps {
  getDb: () => Promise<unknown>;
  priceAlerts: unknown;
  pushSubscriptions: unknown;
  products: unknown;
  productSources: unknown;
  eq: (column: unknown, value: unknown) => unknown;
  and: (...conditions: unknown[]) => unknown;
  desc: (column: unknown) => unknown;
  sql: unknown;
}

export interface PriceAlertInput {
  endpoint: string; // プッシュ通知のエンドポイント
  productId: number;
  targetPrice?: number;
  notifyOnAnySale?: boolean;
}

/**
 * 価格アラート登録APIハンドラー
 * POST: アラート登録/更新
 * GET: 登録済みアラート一覧取得
 * DELETE: アラート削除
 */
export function createPriceAlertsHandler(deps: PriceAlertsHandlerDeps) {
  return async (request: NextRequest) => {
    const { getDb, priceAlerts, pushSubscriptions, products, productSources, eq, and, sql } = deps;

    try {
      const db = (await getDb()) as Record<string, unknown>;

      if (request.method === 'POST') {
        const body = (await request.json()) as PriceAlertInput;
        const { endpoint, productId, targetPrice, notifyOnAnySale = true } = body;

        if (!endpoint || !productId) {
          return NextResponse.json({ error: 'endpoint and productId are required' }, { status: 400 });
        }

        // 購読情報を取得
        const subscriptionResult = await (db['select'] as CallableFunction)()
          .from(pushSubscriptions)
          .where(eq((pushSubscriptions as Record<string, unknown>)['endpoint'], endpoint))
          .limit(1);

        if (subscriptionResult.length === 0) {
          return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        const subscriptionId = subscriptionResult[0]['id'];

        // 既存のアラートをチェック
        const existingAlert = await (db['select'] as CallableFunction)()
          .from(priceAlerts)
          .where(
            and(
              eq((priceAlerts as Record<string, unknown>)['subscriptionId'], subscriptionId),
              eq((priceAlerts as Record<string, unknown>)['productId'], productId),
            ),
          )
          .limit(1);

        if (existingAlert.length > 0) {
          // 更新
          await (db['update'] as CallableFunction)(priceAlerts)
            .set({
              targetPrice,
              notifyOnAnySale,
              isActive: true,
              updatedAt: new Date(),
            })
            .where(eq((priceAlerts as Record<string, unknown>)['id'], existingAlert[0]['id']));

          return NextResponse.json({ success: true, action: 'updated', alertId: existingAlert[0]['id'] });
        } else {
          // 新規登録
          const insertResult = await (db['insert'] as CallableFunction)(priceAlerts)
            .values({
              subscriptionId,
              productId,
              targetPrice,
              notifyOnAnySale,
            })
            .returning();

          return NextResponse.json({ success: true, action: 'created', alertId: insertResult[0]['id'] });
        }
      }

      if (request.method === 'GET') {
        const { searchParams } = new URL(request['url']);
        const endpoint = searchParams.get('endpoint');

        if (!endpoint) {
          return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
        }

        // 購読情報を取得
        const subscriptionResult = await (db['select'] as CallableFunction)()
          .from(pushSubscriptions)
          .where(eq((pushSubscriptions as Record<string, unknown>)['endpoint'], endpoint))
          .limit(1);

        if (subscriptionResult.length === 0) {
          return NextResponse.json({ alerts: [] });
        }

        const subscriptionId = subscriptionResult[0]['id'];

        // アラート一覧を取得
        const alerts = await (db['select'] as CallableFunction)({
          id: (priceAlerts as Record<string, unknown>)['id'],
          productId: (priceAlerts as Record<string, unknown>)['productId'],
          targetPrice: (priceAlerts as Record<string, unknown>)['targetPrice'],
          notifyOnAnySale: (priceAlerts as Record<string, unknown>)['notifyOnAnySale'],
          isActive: (priceAlerts as Record<string, unknown>)['isActive'],
          createdAt: (priceAlerts as Record<string, unknown>)['createdAt'],
          productTitle: (products as Record<string, unknown>)['title'],
          productThumbnail: (products as Record<string, unknown>)['defaultThumbnailUrl'],
        })
          .from(priceAlerts)
          .innerJoin(
            products,
            eq((priceAlerts as Record<string, unknown>)['productId'], (products as Record<string, unknown>)['id']),
          )
          .where(
            and(
              eq((priceAlerts as Record<string, unknown>)['subscriptionId'], subscriptionId),
              eq((priceAlerts as Record<string, unknown>)['isActive'], true),
            ),
          );

        return NextResponse.json({ alerts });
      }

      if (request.method === 'DELETE') {
        const body = (await request.json()) as { endpoint: string; productId: number };
        const { endpoint, productId } = body;

        if (!endpoint || !productId) {
          return NextResponse.json({ error: 'endpoint and productId are required' }, { status: 400 });
        }

        // 購読情報を取得
        const subscriptionResult = await (db['select'] as CallableFunction)()
          .from(pushSubscriptions)
          .where(eq((pushSubscriptions as Record<string, unknown>)['endpoint'], endpoint))
          .limit(1);

        if (subscriptionResult.length === 0) {
          return NextResponse.json({ success: true }); // 購読がなければ何もしない
        }

        const subscriptionId = subscriptionResult[0]['id'];

        // アラートを非アクティブ化
        await (db['update'] as CallableFunction)(priceAlerts)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq((priceAlerts as Record<string, unknown>)['subscriptionId'], subscriptionId),
              eq((priceAlerts as Record<string, unknown>)['productId'], productId),
            ),
          );

        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    } catch (error) {
      return createApiErrorResponse(error, 'Internal server error', 500, {
        endpoint: '/api/price-alerts',
      });
    }
  };
}
