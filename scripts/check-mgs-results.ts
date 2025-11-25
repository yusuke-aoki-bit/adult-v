import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkResults() {
  const db = getDb();

  console.log('=== MGS Products Status ===\n');

  // MGS商品の統計
  const productStats = await db.execute(sql`
    SELECT
      COUNT(*) as total_products,
      COUNT(CASE WHEN p.default_thumbnail_url IS NOT NULL AND p.default_thumbnail_url != '' THEN 1 END) as with_thumb,
      COUNT(CASE WHEN p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '' THEN 1 END) as without_thumb
    FROM products p
    WHERE p.id IN (SELECT product_id FROM product_sources WHERE asp_name = 'MGS')
  `);

  const stats = productStats.rows[0] as any;
  console.log('Total MGS Products:', stats.total_products);
  console.log('With Thumbnail:', stats.with_thumb);
  console.log('Without Thumbnail:', stats.without_thumb);
  console.log(`Success Rate: ${((stats.with_thumb / stats.total_products) * 100).toFixed(2)}%`);

  // MGS画像の統計
  console.log('\n=== MGS Images ===\n');
  const imageStats = await db.execute(sql`
    SELECT
      COUNT(*) as total_images,
      COUNT(CASE WHEN image_type = 'thumbnail' THEN 1 END) as thumbnails,
      COUNT(CASE WHEN image_type = 'sample' THEN 1 END) as samples
    FROM product_images
    WHERE asp_name = 'MGS'
  `);

  const imgStats = imageStats.rows[0] as any;
  console.log('Total Images:', imgStats.total_images);
  console.log('Thumbnails:', imgStats.thumbnails);
  console.log('Sample Images:', imgStats.samples);

  // 最近追加された商品のサンプル
  console.log('\n=== Recent Products with Images ===\n');
  const samples = await db.execute(sql`
    SELECT
      ps.original_product_id,
      p.default_thumbnail_url,
      COUNT(pi.id) as image_count
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.asp_name = 'MGS'
    WHERE ps.asp_name = 'MGS'
    AND p.default_thumbnail_url IS NOT NULL
    AND p.default_thumbnail_url != ''
    GROUP BY ps.original_product_id, p.default_thumbnail_url
    ORDER BY p.id DESC
    LIMIT 5
  `);

  for (const row of samples.rows) {
    const r = row as any;
    console.log(`${r.original_product_id}: ${r.image_count} images`);
    console.log(`  Thumbnail: ${r.default_thumbnail_url}`);
  }
}

checkResults().then(() => process.exit(0));
