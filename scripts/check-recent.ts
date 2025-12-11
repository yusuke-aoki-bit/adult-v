import { getDb } from "../packages/crawlers/src/lib/db";
import { products, productSources } from "../packages/crawlers/src/lib/db/schema";
import { sql, desc } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== 最近追加された商品 ===\n");

  // 商品ID >= 956200 の商品を確認
  const recent = await db.select({
    id: products.id,
    normalizedProductId: products.normalizedProductId,
    title: products.title
  })
  .from(products)
  .where(sql`id >= 956200`)
  .orderBy(desc(products.id))
  .limit(10);

  console.log("最近追加された商品 (ID >= 956200):");
  for (const p of recent) {
    const title = p.title ? p.title.substring(0, 40) : "N/A";
    console.log(`  ID: ${p.id}, NormID: ${p.normalizedProductId}, Title: ${title}`);
  }

  // これらの商品のproduct_sourcesを確認
  console.log("\n対応するproduct_sources:");
  const sources = await db.select({
    productId: productSources.productId,
    aspName: productSources.aspName,
    originalProductId: productSources.originalProductId
  })
  .from(productSources)
  .where(sql`product_id >= 956200`)
  .limit(10);

  for (const s of sources) {
    console.log(`  ProductID: ${s.productId}, ASP: ${s.aspName}, OriginalID: ${s.originalProductId}`);
  }
}
main().catch(console.error).finally(() => process.exit(0));
