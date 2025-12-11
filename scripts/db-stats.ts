import { getDb } from "../packages/crawlers/src/lib/db";
import { products, performers, productPerformers, productSources, productImages, productReviews } from "../packages/crawlers/src/lib/db/schema";
import { sql, count, isNotNull } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== データベース統計 ===\n");

  const [productCount] = await db.select({ count: count() }).from(products);
  console.log("📦 総商品数:", productCount.count);

  const [performerCount] = await db.select({ count: count() }).from(performers);
  console.log("👤 総演者数:", performerCount.count);

  const [linkCount] = await db.select({ count: count() }).from(productPerformers);
  console.log("🔗 商品-演者リンク:", linkCount.count);

  const [imageCount] = await db.select({ count: count() }).from(productImages);
  console.log("🖼️ 商品画像数:", imageCount.count);

  // 翻訳統計
  console.log("\n🌐 翻訳データ:");
  const [enCount] = await db.select({ count: count() }).from(products).where(isNotNull(products.titleEn));
  console.log("  英語翻訳あり:", enCount.count);
  const [zhCount] = await db.select({ count: count() }).from(products).where(isNotNull(products.titleZh));
  console.log("  中国語翻訳あり:", zhCount.count);
  const [koCount] = await db.select({ count: count() }).from(products).where(isNotNull(products.titleKo));
  console.log("  韓国語翻訳あり:", koCount.count);

  // レビュー統計
  console.log("\n⭐ レビューデータ:");
  const [reviewCount] = await db.select({ count: count() }).from(productReviews);
  console.log("  総レビュー数:", reviewCount.count);

  console.log("\n📊 ASP別商品数:");
  const aspCounts = await db.select({
    aspName: productSources.aspName,
    count: count()
  })
  .from(productSources)
  .groupBy(productSources.aspName)
  .orderBy(sql`count(*) DESC`);

  for (const row of aspCounts) {
    console.log(`  ${row.aspName}: ${row.count}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
