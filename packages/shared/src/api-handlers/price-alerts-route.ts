import { NextRequest, NextResponse } from 'next/server';

export interface PriceAlertsRouteHandlerDeps {
  getDb: () => any;
  sql: any;
}

export function createPriceAlertsRouteHandler(deps: PriceAlertsRouteHandlerDeps) {
  async function getSubscriptionByEndpoint(db: any, endpoint: string) {
    const result = await db.execute(
      deps.sql`SELECT id, endpoint, keys FROM push_subscriptions WHERE endpoint = ${endpoint} LIMIT 1`,
    );
    return (result.rows[0] as { id: number; endpoint: string; keys: unknown } | undefined) || null;
  }

  async function POST(request: NextRequest) {
    try {
      const db = deps.getDb();
      const body = await request.json();
      const { endpoint, productId, targetPrice, notifyOnAnySale = true } = body;

      if (!endpoint || !productId) {
        return NextResponse.json({ error: 'endpoint and productId are required' }, { status: 400 });
      }

      const subscription = await getSubscriptionByEndpoint(db, endpoint);
      if (!subscription) {
        return NextResponse.json(
          { error: 'Subscription not found. Please enable notifications first.' },
          { status: 404 },
        );
      }

      const existingResult = await db.execute(deps.sql`
        SELECT id FROM price_alerts WHERE subscription_id = ${subscription.id} AND product_id = ${productId} LIMIT 1
      `);

      if (existingResult.rows.length > 0) {
        const existingId = (existingResult.rows[0] as { id: number }).id;
        await db.execute(deps.sql`
          UPDATE price_alerts SET target_price = ${targetPrice || null}, notify_on_any_sale = ${notifyOnAnySale}, is_active = true, updated_at = NOW() WHERE id = ${existingId}
        `);
        return NextResponse.json({ success: true, action: 'updated', alertId: existingId });
      } else {
        const insertResult = await db.execute(deps.sql`
          INSERT INTO price_alerts (subscription_id, product_id, target_price, notify_on_any_sale) VALUES (${subscription.id}, ${productId}, ${targetPrice || null}, ${notifyOnAnySale}) RETURNING id
        `);
        return NextResponse.json({
          success: true,
          action: 'created',
          alertId: (insertResult.rows[0] as { id: number }).id,
        });
      }
    } catch (error) {
      console.error('Price alerts POST error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  async function GET(request: NextRequest) {
    try {
      const db = deps.getDb();
      const { searchParams } = new URL(request.url);
      const endpoint = searchParams.get('endpoint');

      if (!endpoint) {
        return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
      }

      const subscription = await getSubscriptionByEndpoint(db, endpoint);
      if (!subscription) return NextResponse.json({ alerts: [] });

      const alertsResult = await db.execute(deps.sql`
        SELECT pa.id, pa.product_id as "productId", pa.target_price as "targetPrice", pa.notify_on_any_sale as "notifyOnAnySale",
               pa.is_active as "isActive", pa.created_at as "createdAt", p.title as "productTitle", p.default_thumbnail_url as "productThumbnail"
        FROM price_alerts pa INNER JOIN products p ON pa.product_id = p.id
        WHERE pa.subscription_id = ${subscription.id} AND pa.is_active = true ORDER BY pa.created_at DESC
      `);
      return NextResponse.json({ alerts: alertsResult.rows });
    } catch (error) {
      console.error('Price alerts GET error:', error);
      return NextResponse.json({ alerts: [], fallback: true });
    }
  }

  async function DELETE(request: NextRequest) {
    try {
      const db = deps.getDb();
      const body = await request.json();
      const { endpoint, productId } = body;

      if (!endpoint || !productId) {
        return NextResponse.json({ error: 'endpoint and productId are required' }, { status: 400 });
      }

      const subscription = await getSubscriptionByEndpoint(db, endpoint);
      if (!subscription) return NextResponse.json({ success: true });

      await db.execute(deps.sql`
        UPDATE price_alerts SET is_active = false, updated_at = NOW() WHERE subscription_id = ${subscription.id} AND product_id = ${productId}
      `);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Price alerts DELETE error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  return { GET, POST, DELETE };
}
