import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function analyzeSeries() {
  const db = getDb();

  // Get all series patterns from MGS products
  const result = await db.execute(sql`
    SELECT
      SUBSTRING(original_product_id FROM '^[A-Z0-9]+') as series_prefix,
      COUNT(*) as product_count,
      COUNT(CASE WHEN p.default_thumbnail_url IS NOT NULL AND p.default_thumbnail_url != '' THEN 1 END) as with_images,
      COUNT(CASE WHEN p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '' THEN 1 END) as without_images
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    GROUP BY series_prefix
    ORDER BY product_count DESC
    LIMIT 30
  `);

  console.log('=== MGS Series Distribution ===\n');
  console.log('Series'.padEnd(15), 'Total'.padStart(8), 'With Img'.padStart(10), 'Without'.padStart(10), 'Success%'.padStart(10));
  console.log('='.repeat(60));

  for (const row of result.rows) {
    const r = row as any;
    const successRate = r.product_count > 0 ? ((r.with_images / r.product_count) * 100).toFixed(1) : '0.0';
    console.log(
      r.series_prefix.padEnd(15),
      String(r.product_count).padStart(8),
      String(r.with_images).padStart(10),
      String(r.without_images).padStart(10),
      (successRate + '%').padStart(10)
    );
  }
}

analyzeSeries().then(() => process.exit(0));
