/**
 * 価格アラートチェックバッチ
 *
 * 処理フロー:
 * 1. アクティブな価格アラートを取得
 * 2. 対象商品の現在価格をチェック
 * 3. 条件を満たす場合、プッシュ通知を送信
 * 4. 通知履歴を記録
 *
 * Usage:
 *   npx tsx packages/crawlers/src/enrichment/price-alert-check.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and, sql, isNull, or, lte, gt } from 'drizzle-orm';
import {
  sendPushNotification,
  createPriceAlertPayload,
  createTargetPriceReachedPayload,
  type PushSubscriptionData,
} from '@adult-v/shared/lib/push-notification-service';

// VAPID設定
const VAPID_SUBJECT = process.env['VAPID_SUBJECT'] || 'mailto:admin@example.com';
const VAPID_PUBLIC_KEY = process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY'] || '';
const VAPID_PRIVATE_KEY = process.env['VAPID_PRIVATE_KEY'] || '';

// 再通知間隔（24時間）
const RENOTIFY_INTERVAL_HOURS = 24;

interface PriceAlert {
  id: number;
  subscriptionId: number;
  productId: number;
  targetPrice: number | null;
  notifyOnAnySale: boolean;
  lastNotifiedAt: Date | null;
  [key: string]: unknown;
}

interface ProductPrice {
  productId: number;
  productTitle: string;
  normalizedProductId: string;
  aspName: string;
  originalPrice: number;
  salePrice: number | null;
  discountPercent: number | null;
  [key: string]: unknown;
}

interface Subscription {
  id: number;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  [key: string]: unknown;
}

async function main() {
  console.log('=== 価格アラートチェック開始 ===');
  console.log(`時刻: ${new Date().toISOString()}`);

  // DB接続
  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'],
  });
  const db = drizzle(pool);

  try {
    // 1. アクティブな価格アラートを取得
    console.log('\n1. アクティブな価格アラートを取得中...');

    const renotifyThreshold = new Date();
    renotifyThreshold.setHours(renotifyThreshold.getHours() - RENOTIFY_INTERVAL_HOURS);

    const activeAlerts = await db.execute<PriceAlert>(sql`
      SELECT
        pa.id,
        pa.subscription_id as "subscriptionId",
        pa.product_id as "productId",
        pa.target_price as "targetPrice",
        pa.notify_on_any_sale as "notifyOnAnySale",
        pa.last_notified_at as "lastNotifiedAt"
      FROM price_alerts pa
      WHERE pa.is_active = true
        AND (
          pa.last_notified_at IS NULL
          OR pa.last_notified_at < ${renotifyThreshold}
        )
    `);

    console.log(`  ${activeAlerts.rows.length}件のアラートを取得`);

    if (activeAlerts.rows.length === 0) {
      console.log('  処理対象のアラートがありません');
      return;
    }

    // 2. 対象商品の価格を取得
    const productIds = [...new Set(activeAlerts.rows.map((a) => a.productId))];
    console.log(`\n2. ${productIds.length}件の商品価格を取得中...`);

    const productPrices = await db.execute<ProductPrice>(sql`
      SELECT
        p.id as "productId",
        p.title as "productTitle",
        p.normalized_product_id as "normalizedProductId",
        ps.asp_name as "aspName",
        COALESCE(pp.original_price, ps.price, 0) as "originalPrice",
        pp.current_price as "salePrice",
        pp.discount_percent as "discountPercent"
      FROM products p
      INNER JOIN product_sources ps ON ps.product_id = p.id
      LEFT JOIN product_prices pp ON pp.product_source_id = ps.id
        AND pp.price_type = 'download'
      WHERE p.id = ANY(ARRAY[${sql.join(
        productIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::int[])
    `);

    // 商品ごとに最安値を取得
    const priceByProduct = new Map<number, ProductPrice>();
    for (const price of productPrices.rows) {
      const existing = priceByProduct.get(price.productId);
      const effectivePrice = price.salePrice || price.originalPrice;

      if (!existing || effectivePrice < (existing.salePrice || existing.originalPrice)) {
        priceByProduct.set(price.productId, price);
      }
    }

    // 3. 購読情報を取得
    const subscriptionIds = [...new Set(activeAlerts.rows.map((a) => a.subscriptionId))];
    console.log(`\n3. ${subscriptionIds.length}件の購読情報を取得中...`);

    const subscriptions = await db.execute<Subscription>(sql`
      SELECT
        id,
        endpoint,
        keys
      FROM push_subscriptions
      WHERE id = ANY(ARRAY[${sql.join(
        subscriptionIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::int[])
    `);

    const subscriptionById = new Map<number, Subscription>();
    for (const sub of subscriptions.rows) {
      subscriptionById.set(sub.id, sub);
    }

    // 4. アラート条件をチェックして通知
    console.log('\n4. アラート条件をチェック中...');

    let notificationsSent = 0;
    let notificationsSkipped = 0;
    const expiredSubscriptions: number[] = [];

    for (const alert of activeAlerts.rows) {
      const price = priceByProduct.get(alert['productId']);
      const subscription = subscriptionById.get(alert['subscriptionId']);

      if (!price || !subscription) {
        notificationsSkipped++;
        continue;
      }

      const effectivePrice = price.salePrice || price.originalPrice;
      const isOnSale = price.salePrice !== null && price.salePrice < price.originalPrice;
      let shouldNotify = false;
      let payload = null;

      // 目標価格チェック
      if (alert['targetPrice'] && effectivePrice <= alert['targetPrice']) {
        shouldNotify = true;
        payload = createTargetPriceReachedPayload(
          price.productTitle,
          alert['targetPrice'],
          effectivePrice,
          `/ja/products/${price.productId}`,
          'ja',
        );
      }
      // セール通知チェック
      else if (alert['notifyOnAnySale'] && isOnSale) {
        shouldNotify = true;
        payload = createPriceAlertPayload(
          price.productTitle,
          price.originalPrice,
          price.salePrice!,
          `/ja/products/${price.productId}`,
          'ja',
        );
      }

      if (shouldNotify && payload) {
        // プッシュ通知送信
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
          console.log(`  [SKIP] VAPID未設定: ${price.productTitle}`);
          notificationsSkipped++;
          continue;
        }

        const subscriptionData: PushSubscriptionData = {
          endpoint: subscription['endpoint'],
          keys: subscription.keys,
        };

        const result = await sendPushNotification(subscriptionData, payload, {
          subject: VAPID_SUBJECT,
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: VAPID_PRIVATE_KEY,
        });

        if (result.success) {
          console.log(`  ✓ 通知送信: ${price.productTitle.substring(0, 30)}...`);
          notificationsSent++;

          // 通知日時を更新
          await db.execute(sql`
            UPDATE price_alerts
            SET last_notified_at = NOW(), updated_at = NOW()
            WHERE id = ${alert['id']}
          `);

          // 通知履歴を記録
          await db.execute(sql`
            INSERT INTO alert_notifications (
              alert_id, subscription_id, product_id,
              notification_type, title, body,
              original_price, sale_price, discount_percent,
              was_successful
            ) VALUES (
              ${alert['id']}, ${alert['subscriptionId']}, ${alert['productId']},
              ${alert['targetPrice'] ? 'target_reached' : 'sale_start'},
              ${payload.title}, ${payload.body},
              ${price.originalPrice}, ${effectivePrice}, ${price.discountPercent || 0},
              true
            )
          `);
        } else {
          console.log(`  ✗ 通知失敗: ${result.error}`);

          // 購読が無効になった場合は記録
          if (result['statusCode'] === 410 || result['statusCode'] === 404) {
            expiredSubscriptions.push(alert['subscriptionId']);
          }

          // エラー履歴を記録
          await db.execute(sql`
            INSERT INTO alert_notifications (
              alert_id, subscription_id, product_id,
              notification_type, title, body,
              was_successful, error_message
            ) VALUES (
              ${alert['id']}, ${alert['subscriptionId']}, ${alert['productId']},
              'error', ${payload.title}, ${payload.body},
              false, ${result.error || 'Unknown error'}
            )
          `);
        }
      } else {
        notificationsSkipped++;
      }
    }

    // 5. 無効な購読を削除
    if (expiredSubscriptions.length > 0) {
      console.log(`\n5. ${expiredSubscriptions.length}件の無効な購読を削除中...`);

      for (const subId of expiredSubscriptions) {
        await db.execute(sql`
          DELETE FROM push_subscriptions WHERE id = ${subId}
        `);
      }
    }

    // 結果サマリー
    console.log('\n=== 処理完了 ===');
    console.log(`  通知送信: ${notificationsSent}件`);
    console.log(`  スキップ: ${notificationsSkipped}件`);
    console.log(`  無効購読削除: ${expiredSubscriptions.length}件`);
  } catch (error) {
    console.error('エラー:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
