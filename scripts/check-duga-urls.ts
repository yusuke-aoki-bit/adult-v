/**
 * DUGAアフィリエイトURLの確認スクリプト
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { productCache } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function checkDugaUrls() {
  console.log('Checking DUGA affiliate URLs...\n');

  const db = getDb();

  // DUGAの総数
  const totalCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(productCache)
    .where(eq(productCache.aspName, 'DUGA'));

  console.log(`Total DUGA products: ${totalCount[0].count}`);

  // affidパラメータが含まれているURL数
  const withAffidCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(productCache)
    .where(sql`${productCache.aspName} = 'DUGA' AND ${productCache.affiliateUrl} LIKE '%affid=%'`);

  console.log(`With affid parameter: ${withAffidCount[0].count}`);

  // affidパラメータがないURL数
  const withoutAffidCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(productCache)
    .where(sql`${productCache.aspName} = 'DUGA' AND ${productCache.affiliateUrl} NOT LIKE '%affid=%'`);

  console.log(`Without affid parameter: ${withoutAffidCount[0].count}`);

  // サンプルURLを確認
  const samples = await db
    .select({
      id: productCache.id,
      url: productCache.affiliateUrl,
    })
    .from(productCache)
    .where(eq(productCache.aspName, 'DUGA'))
    .limit(5);

  console.log('\nSample DUGA URLs:');
  for (const s of samples) {
    console.log(`  ${s.url}`);
    console.log(`    Has affid: ${s.url?.includes('affid=') ?? false}`);
  }

  // Check specific product
  console.log('\n=== Checking dands-0120 ===');
  const specific = await db.execute(sql`
    SELECT affiliate_url FROM product_cache
    WHERE affiliate_url LIKE '%dands-0120%'
    LIMIT 5
  `);
  console.log('product_cache:');
  for (const row of specific.rows) {
    console.log(`  ${row.affiliate_url}`);
  }

  const specific2 = await db.execute(sql`
    SELECT affiliate_url FROM product_sources
    WHERE affiliate_url LIKE '%dands-0120%'
    LIMIT 5
  `);
  console.log('product_sources:');
  for (const row of specific2.rows) {
    console.log(`  ${row.affiliate_url}`);
  }

  // Check for http://duga.jp format (wrong format)
  console.log('\n=== Wrong format check ===');
  const wrongFormat = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM product_cache
    WHERE asp_name = 'DUGA' AND affiliate_url LIKE 'http://duga.jp/%'
  `);
  console.log(`http://duga.jp format: ${wrongFormat.rows[0].cnt}`);

  const correctFormat = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM product_cache
    WHERE asp_name = 'DUGA' AND affiliate_url LIKE 'https://click.duga.jp/%'
  `);
  console.log(`https://click.duga.jp format: ${correctFormat.rows[0].cnt}`);
}

checkDugaUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
