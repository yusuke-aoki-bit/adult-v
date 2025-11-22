/**
 * データベース内の商品IDサンプルを確認するスクリプト
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { products, productSources } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

async function checkSampleProducts() {
  console.log('Checking sample products in database...\n');

  const db = getDb();

  // 各ASPごとにサンプル商品IDを取得
  const aspList = ['DMM', 'DUGA', 'SOKMIL', 'DTI'];

  for (const asp of aspList) {
    console.log(`\n=== ${asp} Sample Product IDs ===`);
    const samples = await db
      .select({
        productId: productSources.productId,
        aspName: productSources.aspName,
        originalProductId: productSources.originalProductId,
        affiliateUrl: productSources.affiliateUrl,
      })
      .from(productSources)
      .where(sql`${productSources.aspName} = ${asp}`)
      .limit(10);

    console.log(`Found ${samples.length} samples:`);
    for (const s of samples) {
      console.log(`  - OriginalID: ${s.originalProductId}, URL: ${s.affiliateUrl?.substring(0, 60)}...`);
    }
  }

  // Total count per ASP
  console.log('\n=== Total Products per ASP ===');
  const counts = await db
    .select({
      aspName: productSources.aspName,
      count: sql<number>`count(*)`,
    })
    .from(productSources)
    .groupBy(productSources.aspName);

  for (const c of counts) {
    console.log(`  ${c.aspName}: ${c.count} products`);
  }

  // Check normalized_product_id patterns
  console.log('\n=== Sample normalized_product_id patterns ===');
  const normalizedSamples = await db
    .select({
      normalizedProductId: products.normalizedProductId,
      title: products.title,
    })
    .from(products)
    .limit(20);

  for (const p of normalizedSamples) {
    console.log(`  - ${p.normalizedProductId}: ${p.title?.substring(0, 50)}...`);
  }
}

checkSampleProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
