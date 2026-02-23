/**
 * データベースコンテンツのローカライゼーションユーティリティ
 * 言語設定に応じて適切なカラムの値を返す
 */

import type { ActressAiReview } from '../types/product';

export type SupportedLocale = 'ja' | 'en' | 'zh' | 'zh-TW' | 'ko';

/**
 * 商品タイトルをロケールに応じて取得
 * フォールバック: 指定言語 → 日本語(title)
 */
export function getLocalizedTitle(
  product: {
    title: string;
    titleEn?: string | null;
    titleZh?: string | null;
    titleZhTw?: string | null;
    titleKo?: string | null;
  },
  locale: string,
): string {
  switch (locale) {
    case 'en':
      return product['titleEn'] || product['title'];
    case 'zh':
      return product['titleZh'] || product['title'];
    case 'zh-TW':
      return product.titleZhTw || product['titleZh'] || product['title'];
    case 'ko':
      return product['titleKo'] || product['title'];
    default:
      return product['title'];
  }
}

/**
 * 商品説明をロケールに応じて取得
 * フォールバック: 指定言語 → 日本語(description) → 空文字
 */
export function getLocalizedDescription(
  product: {
    description?: string | null;
    descriptionEn?: string | null;
    descriptionZh?: string | null;
    descriptionZhTw?: string | null;
    descriptionKo?: string | null;
  },
  locale: string,
): string {
  switch (locale) {
    case 'en':
      return product['descriptionEn'] || product['description'] || '';
    case 'zh':
      return product['descriptionZh'] || product['description'] || '';
    case 'zh-TW':
      return product.descriptionZhTw || product['descriptionZh'] || product['description'] || '';
    case 'ko':
      return product['descriptionKo'] || product['description'] || '';
    default:
      return product['description'] || '';
  }
}

/**
 * 女優名をロケールに応じて取得
 * フォールバック: 指定言語 → 日本語(name)
 */
export function getLocalizedPerformerName(
  performer: {
    name: string;
    nameEn?: string | null;
    nameZh?: string | null;
    nameZhTw?: string | null;
    nameKo?: string | null;
  },
  locale: string,
): string {
  switch (locale) {
    case 'en':
      return performer['nameEn'] || performer['name'];
    case 'zh':
      return performer.nameZh || performer['name'];
    case 'zh-TW':
      return performer.nameZhTw || performer.nameZh || performer['name'];
    case 'ko':
      return performer.nameKo || performer['name'];
    default:
      return performer['name'];
  }
}

/**
 * 女優バイオをロケールに応じて取得
 * フォールバック: 指定言語 → 日本語(bioJa) → 空文字
 */
export function getLocalizedPerformerBio(
  performer: {
    bioJa?: string | null;
    bioEn?: string | null;
    bioZh?: string | null;
    bioZhTw?: string | null;
    bioKo?: string | null;
  },
  locale: string,
): string {
  switch (locale) {
    case 'en':
      return performer.bioEn || performer.bioJa || '';
    case 'zh':
      return performer.bioZh || performer.bioJa || '';
    case 'zh-TW':
      return performer.bioZhTw || performer.bioZh || performer.bioJa || '';
    case 'ko':
      return performer.bioKo || performer.bioJa || '';
    default:
      return performer.bioJa || '';
  }
}

/**
 * タグ名をロケールに応じて取得
 * フォールバック: 指定言語 → 日本語(name)
 */
export function getLocalizedTagName(
  tag: {
    name: string;
    nameEn?: string | null;
    nameZh?: string | null;
    nameZhTw?: string | null;
    nameKo?: string | null;
  },
  locale: string,
): string {
  switch (locale) {
    case 'en':
      return tag['nameEn'] || tag['name'];
    case 'zh':
      return tag.nameZh || tag['name'];
    case 'zh-TW':
      return tag.nameZhTw || tag.nameZh || tag['name'];
    case 'ko':
      return tag.nameKo || tag['name'];
    default:
      return tag['name'];
  }
}

/**
 * タグ説明をロケールに応じて取得
 * フォールバック: 指定言語 → 日本語(descriptionJa) → 空文字
 */
export function getLocalizedTagDescription(
  tag: {
    descriptionJa?: string | null;
    descriptionEn?: string | null;
    descriptionZh?: string | null;
    descriptionZhTw?: string | null;
    descriptionKo?: string | null;
  },
  locale: string,
): string {
  switch (locale) {
    case 'en':
      return tag['descriptionEn'] || tag.descriptionJa || '';
    case 'zh':
      return tag['descriptionZh'] || tag.descriptionJa || '';
    case 'zh-TW':
      return tag.descriptionZhTw || tag['descriptionZh'] || tag.descriptionJa || '';
    case 'ko':
      return tag['descriptionKo'] || tag.descriptionJa || '';
    default:
      return tag.descriptionJa || '';
  }
}

/**
 * AIレビューのローカライズ
 * AIレビューはJSONで保存され、各言語のフィールドを持つ可能性がある
 */
export function getLocalizedAiReview(aiReview: string | null | undefined, locale: string): ActressAiReview | undefined {
  if (!aiReview) return undefined;

  try {
    const parsed = JSON.parse(aiReview);

    // AIレビューが多言語構造の場合
    if (parsed[locale]) {
      const localized = parsed[locale];
      return {
        overview: localized.overview || '',
        style: localized.style || localized.actingStyle || '',
        appeal: localized.appeal || (Array.isArray(localized.appealPoints) ? localized.appealPoints.join('、') : ''),
        recommendation:
          localized.recommendation ||
          (Array.isArray(localized.recommendedFor) ? localized.recommendedFor.join('、') : ''),
        keywords: localized.keywords || [],
      };
    }

    // 日本語にフォールバック
    if (parsed.ja) {
      const ja = parsed.ja;
      return {
        overview: ja.overview || '',
        style: ja.style || ja.actingStyle || '',
        appeal: ja.appeal || (Array.isArray(ja.appealPoints) ? ja.appealPoints.join('、') : ''),
        recommendation: ja.recommendation || (Array.isArray(ja.recommendedFor) ? ja.recommendedFor.join('、') : ''),
        keywords: ja.keywords || [],
      };
    }

    // 従来の単一言語構造の場合
    return {
      overview: parsed.overview || '',
      style: parsed.style || parsed.actingStyle || '',
      appeal: parsed.appeal || (Array.isArray(parsed.appealPoints) ? parsed.appealPoints.join('、') : ''),
      recommendation:
        parsed.recommendation || (Array.isArray(parsed.recommendedFor) ? parsed.recommendedFor.join('、') : ''),
      keywords: parsed.keywords || [],
    };
  } catch {
    return undefined;
  }
}

/**
 * ロケールの検証とデフォルト値
 */
export function normalizeLocale(locale: string | undefined | null): SupportedLocale {
  const supportedLocales: SupportedLocale[] = ['ja', 'en', 'zh', 'zh-TW', 'ko'];
  if (locale && supportedLocales.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale;
  }
  return 'ja';
}
