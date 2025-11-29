import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== DTI画像統計 ===\n');

  // DTI商品数と画像数
  const stats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT p.id) as products,
      COUNT(pi.id) as total_images,
      COUNT(DISTINCT CASE WHEN pi.image_type = 'thumbnail' THEN p.id END) as with_thumb,
      COUNT(CASE WHEN pi.image_type = 'sample' THEN 1 END) as sample_count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_images pi ON p.id = pi.product_id
    WHERE ps.asp_name = 'DTI'
    GROUP BY ps.asp_name
  `);

  console.log('統計:');
  console.table(stats.rows);

  // サンプル商品の画像情報
  const samples = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      p.normalized_product_id,
      COUNT(pi.id) as image_count,
      STRING_AGG(DISTINCT pi.image_type, ', ') as image_types
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_images pi ON p.id = pi.product_id
    WHERE ps.asp_name = 'DTI'
    GROUP BY p.id, p.title, p.normalized_product_id
    LIMIT 10
  `);

  console.log('\nサンプル商品:');
  console.table(samples.rows);

  // サイト別統計
  const bySite = await db.execute(sql`
    SELECT
      CASE
        WHEN p.normalized_product_id LIKE '一本道%' THEN '一本道'
        WHEN p.normalized_product_id LIKE 'HEYZO%' THEN 'HEYZO'
        WHEN p.normalized_product_id LIKE 'カリビアンコム%' THEN 'カリビアンコム'
        ELSE 'その他'
      END as site,
      COUNT(DISTINCT p.id) as products,
      COUNT(pi.id) as images
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_images pi ON p.id = pi.product_id
    WHERE ps.asp_name = 'DTI'
    GROUP BY site
    ORDER BY products DESC
  `);

  console.log('\nサイト別統計:');
  console.table(bySite.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
