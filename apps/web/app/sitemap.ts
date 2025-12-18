import { MetadataRoute } from 'next';
import { getDb } from '@/lib/db';
import { products, performers } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

// Force dynamic generation - do not prerender at build time
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalidate every hour

// hreflang用の言語バリエーションを生成
// canonical URLは /ja/ プレフィックス付き（デフォルトロケール）
// 例: /products/123 → { ja: /ja/products/123, en: /en/products/123, ... }
function getLanguageAlternates(basePath: string) {
  // basePath が空の場合（ルートページ）は空文字列として扱う
  const path = basePath === '/' ? '' : basePath;
  return {
    ja: `${BASE_URL}/ja${path}`,
    en: `${BASE_URL}/en${path}`,
    zh: `${BASE_URL}/zh${path}`,
    ko: `${BASE_URL}/ko${path}`,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages with high priority and daily updates
  // canonical URLは日本語版（/ja/...）、alternatesで各言語を指定
  // 注意: /categories は /products にリダイレクトされるため、sitemapには含めない
  const staticPages: MetadataRoute.Sitemap = [
    // Home page - canonical URL is /ja (Japanese default)
    {
      url: `${BASE_URL}/ja`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
      alternates: {
        languages: getLanguageAlternates('/'),
      },
    },
    // Products pages (replaced /categories which now redirects here)
    {
      url: `${BASE_URL}/ja/products`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
      alternates: {
        languages: getLanguageAlternates('/products'),
      },
    },
    // Privacy policy page (Japanese only)
    {
      url: `${BASE_URL}/ja/privacy`,
      lastModified: new Date('2024-12-09'),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    // Terms of service page (Japanese only)
    {
      url: `${BASE_URL}/ja/terms`,
      lastModified: new Date('2024-12-09'),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
  ];

  // If DATABASE_URL is not available (during build), return static pages only
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not available - generating sitemap with static pages only');
    return staticPages;
  }

  try {
    const db = getDb();

    // Recent products (5000 items) - SEO priority for content pages
    const recentProducts = await db
      .select({
        id: products.id,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .orderBy(desc(products.releaseDate))
      .limit(5000);

  // 商品ページ - canonical URLは/ja/products/..., alternatesで各言語を指定
  const productPages: MetadataRoute.Sitemap = recentProducts.map((product) => ({
    url: `${BASE_URL}/ja/products/${product.id}`,
    lastModified: product.updatedAt || new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    alternates: {
      languages: getLanguageAlternates(`/products/${product.id}`),
    },
  }));

  // Top performers (1000 items) - Prioritize performers with most products
  const topPerformers = await db
    .select({
      id: performers.id,
      productCount: sql<number>`COUNT(DISTINCT pp.product_id)`.as('product_count'),
    })
    .from(performers)
    .leftJoin(
      sql`product_performers pp`,
      sql`${performers.id} = pp.performer_id`
    )
    .groupBy(performers.id)
    .orderBy(desc(sql`product_count`))
    .limit(1000);

  // 女優ページ - canonical URLは/ja/actress/..., alternatesで各言語を指定
  // GSC data shows actress pages get most clicks - prioritize them
  const performerPages: MetadataRoute.Sitemap = topPerformers.map((performer) => ({
    url: `${BASE_URL}/ja/actress/${performer.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8, // Increased from 0.6 - actress pages drive most traffic
    alternates: {
      languages: getLanguageAlternates(`/actress/${performer.id}`),
    },
  }));

    return [...staticPages, ...productPages, ...performerPages];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return static pages only on error
    return staticPages;
  }
}
