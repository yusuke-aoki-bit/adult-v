/**
 * DTIデータの現状を確認するスクリプト
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { products, productCache } from '../lib/db/schema';
import { eq, like, or } from 'drizzle-orm';

async function checkData() {
  console.log('Checking DTI data...\n');

  const db = getDb();

  // DTI商品を確認
  const dtiCache = await db
    .select()
    .from(productCache)
    .where(eq(productCache.aspName, 'DTI'))
    .limit(20);

  console.log(`Found ${dtiCache.length} DTI products in cache:\n`);

  for (const p of dtiCache) {
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, p.productId))
      .limit(1);

    if (product.length > 0) {
      console.log(`ID: ${p.id}`);
      console.log(`  Product ID: ${product[0].normalizedProductId}`);
      console.log(`  Title: ${product[0].title}`);
      console.log(`  URL: ${p.affiliateUrl}`);
      console.log('');
    }
  }
}

checkData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
