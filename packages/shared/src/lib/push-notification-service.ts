/**
 * Web Push通知送信サービス
 * web-pushライブラリを使用してプッシュ通知を送信
 *
 * 注: sendPushNotification関数はサーバーサイド(crawlers等)でのみ使用可能
 * クライアントサイドでは型定義とペイロード生成関数のみ使用
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface SendResult {
  success: boolean;
  endpoint: string;
  statusCode?: number;
  error?: string;
}

/**
 * web-pushを使用してプッシュ通知を送信
 * 注: この関数はサーバーサイドでのみ使用可能（crawlersパッケージから呼び出し）
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: NotificationPayload,
  vapidDetails: {
    subject: string;
    publicKey: string;
    privateKey: string;
  }
): Promise<SendResult> {
  try {
    // web-pushは動的インポート（サーバーサイドのみ）
    // @ts-ignore - web-push is optional dependency, only used in crawlers
    const webpush = await import('web-push');

    webpush.setVapidDetails(
      vapidDetails.subject,
      vapidDetails.publicKey,
      vapidDetails.privateKey
    );

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/icon-192x192.png',
      url: payload.url || '/',
      tag: payload.tag || 'default',
      data: payload.data,
    });

    const result = await webpush.sendNotification(
      {
        endpoint: subscription['endpoint'],
        keys: subscription.keys,
      },
      pushPayload
    );

    return {
      success: true,
      endpoint: subscription['endpoint'],
      statusCode: result['statusCode'],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = (error as { statusCode?: number }).statusCode;

    return {
      success: false,
      endpoint: subscription['endpoint'],
      ...(statusCode !== undefined && { statusCode }),
      error: errorMessage,
    };
  }
}

/**
 * 複数の購読者にプッシュ通知を送信
 */
export async function sendPushNotificationBatch(
  subscriptions: PushSubscriptionData[],
  payload: NotificationPayload,
  vapidDetails: {
    subject: string;
    publicKey: string;
    privateKey: string;
  },
  options?: {
    concurrency?: number;  // 同時送信数
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<{
  results: SendResult[];
  successCount: number;
  failureCount: number;
  expiredEndpoints: string[];  // 無効になった購読（削除対象）
}> {
  const concurrency = options?.concurrency || 10;
  const results: SendResult[] = [];
  const expiredEndpoints: string[] = [];

  // バッチ処理
  for (let i = 0; i < subscriptions.length; i += concurrency) {
    const batch = subscriptions.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map((sub) => sendPushNotification(sub, payload, vapidDetails))
    );

    for (const result of batchResults) {
      results.push(result);

      // 410 Gone または 404 Not Found は購読が無効
      if (result['statusCode'] === 410 || result['statusCode'] === 404) {
        expiredEndpoints.push(result['endpoint']);
      }
    }

    if (options?.onProgress) {
      options.onProgress(Math.min(i + concurrency, subscriptions.length), subscriptions.length);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return {
    results,
    successCount,
    failureCount,
    expiredEndpoints,
  };
}

/**
 * 価格アラート用の通知ペイロードを生成
 */
export function createPriceAlertPayload(
  productTitle: string,
  originalPrice: number,
  salePrice: number,
  productUrl: string,
  locale: string = 'ja'
): NotificationPayload {
  const discountPercent = Math.round((1 - salePrice / originalPrice) * 100);

  const messages = {
    ja: {
      title: `🎉 セール開始！${discountPercent}%オフ`,
      body: `${productTitle}\n¥${originalPrice.toLocaleString()} → ¥${salePrice.toLocaleString()}`,
    },
    en: {
      title: `🎉 Sale! ${discountPercent}% off`,
      body: `${productTitle}\n¥${originalPrice.toLocaleString()} → ¥${salePrice.toLocaleString()}`,
    },
  };

  const msg = messages[locale as keyof typeof messages] || messages.ja;

  return {
    title: msg.title,
    body: msg.body,
    url: productUrl,
    tag: `price-alert-${Date.now()}`,
    data: {
      type: 'price_alert',
      originalPrice,
      salePrice,
      discountPercent,
    },
  };
}

/**
 * 目標価格到達通知ペイロードを生成
 */
export function createTargetPriceReachedPayload(
  productTitle: string,
  targetPrice: number,
  currentPrice: number,
  productUrl: string,
  locale: string = 'ja'
): NotificationPayload {
  const messages = {
    ja: {
      title: `🔔 目標価格に到達！`,
      body: `${productTitle}\n設定価格: ¥${targetPrice.toLocaleString()} → 現在: ¥${currentPrice.toLocaleString()}`,
    },
    en: {
      title: `🔔 Target price reached!`,
      body: `${productTitle}\nTarget: ¥${targetPrice.toLocaleString()} → Now: ¥${currentPrice.toLocaleString()}`,
    },
  };

  const msg = messages[locale as keyof typeof messages] || messages.ja;

  return {
    title: msg.title,
    body: msg.body,
    url: productUrl,
    tag: `target-reached-${Date.now()}`,
    data: {
      type: 'target_reached',
      targetPrice,
      currentPrice,
    },
  };
}
