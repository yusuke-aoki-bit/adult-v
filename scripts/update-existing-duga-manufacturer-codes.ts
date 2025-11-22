/**
 * 既存のDUGA商品データのメーカー品番を更新するスクリプト
 * 一度きりの実行用（既存データの更新）
 * Run with: DATABASE_URL="..." npx tsx scripts/update-existing-duga-manufacturer-codes.ts
 */

import { getDb } from '../lib/db/index';
import { productSources } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import * as cheerio from 'cheerio';

/**
 * DUGAの商品ページからメーカー品番をスクレイピング
 */
async function fetchManufacturerCode(productId: string): Promise<string | null> {
  try {
    const url = `https://duga.jp/ppv/${productId}/`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // メーカー品番を取得: <span itemprop="mpn">GS-2131</span>
    const manufacturerCode = $('span[itemprop="mpn"]').text().trim();

    if (!manufacturerCode) {
      return null;
    }

    return manufacturerCode;
  } catch (error) {
    console.error(`  Error scraping ${productId}:`, error);
    return null;
  }
}

async function main() {
  const db = getDb();

  console.log('========================================');
  console.log('Updating existing DUGA manufacturer codes');
  console.log('========================================\n');

  // DUGAのproduct_sourcesを取得（originalProductIdがDUGA商品IDと同じ形式のもの）
  const dugaSources = await db
    .select({
      id: productSources.id,
      productId: productSources.productId,
      originalProductId: productSources.originalProductId,
      aspName: productSources.aspName,
    })
    .from(productSources)
    .where(eq(productSources.aspName, 'DUGA'));

  console.log(`Found ${dugaSources.length} DUGA product sources\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dugaSources.length; i++) {
    const source = dugaSources[i];
    const originalProductId = source.originalProductId;

    console.log(`[${i + 1}/${dugaSources.length}] Processing: ${originalProductId}`);

    try {
      // すでにメーカー品番形式（ハイフンが2つ以上、または英字-数字形式）の場合はスキップ
      // 例: GS-2131, DPMI-092 など
      const hyphenCount = (originalProductId.match(/-/g) || []).length;
      const isManufacturerCodeFormat = /^[A-Z]+-\d+/.test(originalProductId);

      if (hyphenCount >= 2 || (hyphenCount === 1 && isManufacturerCodeFormat)) {
        console.log(`  ✓ Skipping (already manufacturer code format): ${originalProductId}`);
        skipCount++;
        continue;
      }

      // メーカー品番を取得
      const manufacturerCode = await fetchManufacturerCode(originalProductId);

      if (manufacturerCode && manufacturerCode !== originalProductId) {
        // データベースを更新
        await db
          .update(productSources)
          .set({ originalProductId: manufacturerCode })
          .where(
            and(
              eq(productSources.id, source.id),
              eq(productSources.aspName, 'DUGA')
            )
          );

        console.log(`  ✓ Updated: ${originalProductId} -> ${manufacturerCode}`);
        successCount++;
      } else if (!manufacturerCode) {
        console.log(`  ✗ No manufacturer code found for ${originalProductId}`);
        failCount++;
      } else {
        console.log(`  - No change needed for ${originalProductId}`);
        skipCount++;
      }

      // レート制限のため少し待機（500ms）
      await new Promise(resolve => setTimeout(resolve, 500));

      // 進捗表示（100件ごと）
      if ((i + 1) % 100 === 0) {
        console.log(`\n--- Progress: ${i + 1}/${dugaSources.length} processed ---`);
        console.log(`  Success: ${successCount}, Failed: ${failCount}, Skipped: ${skipCount}\n`);
      }

    } catch (error) {
      console.error(`  ❌ Error processing ${originalProductId}:`, error);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log('Update Summary');
  console.log('========================================');
  console.log(`Total processed: ${dugaSources.length}`);
  console.log(`  ✓ Successfully updated: ${successCount}`);
  console.log(`  ✗ Failed to fetch: ${failCount}`);
  console.log(`  - Skipped: ${skipCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log('========================================\n');

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
