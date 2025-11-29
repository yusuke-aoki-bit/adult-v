import { getDb } from '../lib/db';
import { productSources, products } from '../lib/db/schema';
import { sql, eq } from 'drizzle-orm';

async function investigateMgsData() {
  const db = getDb();

  console.log('=== MGS Product Investigation ===\n');

  // 1. MGS商品の基本情報
  const samples = await db.execute(sql`
    SELECT
      ps.product_id,
      ps.original_product_id,
      ps.source_url,
      p.title,
      p.default_thumbnail_url
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    LIMIT 20
  `);

  console.log('Sample MGS products with URLs:');
  console.log(JSON.stringify(samples.rows, null, 2));

  // 2. 画像がある商品（もしあれば）
  const withImages = await db.execute(sql`
    SELECT ps.original_product_id, ps.source_url, p.title, p.default_thumbnail_url
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    AND p.default_thumbnail_url IS NOT NULL
    AND p.default_thumbnail_url != ''
    LIMIT 10
  `);

  console.log('\n\nMGS products WITH images:');
  console.log(JSON.stringify(withImages.rows, null, 2));

  // 3. originalProductIdのパターン分析
  const patterns = await db.execute(sql`
    SELECT
      SUBSTRING(ps.original_product_id FROM 1 FOR 4) as prefix,
      COUNT(*) as count,
      MIN(ps.original_product_id) as example
    FROM product_sources ps
    WHERE ps.asp_name = 'MGS'
    GROUP BY prefix
    ORDER BY count DESC
    LIMIT 20
  `);

  console.log('\n\nProduct ID patterns (by prefix):');
  console.log(JSON.stringify(patterns.rows, null, 2));

  // 4. ソースURLのパターン分析
  const urlSamples = await db.execute(sql`
    SELECT
      ps.source_url,
      ps.original_product_id,
      COUNT(*) as count
    FROM product_sources ps
    WHERE ps.asp_name = 'MGS'
    AND ps.source_url IS NOT NULL
    GROUP BY ps.source_url, ps.original_product_id
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log('\n\nSource URL samples:');
  console.log(JSON.stringify(urlSamples.rows, null, 2));
}

investigateMgsData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
