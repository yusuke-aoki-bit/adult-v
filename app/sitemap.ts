import { MetadataRoute } from 'next';
import { getDb } from '@/lib/db';
import { products, performers, tags} from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/ja`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/en`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/zh`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Skip database queries during build if DATABASE_URL is not set
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not set, returning static pages only');
    return staticPages;
  }

  try {
    const db = getDb();

    // Recent products (limit 500)
    const recentProducts = await db
      .select({
        id: products.id,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .orderBy(sql`${products.updatedAt} DESC NULLS LAST`)
      .limit(500);

    const productPages: MetadataRoute.Sitemap = recentProducts.map((product) => ({
      url: `${siteUrl}/ja/products/${product.id}`,
      lastModified: product.updatedAt || new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    // All performers
    const allPerformers = await db
      .select({
        id: performers.id,
        createdAt: performers.createdAt,
      })
      .from(performers)
      .orderBy(sql`${performers.createdAt} DESC NULLS LAST`);

    const performerPages: MetadataRoute.Sitemap = allPerformers.map((performer) => ({
      url: `${siteUrl}/ja/performers/${performer.id}`,
      lastModified: performer.createdAt || new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    // All tags
    const allTags = await db
      .select({
        id: tags.id,
        createdAt: tags.createdAt,
      })
      .from(tags)
      .orderBy(sql`${tags.createdAt} DESC NULLS LAST`);

    const tagPages: MetadataRoute.Sitemap = allTags.map((tag) => ({
      url: `${siteUrl}/ja/tags/${tag.id}`,
      lastModified: tag.createdAt || new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    return [...staticPages, ...productPages, ...performerPages, ...tagPages];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return only static pages on error
    return staticPages;
  }
}
