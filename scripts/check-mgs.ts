import { getDb } from "../packages/crawlers/src/lib/db";
import { products, productSources } from "../packages/crawlers/src/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== MGS データ確認 ===\n");

  // 最大のproducts IDを確認
  const [maxId] = await db.select({ maxId: sql<number>`MAX(id)` }).from(products);
  console.log("最大商品ID:", maxId.maxId);

  // 最新のMGS商品を確認
  const latestMgs = await db.select({
    productId: productSources.productId,
    originalProductId: productSources.originalProductId,
    createdAt: productSources.createdAt
  })
  .from(productSources)
  .where(eq(productSources.aspName, "MGS"))
  .orderBy(desc(productSources.createdAt))
  .limit(5);

  console.log("\n最新MGS商品 (created_at順):");
  for (const m of latestMgs) {
    console.log(`  ProductID: ${m.productId}, OriginalID: ${m.originalProductId}, Created: ${m.createdAt}`);
  }
  
  // 今日追加されたMGS商品数
  const today = new Date().toISOString().split('T')[0];
  const [todayCount] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(productSources)
    .where(sql`asp_name = 'MGS' AND DATE(created_at) = ${today}`);
  console.log("\n今日追加されたMGS商品数:", todayCount.count);
}
main().catch(console.error).finally(() => process.exit(0));
