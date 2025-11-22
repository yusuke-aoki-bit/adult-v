/**
 * 既存のDUGA商品のアフィリエイトURLを更新するスクリプト
 * Run with: DATABASE_URL="..." npx tsx scripts/update-duga-affiliate-urls.ts
 */

import { getDb } from '../lib/db/index';
import { productCache } from '../lib/db/schema';
import { eq, like, and, not } from 'drizzle-orm';
import { generateDUGALink } from '../lib/affiliate';

async function updateDugaAffiliateUrls() {
  console.log('Updating DUGA affiliate URLs...\n');

  const db = getDb();

  // DUGAの商品を取得（affidパラメータがないもの）
  const dugaProducts = await db
    .select()
    .from(productCache)
    .where(
      and(
        eq(productCache.aspName, 'DUGA'),
        not(like(productCache.affiliateUrl, '%affid=%'))
      )
    );

  console.log(`Found ${dugaProducts.length} DUGA products without affiliate ID\n`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const product of dugaProducts) {
    try {
      if (!product.affiliateUrl) {
        console.log(`  Skipping product ${product.id}: No affiliate URL`);
        errorCount++;
        continue;
      }

      const newUrl = generateDUGALink(product.affiliateUrl);

      await db
        .update(productCache)
        .set({ affiliateUrl: newUrl })
        .where(eq(productCache.id, product.id));

      updatedCount++;

      if (updatedCount % 100 === 0) {
        console.log(`Updated ${updatedCount} products...`);
      }
    } catch (error) {
      console.error(`Error updating product ${product.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n✅ Update complete!`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Errors: ${errorCount}`);
}

updateDugaAffiliateUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
