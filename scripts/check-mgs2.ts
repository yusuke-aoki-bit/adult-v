import { getDb } from "../packages/crawlers/src/lib/db";
import { products, productSources } from "../packages/crawlers/src/lib/db/schema";
import { eq, sql, count, gte } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== MGS データ確認 ===\n");

  // MGS商品数
  const [mgsCount] = await db.select({ count: count() })
    .from(productSources)
    .where(eq(productSources.aspName, "MGS"));
  console.log("MGS商品総数:", mgsCount.count);

  // 今日作成されたMGS
  const [todayMgs] = await db.select({ count: count() })
    .from(productSources)
    .where(sql`asp_name = 'MGS' AND created_at >= CURRENT_DATE`);
  console.log("今日追加されたMGS:", todayMgs.count);
  
  // 商品ID 956200以上のMGS
  const [recentMgs] = await db.select({ count: count() })
    .from(productSources)
    .where(sql`asp_name = 'MGS' AND product_id >= 956200`);
  console.log("商品ID >= 956200 のMGS:", recentMgs.count);
}
main().catch(console.error).finally(() => process.exit(0));
