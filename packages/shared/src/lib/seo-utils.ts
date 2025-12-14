/**
 * SEO最適化ユーティリティ
 */

import type { Product } from '../types';

/**
 * 画像Alt属性を生成（SEO最適化）
 * フォーマット: "タイトル | 女優名 | ジャンル | リリース日 | 作品ID"
 */
export function generateAltText(product: Product): string {
  const parts: string[] = [];

  // タイトル（必須）
  if (product.title) {
    parts.push(product.title);
  }

  // 女優名
  if (product.actressName) {
    parts.push(product.actressName);
  }

  // ジャンル（最初の2つ）
  if (product.tags && product.tags.length > 0) {
    const genreTags = product.tags.slice(0, 2).join('・');
    parts.push(genreTags);
  }

  // リリース日
  if (product.releaseDate) {
    parts.push(product.releaseDate);
  }

  // 作品ID
  if (product.normalizedProductId || product.id) {
    parts.push(product.normalizedProductId || product.id);
  }

  return parts.join(' | ');
}

/**
 * メタディスクリプションを生成（SEO最適化）
 * 150-160文字でキーワード最適化
 */
export function generateMetaDescription(product: Product): string {
  const parts: string[] = [];

  // 女優名
  if (product.actressName) {
    parts.push(`${product.actressName}出演`);
  }

  // タイトル
  if (product.title) {
    // 150文字以内に収める
    const maxTitleLength = 80;
    const title = product.title.length > maxTitleLength
      ? product.title.substring(0, maxTitleLength) + '...'
      : product.title;
    parts.push(title);
  }

  // ジャンル
  if (product.tags && product.tags.length > 0) {
    const genres = product.tags.slice(0, 3).join('・');
    parts.push(`【${genres}】`);
  }

  // リリース日
  if (product.releaseDate) {
    parts.push(`配信日: ${product.releaseDate}`);
  }

  // 作品ID
  if (product.normalizedProductId) {
    parts.push(`品番: ${product.normalizedProductId}`);
  }

  // 最大160文字に制限
  const description = parts.join(' | ');
  return description.length > 160
    ? description.substring(0, 157) + '...'
    : description;
}

/**
 * ページタイトルを生成（SEO最適化）
 * フォーマット: "タイトル | 女優名 | サイト名"
 */
export function generatePageTitle(product: Product, siteName: string = 'Adult-V'): string {
  const parts: string[] = [];

  if (product.title) {
    // 60文字以内に収める
    const maxTitleLength = 50;
    const title = product.title.length > maxTitleLength
      ? product.title.substring(0, maxTitleLength) + '...'
      : product.title;
    parts.push(title);
  }

  if (product.actressName) {
    parts.push(product.actressName);
  }

  parts.push(siteName);

  return parts.join(' | ');
}

/**
 * 構造化データ (VideoObject Schema) を生成
 */
export function generateVideoSchema(product: Product, siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: product.title,
    description: generateMetaDescription(product),
    thumbnailUrl: product.imageUrl || '',
    uploadDate: product.releaseDate || new Date().toISOString().split('T')[0],
    contentUrl: `${siteUrl}/products/${product.id}`,
    // duration: product.duration ? `PT${product.duration}M` : undefined, // ISO 8601 format
    ...(product.actressName && {
      actor: {
        '@type': 'Person',
        name: product.actressName,
      },
    }),
    ...(product.tags && product.tags.length > 0 && {
      genre: product.tags,
    }),
  };
}

/**
 * 構造化データ (Person Schema) を生成
 */
export function generatePerformerSchema(performer: {
  name: string;
  profileImageUrl?: string;
  aliases?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: performer.name,
    ...(performer.profileImageUrl && {
      image: performer.profileImageUrl,
    }),
    ...(performer.aliases && performer.aliases.length > 0 && {
      alternateName: performer.aliases,
    }),
  };
}

/**
 * 構造化データ (BreadcrumbList Schema) を生成
 */
export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
