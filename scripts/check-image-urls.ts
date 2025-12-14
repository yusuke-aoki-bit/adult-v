import { getDb } from '../packages/crawlers/src/lib/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log("=== 商品画像URL状態確認 ===\n");

  // 画像URLの状態を確認
  const stats = await db.execute(sql`
    SELECT
      CASE
        WHEN default_thumbnail_url IS NULL THEN 'NULL'
        WHEN default_thumbnail_url = '' THEN 'EMPTY'
        WHEN default_thumbnail_url LIKE 'http%' THEN 'VALID'
        ELSE 'OTHER'
      END as status,
      COUNT(*) as count
    FROM products
    GROUP BY
      CASE
        WHEN default_thumbnail_url IS NULL THEN 'NULL'
        WHEN default_thumbnail_url = '' THEN 'EMPTY'
        WHEN default_thumbnail_url LIKE 'http%' THEN 'VALID'
        ELSE 'OTHER'
      END
  `);

  console.log("--- 画像URL状態 ---");
  for (const row of stats.rows as any[]) {
    console.log(`${row.status}: ${row.count}`);
  }

  // 最新の商品の画像URL確認
  const recent = await db.execute(sql`
    SELECT id, default_thumbnail_url, title
    FROM products
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log("\n--- 最新商品の画像URL ---");
  for (const row of recent.rows as any[]) {
    const url = row.default_thumbnail_url || "NULL";
    console.log(`${row.id}: ${url.substring(0, 80)}${url.length > 80 ? "..." : ""}`);
  }

  // product_imagesテーブルも確認
  const imgStats = await db.execute(sql`
    SELECT
      image_type,
      COUNT(*) as count
    FROM product_images
    GROUP BY image_type
    ORDER BY count DESC
  `);

  console.log("\n--- product_images テーブル ---");
  for (const row of imgStats.rows as any[]) {
    console.log(`${row.image_type}: ${row.count}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
