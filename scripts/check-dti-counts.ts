/**
 * DTIサイトごとの商品件数を確認
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { products } from '../lib/db/schema';
import { like, sql, count } from 'drizzle-orm';

async function checkCounts() {
  const db = getDb();

  // HEYZOの件数
  const heyzoCount = await db
    .select({ count: count() })
    .from(products)
    .where(like(products.normalizedProductId, 'HEYZO-%'));

  // カリビアンコムプレミアムの件数
  const caribbeanprCount = await db
    .select({ count: count() })
    .from(products)
    .where(like(products.normalizedProductId, 'カリビアンコムプレミアム-%'));

  // 一本道の件数
  const ippondoCount = await db
    .select({ count: count() })
    .from(products)
    .where(like(products.normalizedProductId, '一本道-%'));

  // カリビアンコム（プレミアムでない）の件数
  const caribbeanCount = await db
    .select({ count: count() })
    .from(products)
    .where(sql`${products.normalizedProductId} LIKE 'カリビアンコム-%' AND ${products.normalizedProductId} NOT LIKE 'カリビアンコムプレミアム-%'`);

  console.log('DTI Sites Product Counts:');
  console.log(`  HEYZO: ${heyzoCount[0].count}`);
  console.log(`  カリビアンコムプレミアム: ${caribbeanprCount[0].count}`);
  console.log(`  一本道: ${ippondoCount[0].count}`);
  console.log(`  カリビアンコム: ${caribbeanCount[0].count}`);

  // 一本道の実際のデータを確認
  const ippondoSamples = await db
    .select()
    .from(products)
    .where(like(products.normalizedProductId, '一本道-%'))
    .limit(5);

  console.log('\n一本道のサンプルデータ:');
  for (const p of ippondoSamples) {
    console.log(`  ${p.normalizedProductId}: ${p.title}`);
  }
}

checkCounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
