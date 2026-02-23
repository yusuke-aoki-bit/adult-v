/**
 * Discover DB Query Functions
 *
 * These functions are used by the shared discover handler
 * Optimized: Uses 2-phase query to avoid expensive ORDER BY RANDOM() on full join
 */

import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { DiscoverProduct, DiscoverFilters } from '@adult-v/shared/api-handlers';

/**
 * Get random products for discovery feature
 * Web version: excludes FANZA products (due to terms of service)
 *
 * Optimization strategy:
 * 1. First query: Get random IDs quickly using lightweight conditions
 * 2. Second query: Fetch full details only for selected IDs
 */
export async function getRandomProducts(params: {
  excludeIds: number[];
  locale: string;
  filters?: DiscoverFilters;
  limit?: number;
}): Promise<DiscoverProduct[]> {
  const { excludeIds, locale, filters = {}, limit = 6 } = params;
  const db = getDb();

  // Phase 1: Get random product IDs quickly
  const idConditions = [];

  // Exclude IDs
  if (excludeIds.length > 0) {
    idConditions.push(
      sql`p.id NOT IN (${sql.join(
        excludeIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
  }

  // Non-FANZA products only - use JOIN instead of EXISTS for better performance
  idConditions.push(sql`ps.asp_name != 'FANZA'`);

  // Filter: Duration
  if (filters.minDuration) {
    idConditions.push(sql`p.duration >= ${filters.minDuration}`);
  }
  if (filters.maxDuration) {
    idConditions.push(sql`p.duration <= ${filters.maxDuration}`);
  }

  // Filter: Has performer
  if (filters.hasPerformer === true) {
    idConditions.push(sql`EXISTS (SELECT 1 FROM product_performers pp2 WHERE pp2.product_id = p.id)`);
  }

  // Filter: Specific performers
  if (filters.performerIds && filters.performerIds.length > 0) {
    idConditions.push(sql`EXISTS (
      SELECT 1 FROM product_performers pp2
      WHERE pp2.product_id = p.id
      AND pp2.performer_id IN (${sql.join(
        filters.performerIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    )`);
  }

  // Filter: Release date
  if (filters.releasedAfter) {
    idConditions.push(sql`p.release_date >= ${filters.releasedAfter}`);
  }

  // Filter: Genres
  if (filters.genres && filters.genres.length > 0) {
    idConditions.push(sql`EXISTS (
      SELECT 1 FROM product_tags pt
      JOIN tags t ON pt.tag_id = t.id
      WHERE pt.product_id = p.id
      AND t.name IN (${sql.join(
        filters.genres.map((g) => sql`${g}`),
        sql`, `,
      )})
    )`);
  }

  const idWhereClause = idConditions.length > 0 ? sql`WHERE ${sql.join(idConditions, sql` AND `)}` : sql``;

  // Fetch extra IDs to account for products without sample images
  const fetchMultiplier = 3;
  const idsResult = await db.execute(sql`
    SELECT p.id
    FROM products p
    INNER JOIN product_sources ps ON ps.product_id = p.id
    ${idWhereClause}
    ORDER BY RANDOM()
    LIMIT ${limit * fetchMultiplier}
  `);

  if (!idsResult.rows || idsResult.rows.length === 0) {
    return [];
  }

  const candidateIds = idsResult.rows.map((r) => (r as { id: number }).id);

  // Phase 2: Fetch full details for selected IDs
  const titleColumn =
    locale === 'en'
      ? sql`COALESCE(p.title_en, p.title)`
      : locale === 'zh'
        ? sql`COALESCE(p.title_zh, p.title)`
        : locale === 'ko'
          ? sql`COALESCE(p.title_ko, p.title)`
          : sql`p.title`;

  const result = await db.execute(sql`
    SELECT
      p.id,
      ${titleColumn} as title,
      p.default_thumbnail_url as image_url,
      (SELECT array_agg(pi.image_url ORDER BY pi.display_order)
       FROM product_images pi
       WHERE pi.product_id = p.id AND pi.image_type = 'sample'
       LIMIT 10) as sample_images,
      p.release_date,
      p.duration,
      ps.price,
      ps.asp_name as provider,
      ps.affiliate_url,
      (SELECT array_agg(DISTINCT perf.name)
       FROM product_performers pp
       JOIN performers perf ON pp.performer_id = perf.id
       WHERE pp.product_id = p.id) as performers,
      (SELECT array_agg(DISTINCT t.name)
       FROM product_tags pt
       JOIN tags t ON pt.tag_id = t.id
       WHERE pt.product_id = p.id AND (t.category IS NULL OR t.category NOT IN ('maker', 'label'))
       LIMIT 10) as genres,
      (SELECT t.name FROM product_tags pt
       JOIN tags t ON pt.tag_id = t.id
       WHERE pt.product_id = p.id AND t.category = 'maker'
       LIMIT 1) as maker
    FROM products p
    LEFT JOIN LATERAL (
      SELECT price, asp_name, affiliate_url FROM product_sources
      WHERE product_id = p.id AND asp_name != 'FANZA'
      ORDER BY price NULLS LAST
      LIMIT 1
    ) ps ON true
    WHERE p.id IN (${sql.join(
      candidateIds.map((id) => sql`${id}`),
      sql`, `,
    )})
      AND EXISTS (
        SELECT 1 FROM product_images pi
        WHERE pi.product_id = p.id AND pi.image_type = 'sample'
      )
    LIMIT ${limit}
  `);

  if (!result.rows || result.rows.length === 0) {
    return [];
  }

  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r['id'] as number,
      title: r['title'] as string,
      imageUrl: r['image_url'] as string,
      sampleImages: r['sample_images'] as string[] | null,
      releaseDate: r['release_date'] as string | null,
      duration: r['duration'] as number | null,
      price: r['price'] as number | null,
      provider: r['provider'] as string | null,
      affiliateUrl: r['affiliate_url'] as string | null,
      performers: (r['performers'] as string[] | null)?.filter(Boolean) || [],
      genres: (r['genres'] as string[] | null) || [],
      maker: r['maker'] as string | null,
    };
  });
}
