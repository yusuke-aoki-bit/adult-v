import { getDb } from "../packages/crawlers/src/lib/db";
import { products, productSources, productPerformers } from "../packages/crawlers/src/lib/db/schema";
import { eq, sql, count, notInArray, isNull } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== 演者紐付け状況 ===\n");

  // 総商品数
  const [totalCount] = await db.select({ count: count() }).from(products);
  console.log("総商品数:", totalCount.count);

  // 紐付け済み商品数（productPerformersにレコードがある商品）
  const linkedProductIds = await db
    .selectDistinct({ productId: productPerformers.productId })
    .from(productPerformers);

  console.log("演者紐付け済み商品数:", linkedProductIds.length);
  console.log("演者未紐付け商品数:", totalCount.count - linkedProductIds.length);

  // ASP別の状況
  console.log("\n📊 ASP別:");

  const aspStats = await db
    .select({
      aspName: productSources.aspName,
      count: count(),
    })
    .from(productSources)
    .groupBy(productSources.aspName)
    .orderBy(sql`count(*) DESC`);

  const linkedIdSet = new Set(linkedProductIds.map(r => r.productId));

  for (const asp of aspStats) {
    // このASPの商品IDを取得
    const aspProducts = await db
      .select({ productId: productSources.productId })
      .from(productSources)
      .where(eq(productSources.aspName, asp.aspName));

    const unlinkedCount = aspProducts.filter(p => !linkedIdSet.has(p.productId)).length;
    const linkedCount = asp.count - unlinkedCount;
    const linkRate = ((linkedCount / asp.count) * 100).toFixed(1);

    console.log(`  ${asp.aspName}: ${linkedCount}/${asp.count} (${linkRate}% 紐付け済み)`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
