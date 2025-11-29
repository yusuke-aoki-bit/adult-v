import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== 商品ID 6620 の詳細確認 ===\n');

  // 基本情報
  const product = await db.execute(sql`
    SELECT
      p.id,
      p.normalized_product_id,
      p.title,
      p.default_thumbnail_url,
      p.description,
      p.release_date,
      p.duration
    FROM products p
    WHERE p.id = 6620
  `);

  console.log('【基本情報】');
  console.table(product.rows);

  // ソース情報
  const sources = await db.execute(sql`
    SELECT
      ps.asp_name,
      ps.original_product_id,
      ps.affiliate_url,
      ps.price,
      ps.data_source
    FROM product_sources ps
    WHERE ps.product_id = 6620
  `);

  console.log('\n【ソース情報】');
  console.table(sources.rows);

  // 画像情報
  const images = await db.execute(sql`
    SELECT
      pi.asp_name,
      pi.image_type,
      pi.image_url,
      pi.display_order
    FROM product_images pi
    WHERE pi.product_id = 6620
    ORDER BY pi.image_type, pi.display_order
  `);

  console.log('\n【画像情報】');
  console.table(images.rows);

  // 出演者情報
  const performers = await db.execute(sql`
    SELECT
      perf.id,
      perf.name,
      perf.image_url
    FROM product_performers pp
    JOIN performers perf ON pp.performer_id = perf.id
    WHERE pp.product_id = 6620
  `);

  console.log('\n【出演者情報】');
  console.table(performers.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
