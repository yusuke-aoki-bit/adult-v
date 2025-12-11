import { getDb } from "../packages/crawlers/src/lib/db";
import { performers, productPerformers, products } from "../packages/crawlers/src/lib/db/schema";
import { sql, count } from "drizzle-orm";

async function main() {
  const db = getDb();

  const [performerCount] = await db.select({ count: count() }).from(performers);
  console.log("総演者数:", performerCount.count);

  const [linkCount] = await db.select({ count: count() }).from(productPerformers);
  console.log("商品-演者リンク:", linkCount.count);

  // 演者紐付けなしの商品数
  const unlinkedResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id
    )
  `);
  console.log("演者未紐付け商品:", (unlinkedResult as any).rows[0].count);

  // 総商品数
  const [productCount] = await db.select({ count: count() }).from(products);
  console.log("総商品数:", productCount.count);

  // 紐付け率
  const linkedCount = productCount.count - parseInt((unlinkedResult as any).rows[0].count);
  console.log("紐付け率:", ((linkedCount / productCount.count) * 100).toFixed(1) + "%");
}

main().catch(console.error).finally(() => process.exit(0));
