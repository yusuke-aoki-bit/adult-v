import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function investigate() {
  const db = getDb();

  // 1. MGS商品サンプル
  console.log('=== MGS Product Samples ===\n');
  const result = await db.execute(sql`
    SELECT
      ps.product_id,
      ps.original_product_id,
      ps.affiliate_url,
      p.title
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    LIMIT 5
  `);
  console.log(JSON.stringify(result.rows, null, 2));

  // 2. 画像があるMGS商品
  console.log('\n\n=== MGS Products WITH Images ===\n');
  const withImages = await db.execute(sql`
    SELECT
      ps.original_product_id,
      ps.affiliate_url,
      p.default_thumbnail_url
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    AND p.default_thumbnail_url IS NOT NULL
    AND p.default_thumbnail_url != ''
    LIMIT 5
  `);
  console.log(JSON.stringify(withImages.rows, null, 2));

  // 3. 品番のパターン
  console.log('\n\n=== Product ID Patterns ===\n');
  const patterns = await db.execute(sql`
    SELECT
      SUBSTRING(original_product_id FROM 1 FOR 4) as prefix,
      COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'MGS'
    GROUP BY prefix
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(patterns.rows, null, 2));
}

investigate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
