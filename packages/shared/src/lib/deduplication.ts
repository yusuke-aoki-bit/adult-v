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

  // 全商品をタイトルでグループ化
  const productGroupsByTitle = new Map<string, T[]>();
  for (const product of products) {
    const normalizedTitleKey = normalizeTitle(product.title);
    const group = productGroupsByTitle.get(normalizedTitleKey) || [];
    group.push(product);
    productGroupsByTitle.set(normalizedTitleKey, group);
  }

  // siteMode === 'all' の場合: 代替ソースを保持
  if (siteMode === 'all') {
    const deduplicatedProducts: T[] = [];

    for (const [, group] of productGroupsByTitle) {
      // 最安価格の商品を選択
      const sortedGroup = [...group].sort((a, b) => {
        const priceA = a.salePrice || a.price || Infinity;
        const priceB = b.salePrice || b.price || Infinity;
        return priceA - priceB;
      });

      const cheapest = sortedGroup[0];

      // 他のASP情報をalternativeSourcesに追加（最安以外）
      if (sortedGroup.length > 1) {
        cheapest.alternativeSources = sortedGroup.slice(1).map(p => ({
          aspName: p.provider || 'unknown',
          price: p.price,
          salePrice: p.salePrice,
          affiliateUrl: p.affiliateUrl || '',
          productId: typeof p.id === 'string' ? parseInt(p.id, 10) : p.id,
        }));
      }

      deduplicatedProducts.push(cheapest);
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
  // 各タイトルの最安商品を特定
  const productsByTitle = new Map<string, T>();
  for (const product of products) {
    const normalizedTitleKey = normalizeTitle(product.title);
    const existing = productsByTitle.get(normalizedTitleKey);

    if (!existing) {
      productsByTitle.set(normalizedTitleKey, product);
    } else {
      const existingPrice = existing.salePrice || existing.price || Infinity;
      const currentPrice = product.salePrice || product.price || Infinity;
      if (currentPrice < existingPrice) {
        productsByTitle.set(normalizedTitleKey, product);
      }
    }
  }

  // 元の順序を維持しながら重複を除去
  const seenTitles = new Set<string>();
  return products.filter(product => {
    const normalizedTitleKey = normalizeTitle(product.title);

    if (seenTitles.has(normalizedTitleKey)) {
      return false;
    }
    seenTitles.add(normalizedTitleKey);

    // 最安の商品かどうかをチェック
    const cheapest = productsByTitle.get(normalizedTitleKey);
    return cheapest?.id === product.id;
  });
}
