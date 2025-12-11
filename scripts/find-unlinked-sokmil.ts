import { getDb } from "../packages/crawlers/src/lib/db";
import { products, productSources, productPerformers } from "../packages/crawlers/src/lib/db/schema";
import { eq, sql, inArray, notInArray } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== SOKMIL未紐付け商品を検索 ===\n");

  // 紐付け済み商品IDを取得
  const linkedIds = await db
    .selectDistinct({ productId: productPerformers.productId })
    .from(productPerformers);

  console.log("総紐付け済み商品数:", linkedIds.length);

  // SOKMIL商品を取得
  const sokmilProducts = await db
    .select({
      productId: productSources.productId,
      originalProductId: productSources.originalProductId,
    })
    .from(productSources)
    .where(eq(productSources.aspName, "SOKMIL"))
    .limit(200);

  console.log("取得したSOKMIL商品数:", sokmilProducts.length);

  const linkedIdSet = new Set(linkedIds.map(r => r.productId));
  const unlinkedSokmil = sokmilProducts.filter(p => !linkedIdSet.has(p.productId));

  console.log("未紐付けSOKMIL商品数:", unlinkedSokmil.length);

  for (const p of unlinkedSokmil.slice(0, 10)) {
    console.log("  - " + p.originalProductId);
  }
}

main().catch(console.error).finally(() => process.exit(0));
