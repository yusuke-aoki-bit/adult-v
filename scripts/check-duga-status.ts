/**
 * DUGA商品のメーカー品番の状態を確認するスクリプト
 */

import { getDb } from '../lib/db/index';
import { productSources } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('========================================');
  console.log('DUGA Product Sources Status Check');
  console.log('========================================\n');

  // 全体の統計
  const stats = await db
    .select({
      total: sql<number>`COUNT(*)`,
      withManufacturerCode: sql<number>`COUNT(CASE WHEN ${productSources.originalProductId} ~ '^[A-Z]+-[0-9]+' THEN 1 END)`,
    })
    .from(productSources)
    .where(eq(productSources.aspName, 'DUGA'));

  const total = Number(stats[0].total);
  const withCode = Number(stats[0].withManufacturerCode);
  const withoutCode = total - withCode;
  const percentage = total > 0 ? ((withCode / total) * 100).toFixed(2) : '0.00';

  console.log(`Total DUGA products: ${total}`);
  console.log(`With manufacturer code: ${withCode} (${percentage}%)`);
  console.log(`Without manufacturer code: ${withoutCode}\n`);

  // サンプルデータを表示（メーカー品番がないもの）
  const samplesWithout = await db
    .select({
      id: productSources.id,
      productId: productSources.productId,
      originalProductId: productSources.originalProductId,
    })
    .from(productSources)
    .where(eq(productSources.aspName, 'DUGA'))
    .limit(10);

  console.log('Sample products WITHOUT manufacturer code (first 10):');
  console.log('---------------------------------------------------');
  samplesWithout.forEach((sample, index) => {
    const hasCode = /^[A-Z]+-[0-9]+/.test(sample.originalProductId);
    if (!hasCode) {
      console.log(`${index + 1}. Product ID: ${sample.productId}, Original ID: ${sample.originalProductId}`);
    }
  });

  console.log('\n========================================\n');

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
