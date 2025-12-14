/**
 * 未使用インデックス削除スクリプト
 */
import { getDb } from "../packages/crawlers/src/lib/db/index.js";
import { sql } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== 未使用インデックス削除 ===\n");

  const indexesToDrop = [
    "idx_products_fts",           // 185 MB, 0 scans
    "idx_products_title_gin",     // 34 MB, 0 scans
    "idx_products_description_trgm", // 383 MB, 21 scans
    "idx_products_search_vector", // 194 MB, 8 scans
  ];

  for (const idx of indexesToDrop) {
    try {
      console.log(`Dropping ${idx}...`);
      await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(idx)}`);
      console.log(`  ✅ Dropped ${idx}`);
    } catch (e: any) {
      console.log(`  ✗ Failed: ${e.message}`);
    }
  }

  // 削除後のサイズ確認
  console.log("\n=== インデックスサイズ確認 ===");
  const sizes = await db.execute(sql`
    SELECT
      indexrelname AS index_name,
      pg_size_pretty(pg_relation_size(indexrelid)) AS size
    FROM pg_stat_user_indexes
    WHERE relname = 'products'
    ORDER BY pg_relation_size(indexrelid) DESC
  `);

  for (const row of sizes.rows as any[]) {
    console.log(`  ${row.index_name}: ${row.size}`);
  }

  console.log("\n=== 完了 ===");
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
