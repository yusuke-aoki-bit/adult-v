import { MetadataRoute } from 'next';
import { getActresses, getProducts, getTags } from '@/lib/db/queries';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const locales = ['ja', 'en', 'zh'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemap: MetadataRoute.Sitemap = [];

  // ============================================
  // 静的ページ
  // ============================================

  // ホームページ（各言語）
  for (const locale of locales) {
    sitemap.push({
      url: `${siteUrl}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    });
  }

  // 検索ページ
  for (const locale of locales) {
    sitemap.push({
      url: `${siteUrl}/${locale}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    });
  }

  //商品検索ページ
  for (const locale of locales) {
    sitemap.push({
      url: `${siteUrl}/${locale}/products/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    });
  }

  // プライバシーポリシー・利用規約
  for (const locale of locales) {
    sitemap.push({
      url: `${siteUrl}/${locale}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    });
    sitemap.push({
      url: `${siteUrl}/${locale}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    });
  }

  // ============================================
  // 女優ページ（最新1000件 + 作品数が多い順500件）
  // ============================================

  try {
    // 最新の女優1000件
    const recentActresses = await getActresses({
      limit: 1000,
      sortBy: 'recent'
    });

    for (const actress of recentActresses) {
      for (const locale of locales) {
        sitemap.push({
          url: `${siteUrl}/${locale}/actress/${actress.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }

    // 作品数が多い女優500件（人気女優）
    const popularActresses = await getActresses({
      limit: 500,
      sortBy: 'productCountDesc'
    });

    for (const actress of popularActresses) {
      // 既に追加済みの場合はスキップ
      const alreadyAdded = recentActresses.some(a => a.id === actress.id);
      if (alreadyAdded) continue;

      for (const locale of locales) {
        sitemap.push({
          url: `${siteUrl}/${locale}/actress/${actress.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8, // 人気女優は優先度を上げる
        });
      }
    }

  } catch (error) {
    console.error('Error generating actress sitemap:', error);
  }

  // ============================================
  // 商品ページ（最新2000件）
  // ============================================

  try {
    // 最新の商品2000件
    const recentProducts = await getProducts({
      limit: 2000,
      sortBy: 'releaseDateDesc'
    });

    for (const product of recentProducts) {
      for (const locale of locales) {
        sitemap.push({
          url: `${siteUrl}/${locale}/products/${product.id}`,
          lastModified: new Date(product.releaseDate || new Date()),
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }
    }

  } catch (error) {
    console.error('Error generating product sitemap:', error);
  }

  return sitemap;
}
