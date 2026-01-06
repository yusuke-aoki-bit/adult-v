/**
 * タイトルベースの重複排除ユーティリティ
 * 同一作品が複数のASPで存在する場合、最安のASPを優先して表示
 */

import type { SiteMode } from '../db-queries/asp-filter';

/**
 * 代替ソース情報
 */
export interface AlternativeSource {
  aspName: string;
  price?: number;
  salePrice?: number;
  affiliateUrl: string;
  productId: number;
}

/**
 * 重複排除対象の商品型
 * 必須フィールドのみ定義し、それ以外はジェネリックで受け取る
 */
export interface DeduplicatableProduct {
  id: number | string;
  title: string;
  price?: number;
  salePrice?: number;
  provider?: string;
  affiliateUrl?: string;
  alternativeSources?: AlternativeSource[];
  /** 元のプロダクトID（FC2など同一タイトルで異なる動画がある場合に使用） */
  originalProductId?: string;
}

/**
 * タイトルを正規化（重複排除用）
 * 空白・記号を除去し、小文字化して同じ作品を識別
 */
export function normalizeTitle(title: string): string {
  return title
    .replace(/[\s　]+/g, '') // 全角・半角スペース除去
    .replace(/[！!？?「」『』【】（）()＆&～~・:：,，。.、]/g, '') // 記号除去
    .toLowerCase();
}

/**
 * 同一タイトルで別動画が多いプロバイダー
 * これらのプロバイダーでは originalProductId をキーに使用
 */
const PROVIDERS_WITH_DUPLICATE_TITLES = new Set([
  'fc2',
  'FC2',
  'duga',
  'DUGA',
]);

/**
 * 重複排除キーを生成
 * FC2/DUGAなどは同一タイトルで別動画が多いため、originalProductIdでユニーク判定
 * その他のプロバイダーは、異なるプロバイダー間でも同一タイトルなら同一作品とみなす
 */
function getDeduplicationKey(product: DeduplicatableProduct): string {
  const provider = product.provider || 'unknown';

  // FC2/DUGAなど同一タイトルで別動画が多いプロバイダーは
  // originalProductId または id をキーに使用して正確に重複判定
  if (PROVIDERS_WITH_DUPLICATE_TITLES.has(provider)) {
    const uniqueId = product.originalProductId || product['id'];
    return `provider:${provider}:id:${uniqueId}`;
  }

  // その他のプロバイダーはタイトルベースで重複判定
  // プロバイダー名を含めない → 異なるASP間でも同一タイトルなら同一作品として扱う
  const normalizedTitle = normalizeTitle(product['title']);
  return `title:${normalizedTitle}`;
}

/**
 * 商品配列をタイトルベースで重複排除
 *
 * @param products - 重複排除対象の商品配列
 * @param siteMode - サイトモード ('all': 代替ソース保持, 'fanza-only': シンプル重複排除)
 * @returns 重複排除済みの商品配列（元の順序を維持）
 */
export function deduplicateProductsByTitle<T extends DeduplicatableProduct>(
  products: T[],
  siteMode: SiteMode
): T[] {
  if (products.length === 0) return [];

  // siteMode === 'all' の場合: 異なるプロバイダー間のみ重複排除し、代替ソースを保持
  if (siteMode === 'all') {
    const deduplicatedProducts: T[] = [];
    const seenKeys = new Set<string>();

    // まず全商品をキーでグループ化（同一キーの商品を検出）
    const productsByKey = new Map<string, T[]>();
    for (const product of products) {
      const key = getDeduplicationKey(product);
      const group = productsByKey.get(key) || [];
      group.push(product);
      productsByKey.set(key, group);
    }

    // 同一キーのグループから代表を選出し、代替ソースを設定
    for (const [key, group] of productsByKey) {
      if (group.length === 1) {
        // 重複なし
        const product = group[0];
        if (product && !seenKeys.has(key)) {
          seenKeys.add(key);
          deduplicatedProducts.push(product);
        }
      } else {
        // 重複あり - 最安商品を選択し、他を代替ソースに
        const sorted = [...group].sort((a, b) => {
          const priceA = a.salePrice || a.price || Infinity;
          const priceB = b.salePrice || b.price || Infinity;
          return priceA - priceB;
        });

        const cheapest = sorted[0];
        if (!cheapest) continue;

        const alternatives = sorted.slice(1).filter(p => p.provider !== cheapest.provider);

        if (alternatives.length > 0 && !cheapest.alternativeSources) {
          cheapest.alternativeSources = alternatives.map(p => ({
            aspName: p.provider || 'unknown',
            price: p.price,
            salePrice: p.salePrice,
            affiliateUrl: p.affiliateUrl || '',
            productId: typeof p.id === 'string' ? parseInt(p.id, 10) : p.id,
          })) as AlternativeSource[];
        }

        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          deduplicatedProducts.push(cheapest);
        }
      }
    }

    // 元の順序を維持
    const originalOrder = new Map(products.map((p, i) => [p.id, i]));
    deduplicatedProducts.sort((a, b) => {
      const orderA = originalOrder.get(a.id) ?? Infinity;
      const orderB = originalOrder.get(b.id) ?? Infinity;
      return orderA - orderB;
    });

    return deduplicatedProducts;
  }

  // siteMode === 'fanza-only' の場合: シンプル重複排除（代替ソースなし）
  // 同じプロバイダー内の同タイトルは別商品として扱う
  const seenKeys = new Set<string>();
  return products.filter(product => {
    const key = getDeduplicationKey(product);

    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);
    return true;
  });
}
