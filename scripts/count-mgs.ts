import { getDb } from "../packages/crawlers/src/lib/db";
import { productSources } from "../packages/crawlers/src/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";

const db = getDb();

async function main() {
  // 方法1: eq()を使用
  const [count1] = await db.select({ count: count() })
    .from(productSources)
    .where(eq(productSources.aspName, "MGS"));
  console.log("MGS件数 (eq):", count1.count);

  // 方法2: sqlを使用
  const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM product_sources WHERE asp_name = 'MGS'`);
  console.log("MGS件数 (raw SQL):", result.rows[0]);

  // product_id >= 956200 のMGS件数
  const result2 = await db.execute(sql`SELECT COUNT(*) as cnt FROM product_sources WHERE asp_name = 'MGS' AND product_id >= 956200`);
  console.log("MGS件数 (product_id >= 956200):", result2.rows[0]);
}
main().catch(console.error).finally(() => process.exit(0));
