/**
 * 商品ID検索のデバッグスクリプト
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { products, productSources } from '../lib/db/schema';
import { sql, or } from 'drizzle-orm';

async function checkProductId() {
  const searchId = 'GS-2131';
  console.log(`Searching for product ID: ${searchId}\n`);

  const db = getDb();

  // 1. productsテーブルで normalized_product_id を検索
  console.log('=== Searching in products table (normalized_product_id) ===');
  const productsResult = await db
    .select()
    .from(products)
    .where(
      or(
        sql`${products.normalizedProductId} ILIKE ${'%' + searchId + '%'}`,
        sql`${products.title} ILIKE ${'%' + searchId + '%'}`
      )!
    )
    .limit(10);

  console.log(`Found ${productsResult.length} products:`);
  for (const p of productsResult) {
    console.log(`  - ID: ${p.id}, NormalizedID: ${p.normalizedProductId}, Title: ${p.title?.substring(0, 50)}`);
  }

  // 2. product_sourcesテーブルで original_product_id を検索
  console.log('\n=== Searching in product_sources table (original_product_id) ===');
  const sourcesResult = await db
    .select()
    .from(productSources)
    .where(sql`${productSources.originalProductId} ILIKE ${'%' + searchId + '%'}`)
    .limit(10);

  console.log(`Found ${sourcesResult.length} product sources:`);
  for (const s of sourcesResult) {
    console.log(`  - ProductID: ${s.productId}, ASP: ${s.aspName}, OriginalID: ${s.originalProductId}`);
  }

  // 3. 完全一致検索
  console.log('\n=== Exact match search ===');
  const exactMatch = await db
    .select()
    .from(productSources)
    .where(sql`${productSources.originalProductId} = ${searchId}`)
    .limit(5);

  console.log(`Exact match found: ${exactMatch.length}`);
  for (const s of exactMatch) {
    console.log(`  - ProductID: ${s.productId}, ASP: ${s.aspName}, OriginalID: ${s.originalProductId}`);
  }

  // 4. 大文字小文字を区別しない完全一致
  console.log('\n=== Case-insensitive exact match ===');
  const caseInsensitiveExact = await db
    .select()
    .from(productSources)
    .where(sql`LOWER(${productSources.originalProductId}) = LOWER(${searchId})`)
    .limit(5);

  console.log(`Case-insensitive exact match found: ${caseInsensitiveExact.length}`);
  for (const s of caseInsensitiveExact) {
    console.log(`  - ProductID: ${s.productId}, ASP: ${s.aspName}, OriginalID: ${s.originalProductId}`);
  }

  // 5. GSで始まるproduct IDをいくつか表示
  console.log('\n=== Sample GS-* product IDs ===');
  const gsSamples = await db
    .select()
    .from(productSources)
    .where(sql`${productSources.originalProductId} ILIKE 'GS-%'`)
    .limit(10);

  console.log(`Sample GS-* products: ${gsSamples.length}`);
  for (const s of gsSamples) {
    console.log(`  - ProductID: ${s.productId}, ASP: ${s.aspName}, OriginalID: ${s.originalProductId}`);
  }
}

checkProductId()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
