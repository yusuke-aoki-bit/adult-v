import { getDb } from '@/lib/db';
import { products, performers } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

// ISRキャッシュ: 1時間（DBクエリを毎回実行しないように）
export const revalidate = 3600;

/**
 * Sitemap Index - Lists all sitemap files
 * Google recommends splitting large sitemaps into multiple files (max 50,000 URLs each)
 */
export default async function sitemapIndex() {
  const sitemaps: { url: string; lastModified?: Date }[] = [
    {
      url: `${BASE_URL}/sitemap.xml`,
      lastModified: new Date(),
    },
  ];

  try {
    const db = getDb();

    // Count total products and performers
    const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(products);

    const [performerCount] = await db.select({ count: sql<number>`count(*)` }).from(performers);

    const totalProducts = Number(productCount!.count);
    const totalPerformers = Number(performerCount!.count);

    // Products: Split into chunks of 10,000 (for performance)
    const productChunkSize = 10000;
    const productChunks = Math.ceil(totalProducts / productChunkSize);

    for (let i = 0; i < productChunks; i++) {
      sitemaps.push({
        url: `${BASE_URL}/sitemap-products-${i}.xml`,
        lastModified: new Date(),
      });
    }

    // Performers: Split into chunks of 5,000
    const performerChunkSize = 5000;
    const performerChunks = Math.ceil(totalPerformers / performerChunkSize);

    for (let i = 0; i < performerChunks; i++) {
      sitemaps.push({
        url: `${BASE_URL}/sitemap-actresses-${i}.xml`,
        lastModified: new Date(),
      });
    }

    return sitemaps;
  } catch (error) {
    console.error('Error generating sitemap index:', error);
    return sitemaps;
  }
}
