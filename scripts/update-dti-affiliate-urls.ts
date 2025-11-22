/**
 * 既存のDTI商品のアフィリエイトURLを更新するスクリプト
 * HEYZO, カリビアンコムプレミアム等のURLをclear-tv.com形式に変換
 * Run with: DATABASE_URL="..." npx tsx scripts/update-dti-affiliate-urls.ts
 */

import { getDb } from '../lib/db/index';
import { productCache } from '../lib/db/schema';
import { eq, like, or, and, not } from 'drizzle-orm';
import { generateDTILink } from '../lib/affiliate';

async function updateDtiAffiliateUrls() {
  console.log('Updating DTI affiliate URLs...\n');

  const db = getDb();

  // DTIサイトの商品を取得（clear-tv.comでないもの）
  const dtiProducts = await db
    .select()
    .from(productCache)
    .where(
      and(
        eq(productCache.aspName, 'DTI'),
        not(like(productCache.affiliateUrl, '%clear-tv.com%')),
        or(
          like(productCache.affiliateUrl, '%heyzo.com%'),
          like(productCache.affiliateUrl, '%caribbeancompr.com%'),
          like(productCache.affiliateUrl, '%caribbeancom.com%'),
          like(productCache.affiliateUrl, '%1pondo.tv%')
        )
      )
    );

  console.log(`Found ${dtiProducts.length} DTI products to update\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const product of dtiProducts) {
    try {
      if (!product.affiliateUrl) {
        console.log(`  Skipping product ${product.id}: No affiliate URL`);
        skippedCount++;
        continue;
      }

      const newUrl = generateDTILink(product.affiliateUrl);

      // 変換が成功したか確認（clear-tv.comが含まれていれば成功）
      if (newUrl.includes('clear-tv.com')) {
        await db
          .update(productCache)
          .set({ affiliateUrl: newUrl })
          .where(eq(productCache.id, product.id));

        updatedCount++;

        if (updatedCount % 100 === 0) {
          console.log(`Updated ${updatedCount} products...`);
        }
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error(`Error updating product ${product.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n✅ Update complete!`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

updateDtiAffiliateUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
