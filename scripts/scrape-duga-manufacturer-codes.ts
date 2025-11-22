import { getDb } from '../lib/db/index';
import { productSources } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import * as cheerio from 'cheerio';

interface DugaProduct {
  productId: string;
  originalProductId: string;
  manufacturerCode: string | null;
}

async function fetchManufacturerCode(productId: string): Promise<string | null> {
  try {
    const url = `https://duga.jp/ppv/${productId}/`;
    console.log(`Fetching: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // メーカー品番を取得: <span itemprop="mpn">GS-2131</span>
    const manufacturerCode = $('span[itemprop="mpn"]').text().trim();

    if (!manufacturerCode) {
      console.warn(`No manufacturer code found for ${productId}`);
      return null;
    }

    console.log(`Found manufacturer code: ${manufacturerCode}`);
    return manufacturerCode;
  } catch (error) {
    console.error(`Error fetching ${productId}:`, error);
    return null;
  }
}

async function updateManufacturerCode(
  productId: string,
  originalProductId: string,
  manufacturerCode: string
): Promise<void> {
  const db = getDb();

  try {
    await db
      .update(productSources)
      .set({ originalProductId: manufacturerCode })
      .where(eq(productSources.originalProductId, originalProductId));

    console.log(`✓ Updated ${originalProductId} -> ${manufacturerCode}`);
  } catch (error) {
    console.error(`Failed to update ${originalProductId}:`, error);
  }
}

async function main() {
  const db = getDb();

  // DUGAのproduct_sourcesを取得
  const dugaSources = await db
    .select({
      productId: productSources.productId,
      originalProductId: productSources.originalProductId,
      aspName: productSources.aspName,
    })
    .from(productSources)
    .where(eq(productSources.aspName, 'DUGA'));

  console.log(`Found ${dugaSources.length} DUGA products`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < dugaSources.length; i++) {
    const source = dugaSources[i];
    const originalProductId = source.originalProductId;

    console.log(`\n[${i + 1}/${dugaSources.length}] Processing: ${originalProductId}`);

    // すでにメーカー品番形式（ハイフン含む、例: GS-2131）の場合はスキップ
    if (originalProductId.includes('-') && !originalProductId.startsWith('gogos-')) {
      console.log(`Skipping (already has manufacturer code): ${originalProductId}`);
      skipCount++;
      continue;
    }

    // メーカー品番を取得
    const manufacturerCode = await fetchManufacturerCode(originalProductId);

    if (manufacturerCode && manufacturerCode !== originalProductId) {
      await updateManufacturerCode(
        source.productId.toString(),
        originalProductId,
        manufacturerCode
      );
      successCount++;
    } else {
      console.log(`No update needed for ${originalProductId}`);
      failCount++;
    }

    // レート制限のため少し待機（1秒）
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n=== Summary ===');
  console.log(`Total: ${dugaSources.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Skipped: ${skipCount}`);

  process.exit(0);
}

main().catch(console.error);
