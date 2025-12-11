import { getDb } from "../packages/crawlers/src/lib/db";
import { productReviews, productRatingSummary } from "../packages/crawlers/src/lib/db/schema";
import { sql, count } from "drizzle-orm";

async function main() {
  const db = getDb();

  const [reviewCount] = await db.select({ count: count() }).from(productReviews);
  console.log("総レビュー数:", reviewCount.count);

  const [summaryCount] = await db.select({ count: count() }).from(productRatingSummary);
  console.log("レビューサマリー数:", summaryCount.count);

  // サンプルレビュー
  const sampleReviews = await db.select().from(productReviews).limit(3);
  console.log("\nサンプルレビュー:");
  for (const r of sampleReviews) {
    console.log(`  - Product ${r.productId}: ${r.reviewerName} - ${r.comment?.substring(0, 50)}...`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
