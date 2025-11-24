import { MetadataRoute } from 'next';
import { getDb } from '@/lib/db';
import { products, performers } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();

  // Static pages with high priority and daily updates
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/ja`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
      alternates: {
        languages: {
          ja: `${BASE_URL}/ja`,
          en: `${BASE_URL}/en`,
          zh: `${BASE_URL}/zh`,
        },
      },
    },
    {
      url: `${BASE_URL}/en`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
      alternates: {
        languages: {
          ja: `${BASE_URL}/ja`,
          en: `${BASE_URL}/en`,
          zh: `${BASE_URL}/zh`,
        },
      },
    },
    {
      url: `${BASE_URL}/zh`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
      alternates: {
        languages: {
          ja: `${BASE_URL}/ja`,
          en: `${BASE_URL}/en`,
          zh: `${BASE_URL}/zh`,
        },
      },
    },
  ];

  // Recent products (1000 items) - SEO priority for content pages
  const recentProducts = await db
    .select({
      id: products.id,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .orderBy(desc(products.releaseDate))
    .limit(1000);

  const productPages: MetadataRoute.Sitemap = recentProducts.map((product) => ({
    url: `${BASE_URL}/ja/products/${product.id}`,
    lastModified: product.updatedAt || new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    alternates: {
      languages: {
        ja: `${BASE_URL}/ja/products/${product.id}`,
        en: `${BASE_URL}/en/products/${product.id}`,
        zh: `${BASE_URL}/zh/products/${product.id}`,
      },
    },
  }));

  // Top performers (500 items) - Prioritize performers with most products
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
    .limit(500);

  const performerPages: MetadataRoute.Sitemap = topPerformers.map((performer) => ({
    url: `${BASE_URL}/ja/actress/${performer.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
    alternates: {
      languages: {
        ja: `${BASE_URL}/ja/actress/${performer.id}`,
        en: `${BASE_URL}/en/actress/${performer.id}`,
        zh: `${BASE_URL}/zh/actress/${performer.id}`,
      },
    },
  }));

  return [...staticPages, ...productPages, ...performerPages];
}
