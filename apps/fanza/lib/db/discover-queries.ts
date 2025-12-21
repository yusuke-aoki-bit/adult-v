/**
 * Discover DB Query Functions
 *
 * These functions are used by the shared discover handler
 */

import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { DiscoverProduct } from '@adult-v/shared/api-handlers';

/**
 * Get a random product for discovery feature
 * Fanza version: only FANZA products
 */
export async function getRandomProduct(params: {
  excludeIds: number[];
  locale: string;
}): Promise<DiscoverProduct | null> {
  const { excludeIds, locale } = params;
  const db = getDb();

  const conditions = [];

  // Exclude IDs
  if (excludeIds.length > 0) {
    conditions.push(sql`p.id NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})`);
  }

  // Products with sample images only (check product_images table)
  conditions.push(sql`EXISTS (
    SELECT 1 FROM product_images pi
    WHERE pi.product_id = p.id AND pi.image_type = 'sample'
  )`);

  // FANZA products only (for fanza site)
  conditions.push(sql`EXISTS (
    SELECT 1 FROM product_sources ps2
    WHERE ps2.product_id = p.id AND ps2.asp_name = 'FANZA'
  )`);

  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  // Localized title
  const titleColumn = locale === 'en' ? sql`COALESCE(p.title_en, p.title)`
    : locale === 'zh' ? sql`COALESCE(p.title_zh, p.title)`
    : locale === 'ko' ? sql`COALESCE(p.title_ko, p.title)`
    : sql`p.title`;

  const result = await db.execute(sql`
    SELECT
      p.id,
      ${titleColumn} as title,
      p.default_thumbnail_url as image_url,
      (SELECT array_agg(pi.image_url ORDER BY pi.display_order)
       FROM product_images pi
       WHERE pi.product_id = p.id AND pi.image_type = 'sample') as sample_images,
      p.release_date,
      p.duration,
      ps.price,
      ps.asp_name as provider,
      ps.affiliate_url,
      array_agg(DISTINCT perf.name) FILTER (WHERE perf.name IS NOT NULL) as performers
    FROM products p
    LEFT JOIN LATERAL (
      SELECT price, asp_name, affiliate_url FROM product_sources
      WHERE product_id = p.id AND asp_name = 'FANZA'
      ORDER BY price NULLS LAST
      LIMIT 1
    ) ps ON true
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    LEFT JOIN performers perf ON pp.performer_id = perf.id
    ${whereClause}
    GROUP BY p.id, p.title, p.title_en, p.title_zh, p.title_ko, p.default_thumbnail_url, p.release_date, p.duration, ps.price, ps.asp_name, ps.affiliate_url
    ORDER BY RANDOM()
    LIMIT 1
  `);

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as number,
    title: row.title as string,
    imageUrl: row.image_url as string,
    sampleImages: row.sample_images as string[] | null,
    releaseDate: row.release_date as string | null,
    duration: row.duration as number | null,
    price: row.price as number | null,
    provider: row.provider as string | null,
    affiliateUrl: row.affiliate_url as string | null,
    performers: (row.performers as string[] | null)?.filter(Boolean) || [],
  };
}
