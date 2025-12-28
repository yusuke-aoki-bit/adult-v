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
 * 同じプロバイダー内では重複排除しない（FC2など同タイトルで別動画が多いため）
 * 異なるプロバイダー間では同一作品とみなして重複排除
 */
function getDeduplicationKey(product: DeduplicatableProduct): string {
  const provider = product.provider || 'unknown';

  // FC2/DUGAなど同一タイトルで別動画が多いプロバイダーは
  // originalProductId をキーに使用して正確に重複判定
  if (PROVIDERS_WITH_DUPLICATE_TITLES.has(provider) && product.originalProductId) {
    return `${provider}:id:${product.originalProductId}`;
  }

  // その他のプロバイダーはタイトルベースで重複判定
  const normalizedTitle = normalizeTitle(product.title);
  return `${provider}:title:${normalizedTitle}`;
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

  // 全商品をタイトルでグループ化（プロバイダー横断の重複検出用）
  const productGroupsByTitle = new Map<string, T[]>();
  for (const product of products) {
    const normalizedTitleKey = normalizeTitle(product.title);
    const group = productGroupsByTitle.get(normalizedTitleKey) || [];
    group.push(product);
    productGroupsByTitle.set(normalizedTitleKey, group);
  }

  // siteMode === 'all' の場合: 異なるプロバイダー間のみ重複排除し、代替ソースを保持
  if (siteMode === 'all') {
    const deduplicatedProducts: T[] = [];
    const seenKeys = new Set<string>();

    for (const [normalizedTitle, group] of productGroupsByTitle) {
      // 同じプロバイダー内の商品はすべて保持する
      // 異なるプロバイダー間では最安を選択し、代替ソースとして他を保持

      // まずプロバイダーごとにグループ化
      const byProvider = new Map<string, T[]>();
      for (const product of group) {
        const provider = product.provider || 'unknown';
        const providerGroup = byProvider.get(provider) || [];
        providerGroup.push(product);
        byProvider.set(provider, providerGroup);
      }

      // 各プロバイダーから1つずつ代表を選出（最安）
      const representatives: T[] = [];
      for (const [, providerProducts] of byProvider) {
        // 同じプロバイダー内の全商品を保持（重複排除しない）
        for (const p of providerProducts) {
          const key = getDeduplicationKey(p);
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            representatives.push(p);
          }
        }
      }

      // 異なるプロバイダー間で同じタイトルがある場合、代替ソースを設定
      if (byProvider.size > 1) {
        // 価格順にソート
        representatives.sort((a, b) => {
          const priceA = a.salePrice || a.price || Infinity;
          const priceB = b.salePrice || b.price || Infinity;
          return priceA - priceB;
        });

        // 最安商品に他プロバイダーの情報を代替ソースとして追加
        const cheapest = representatives[0];
        const alternatives = representatives.slice(1).filter(p => p.provider !== cheapest.provider);
        if (alternatives.length > 0 && !cheapest.alternativeSources) {
          cheapest.alternativeSources = alternatives.map(p => ({
            aspName: p.provider || 'unknown',
            price: p.price,
            salePrice: p.salePrice,
            affiliateUrl: p.affiliateUrl || '',
            productId: typeof p.id === 'string' ? parseInt(p.id, 10) : p.id,
          }));
        }
      }

      deduplicatedProducts.push(...representatives);
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
