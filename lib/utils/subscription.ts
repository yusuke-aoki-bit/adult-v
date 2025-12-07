/**
 * サブスクリプション関連ユーティリティ
 *
 * 月額制プロバイダーの判定などを一元管理
 */

/**
 * サブスクリプション（月額制）プロバイダーのリスト
 */
export const SUBSCRIPTION_PROVIDERS = ['dti', 'japanska'] as const;

/**
 * 指定されたASP名がサブスクリプション（月額制）プロバイダーかどうかを判定
 *
 * @param aspName - ASP名（大文字小文字問わず）
 * @returns サブスクリプションプロバイダーの場合はtrue
 */
export function isSubscriptionProvider(aspName: string): boolean {
  const normalized = aspName.toLowerCase();
  return SUBSCRIPTION_PROVIDERS.includes(normalized as typeof SUBSCRIPTION_PROVIDERS[number]);
}

/**
 * サブスクリプションプロバイダーの説明テキストを取得
 *
 * @param aspName - ASP名
 * @returns 説明テキスト（月額制の場合）またはnull
 */
export function getSubscriptionDescription(aspName: string): string | null {
  if (!isSubscriptionProvider(aspName)) return null;

  const normalized = aspName.toLowerCase();
  switch (normalized) {
    case 'dti':
      return '月額見放題サービス';
    case 'japanska':
      return '月額ストリーミングサービス';
    default:
      return '月額制サービス';
  }
}

/**
 * 価格をフォーマット（通貨対応）
 *
 * USDはセント単位で保存されているため100で割って表示
 * JPYはそのまま表示
 *
 * @param price - 価格（USDはセント単位、JPYは円単位）
 * @param currency - 通貨コード ('USD' | 'JPY')
 * @returns フォーマットされた価格文字列
 */
export function formatPrice(price: number, currency: string = 'JPY'): string {
  if (currency === 'USD') {
    // USDはセント単位で保存されているため100で割る
    const dollars = price / 100;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  // JPYはそのまま表示
  return `¥${price.toLocaleString()}`;
}

/**
 * 価格表示用のフォーマット
 * サブスクリプションプロバイダーの場合は「月額」を付加
 *
 * @param aspName - ASP名
 * @param price - 価格（円）
 * @returns フォーマットされた価格文字列
 */
export function formatPriceWithSubscription(aspName: string, price: number | null): string {
  if (price === null || price === 0) {
    if (isSubscriptionProvider(aspName)) {
      return '月額制';
    }
    return '価格未設定';
  }

  const formattedPrice = `¥${price.toLocaleString()}`;

  if (isSubscriptionProvider(aspName)) {
    return `${formattedPrice}/月`;
  }

  return formattedPrice;
}
