import { getDb } from "../packages/crawlers/src/lib/db";
import { sql } from "drizzle-orm";

const db = getDb();

async function main() {
  // productsテーブルの品番形式
  console.log("=== productsテーブルのnormalized_product_id形式 ===");
  const productSamples = await db.execute(sql`
    SELECT normalized_product_id, title
    FROM products
    ORDER BY id DESC
    LIMIT 20
  `);
  console.log("最新サンプル:");
  for (const row of productSamples.rows) {
    console.log("  " + row.normalized_product_id);
  }

  // wiki_crawl_dataの品番形式
  console.log("\n=== wiki_crawl_dataのproduct_code形式 ===");
  const wikiSamples = await db.execute(sql`
    SELECT product_code, performer_name
    FROM wiki_crawl_data
    ORDER BY id DESC
    LIMIT 20
  `);
  console.log("最新サンプル:");
  for (const row of wikiSamples.rows) {
    console.log("  " + row.product_code + " -> " + row.performer_name);
  }

  // 一致するものを探す（大文字小文字無視）
  console.log("\n=== 完全一致確認 ===");
  const matchCount = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM products p
    INNER JOIN wiki_crawl_data w ON UPPER(p.normalized_product_id) = UPPER(w.product_code)
  `);
  console.log("一致件数:", matchCount.rows[0].cnt);

  // 一致サンプル
  const matchSample = await db.execute(sql`
    SELECT p.normalized_product_id, w.product_code, w.performer_name, p.title
    FROM products p
    INNER JOIN wiki_crawl_data w ON UPPER(p.normalized_product_id) = UPPER(w.product_code)
    LIMIT 10
  `);
  console.log("一致サンプル:");
  for (const row of matchSample.rows) {
    console.log("  " + row.normalized_product_id + " = " + row.product_code + " -> " + row.performer_name);
  }

  // MGS商品の品番形式
  console.log("\n=== MGS商品の品番形式 ===");
  const mgsSamples = await db.execute(sql`
    SELECT p.normalized_product_id, ps.original_product_id
    FROM products p
    INNER JOIN product_sources ps ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    LIMIT 20
  `);
  console.log("MGS商品:");
  for (const row of mgsSamples.rows) {
    console.log("  normalized: " + row.normalized_product_id + " / original: " + row.original_product_id);
  }
}

main().catch(console.error).finally(() => process.exit(0));
