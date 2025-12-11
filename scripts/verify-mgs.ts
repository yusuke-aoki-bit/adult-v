import { getDb } from "../packages/crawlers/src/lib/db";
import { sql } from "drizzle-orm";

const db = getDb();

async function main() {
  // product_id < 956200 のMGS件数
  const result1 = await db.execute(sql`SELECT COUNT(*) as cnt FROM product_sources WHERE asp_name = 'MGS' AND product_id < 956200`);
  console.log("MGS件数 (product_id < 956200):", result1.rows[0]);

  // product_id >= 956200 のMGS件数
  const result2 = await db.execute(sql`SELECT COUNT(*) as cnt FROM product_sources WHERE asp_name = 'MGS' AND product_id >= 956200`);
  console.log("MGS件数 (product_id >= 956200):", result2.rows[0]);

  // 合計
  const result3 = await db.execute(sql`SELECT COUNT(*) as cnt FROM product_sources WHERE asp_name = 'MGS'`);
  console.log("MGS件数 (合計):", result3.rows[0]);
  
  console.log("\n計算: 9546 + 112 =", 9546 + 112);
}
main().catch(console.error).finally(() => process.exit(0));
