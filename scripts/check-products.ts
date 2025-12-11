import { getDb } from "../packages/crawlers/src/lib/db";
import { products } from "../packages/crawlers/src/lib/db/schema";
import { sql, count, like } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== Products テーブル確認 ===\n");

  // 総商品数
  const [total] = await db.select({ count: count() }).from(products);
  console.log("総商品数:", total.count);

  // MGS関連の商品数 (normalizedProductIdでカウント)
  const [mgsProducts] = await db.select({ count: count() })
    .from(products)
    .where(like(products.normalizedProductId, "MGS-%"));
  console.log("MGS商品数 (normalizedProductId):", mgsProducts.count);

  // 商品ID 956200以上
  const [recent] = await db.select({ count: count() })
    .from(products)
    .where(sql`id >= 956200`);
  console.log("商品ID >= 956200:", recent.count);
  
  // 最大商品ID
  const [maxId] = await db.select({ maxId: sql<number>`MAX(id)` }).from(products);
  console.log("最大商品ID:", maxId.maxId);
}
main().catch(console.error).finally(() => process.exit(0));
