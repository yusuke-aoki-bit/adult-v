/**
 * ソース選択ユーティリティ
 * サイトモードに応じた商品ソース（ASP）の選択ロジック
 */

import type { SiteMode } from '../db-queries/asp-filter';

/**
 * 商品ソースデータ型
 */
export interface ProductSourceData {
  productId: number;
  aspName: string;
  affiliateUrl: string;
  price: number | null;
  originalProductId: string;
  currency: string | null;
  isSubscription: boolean;
  dataSource: string;
  lastUpdated: Date | null;
  id: number;
  productType: string | null;
}

/**
 * ソース選択オプション
 */
export interface SourceSelectionOptions {
  /** サイトモード */
  siteMode: SiteMode;
  /** 優先プロバイダー（webサイト用） */
  preferredProviders?: string[];
  /** デバッグログを出力するか */
  debug?: boolean;
}

/**
 * ソース選択結果
 */
export interface SourceSelectionResult<T> {
  /** 商品IDからソースへのマップ */
  sourcesMap: Map<number, T>;
  /** デバッグ情報 */
  stats: {
    matched: number;
    fallback: number;
    skipped: number;
  };
}

/**
 * 商品ソースを選択
 *
 * @param sourcesByProduct - 商品IDごとにグループ化されたソース
 * @param options - 選択オプション
 * @returns 選択されたソースのマップとデバッグ情報
 */
export function selectProductSources<T extends { aspName: string; productId: number }>(
  sourcesByProduct: Map<number, T[]>,
  options: SourceSelectionOptions,
): SourceSelectionResult<T> {
  const { siteMode, preferredProviders, debug = false } = options;
  const sourcesMap = new Map<number, T>();
  const stats = { matched: 0, fallback: 0, skipped: 0 };

  if (siteMode === 'fanza-only') {
    // FANZAサイト: FANZAソースを優先
    for (const [productId, sources] of sourcesByProduct) {
      const fanzaSource = sources.find((s) => s.aspName.toUpperCase() === 'FANZA');
      if (fanzaSource) {
        sourcesMap.set(productId, fanzaSource);
        stats.matched++;
      } else if (sources.length > 0) {
        // FANZAソースがない場合は最初のソースを使用（通常は発生しない）
        sourcesMap.set(productId, sources[0]!);
        stats.fallback++;
      }
    }

    if (debug && stats.fallback > 0) {
      console.warn(`[sourceSelection FANZA] WARNING: ${stats.fallback} products without FANZA source (using fallback)`);
    }
  } else {
    // adult-v (all): FANZAソースを除外し、優先プロバイダーを考慮
    const preferredProvidersUpper = preferredProviders?.map((p) => p.toUpperCase()) || [];

    for (const [productId, sources] of sourcesByProduct) {
      // FANZAソースを除外
      const nonFanzaSources = sources.filter((s) => s.aspName.toUpperCase() !== 'FANZA');

      // FANZAのみの商品はスキップ
      if (nonFanzaSources.length === 0) {
        stats.skipped++;
        continue;
      }

      if (preferredProvidersUpper.length > 0) {
        // 優先プロバイダーに一致するソースを探す
        const preferredSource = nonFanzaSources.find((s) => preferredProvidersUpper.includes(s.aspName.toUpperCase()));
        if (preferredSource) {
          sourcesMap.set(productId, preferredSource);
          stats.matched++;
          continue;
        }
        stats.fallback++;
      }

      // 一致するソースがない場合はFANZA以外の最初のソースを使用
      sourcesMap.set(productId, nonFanzaSources[0]!);
    }

    if (debug && (preferredProvidersUpper.length > 0 || stats.skipped > 0)) {
      console.log(
        `[sourceSelection] Provider filter: ${preferredProvidersUpper.join(',') || 'none'} - matched: ${stats.matched}, fallback: ${stats.fallback}, skipped FANZA-only: ${stats.skipped}`,
      );
    }
  }

  return { sourcesMap, stats };
}

/**
 * ソースをグループ化
 * @param sources - ソース配列
 * @returns 商品IDごとにグループ化されたマップ
 */
export function groupSourcesByProduct<T extends { productId: number }>(sources: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const source of sources) {
    if (!grouped.has(source.productId)) {
      grouped.set(source.productId, []);
    }
    grouped.get(source.productId)!.push(source);
  }
  return grouped;
}
