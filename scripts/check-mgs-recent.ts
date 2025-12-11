import { getDb } from "../packages/crawlers/src/lib/db";
import { products, productSources } from "../packages/crawlers/src/lib/db/schema";
import { sql, eq, and, gte } from "drizzle-orm";

async function main() {
  const db = getDb();

  // MGSの最近追加された商品数
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const recentMgs = await db.select({ count: sql<number>`count(*)` })
    .from(products)
    .innerJoin(productSources, eq(products.id, productSources.productId))
    .where(and(
      eq(productSources.aspName, "MGS"),
      gte(products.createdAt, yesterday)
    ));

  console.log("直近24時間のMGS追加商品:", recentMgs[0]?.count);

  // 総MGS商品数
  const totalMgs = await db.select({ count: sql<number>`count(*)` })
    .from(productSources)
    .where(eq(productSources.aspName, "MGS"));

  console.log("総MGS商品数:", totalMgs[0]?.count);
}

main().catch(console.error).finally(() => process.exit(0));
