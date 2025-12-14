import { MetadataRoute } from 'next';
import { getDb } from '@/lib/db';
import { products, performers } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

// Force dynamic generation - do not prerender at build time
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalidate every hour

// ロケールに応じたURLを生成（?hl=パラメータ方式）
// デフォルトロケール(ja)はパラメータなし、他の言語は ?hl=en, ?hl=zh, ?hl=ko
function getLocalizedUrl(basePath: string, locale: string): string {
  if (locale === 'ja') {
    return `${BASE_URL}${basePath}`;
  }
  // basePath に既存のクエリパラメータがある場合は & で追加
  const separator = basePath.includes('?') ? '&' : '?';
  return `${BASE_URL}${basePath}${separator}hl=${locale}`;
}

// hreflang用の言語バリエーションを生成（?hl=パラメータ方式）
function getLanguageAlternates(basePath: string) {
  const separator = basePath.includes('?') ? '&' : '?';
  return {
    ja: `${BASE_URL}${basePath}`,
    en: `${BASE_URL}${basePath}${separator}hl=en`,
    zh: `${BASE_URL}${basePath}${separator}hl=zh`,
    'zh-TW': `${BASE_URL}${basePath}${separator}hl=zh-TW`,
    ko: `${BASE_URL}${basePath}${separator}hl=ko`,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ['ja', 'en', 'zh', 'zh-TW', 'ko'];

  // Static pages with high priority and daily updates
  // ?hl=パラメータ方式: デフォルト(ja)はパラメータなし、他言語は?hl=xxで指定
  const staticPages: MetadataRoute.Sitemap = [
    // Home page - canonical URL (all languages share this)
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
      alternates: {
        languages: getLanguageAlternates('/'),
      },
    },
    // Products pages - canonical URL with language alternates
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
      alternates: {
        languages: getLanguageAlternates('/products'),
      },
    },
    // Categories pages (high traffic - GSC shows 357 impressions)
    {
      url: `${BASE_URL}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
      alternates: {
        languages: getLanguageAlternates('/categories'),
      },
    },
    // Actress list pages
    {
      url: `${BASE_URL}/actresses`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
      alternates: {
        languages: getLanguageAlternates('/actresses'),
      },
    },
    // Privacy policy page (no language alternates - Japanese only)
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date('2024-12-09'),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    // Terms of service page (no language alternates - Japanese only)
    {
      url: `${BASE_URL}/terms`,
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

  // 商品ページ - canonical URLはパラメータなし、alternatesで各言語を指定
  const productPages: MetadataRoute.Sitemap = recentProducts.map((product) => ({
    url: `${BASE_URL}/products/${product.id}`,
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

  // 女優ページ - canonical URLはパラメータなし、alternatesで各言語を指定
  // GSC data shows actress pages get most clicks - prioritize them
  const performerPages: MetadataRoute.Sitemap = topPerformers.map((performer) => ({
    url: `${BASE_URL}/actress/${performer.id}`,
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
