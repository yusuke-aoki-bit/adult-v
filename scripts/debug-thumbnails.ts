import { db } from '../packages/database/src/index.js';
import { products } from '../packages/database/src/schema.js';
import { desc, isNull, sql } from 'drizzle-orm';

async function main() {
  // 最新の商品のサムネイル状況を確認
  const recent = await db.select({
    id: products.id,
    thumbnail: products.defaultThumbnailUrl,
  }).from(products)
    .orderBy(desc(products.createdAt))
    .limit(20);

  console.log('=== 最新20件のサムネイル状況 ===');
  for (const p of recent) {
    const hasThumb = p.thumbnail ? '✓' : '✗';
    console.log(`${hasThumb} | ${p.id} | ${p.thumbnail?.substring(0, 70) || 'NULL'}`);
  }

  // サムネイルがnullの商品数
  const nullCount = await db.select({ count: sql`count(*)` })
    .from(products)
    .where(isNull(products.defaultThumbnailUrl));
  console.log(`\nサムネイルがNULLの商品数: ${nullCount[0].count}`);

  process.exit(0);
}

main().catch(console.error);
