/**
 * Download and seed DUGA CSV data script
 * Downloads CSV from DUGA and imports it
 * Run with: DATABASE_URL="..." npx tsx scripts/download-and-seed-duga.ts
 */

import { writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import * as iconv from 'iconv-lite';
import { createHash } from 'crypto';
import { getDb } from '../lib/db/index';
import { products, performers, productPerformers, tags, productTags, productSources, productCache, rawCsvData } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateDUGALink } from '../lib/affiliate';
import * as cheerio from 'cheerio';

interface ApexCsvRow {
  '商品ID': string;
  'タイトル': string;
  '紹介文': string;
  'レーベル名': string;
  'メーカー名': string;
  'カテゴリ': string;
  '価格': string;
  'レーベル種別': string;
  '出演者': string;
  '公開開始日': string;
  '商品URL': string;
}

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

async function downloadDugaCsv(): Promise<Buffer> {
  console.log('Downloading DUGA CSV from https://duga.jp/productcsv/ ...\n');

  try {
    const response = await fetch('https://duga.jp/productcsv/');

    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    console.log(`Downloaded ${buffer.byteLength} bytes\n`);

    return Buffer.from(buffer);
  } catch (error) {
    console.error('Error downloading CSV:', error);
    throw error;
  }
}

async function downloadAndSeedDuga() {
  try {
    console.log('Starting DUGA CSV download and import...\n');

    // Download CSV
    const buffer = await downloadDugaCsv();

    // Save to file (optional, for backup)
    writeFileSync('./data/apex.csv', buffer);
    console.log('Saved CSV to ./data/apex.csv\n');

    // Convert from Shift-JIS to UTF-8
    const csvContent = iconv.decode(buffer, 'shift_jis');

    // Parse CSV
    const records: ApexCsvRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    console.log(`Found ${records.length} products in CSV\n`);

    // Get DUGA site tag ID
    const db = getDb();
    const dugaTagResult = await db
      .select()
      .from(tags)
      .where(eq(tags.name, 'DUGA'))
      .limit(1);

    const dugaTagId = dugaTagResult.length > 0 ? dugaTagResult[0].id : null;
    if (!dugaTagId) {
      console.error('⚠️  DUGA tag not found. Please run seed-site-tags.ts first.');
    }

    // Import data
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const record of records) {
      try {
        // Extract data
        const normalizedProductId = record['商品ID'];
        const title = record['タイトル'];
        const description = record['紹介文'] || '';
        const price = parseInt(record['価格']) || 0;
        const performerName = record['出演者'] || '';
        const releaseDateStr = record['公開開始日'];
        const rawUrl = record['商品URL'];
        // DUGAアフィリエイトIDを追加
        const affiliateUrl = generateDUGALink(rawUrl);
        const category = record['カテゴリ'];

        if (!normalizedProductId || !title) {
          skippedCount++;
          continue;
        }

        // 生データのハッシュを計算
        const dataString = JSON.stringify(record);
        const hash = createHash('sha256').update(dataString).digest('hex');

        // 生データを保存（source + product_idで重複チェック）
        const existingRawData = await db
          .select()
          .from(rawCsvData)
          .where(eq(rawCsvData.productId, normalizedProductId))
          .limit(1);

        let rawDataId: number;
        if (existingRawData.length > 0) {
          // 同じproduct_idのデータが既に存在する場合はスキップ
          rawDataId = existingRawData[0].id;
          skippedCount++;
          continue;
        } else {
          // 新しい生データを保存
          try {
            const [insertedRawData] = await db
              .insert(rawCsvData)
              .values({
                source: 'DUGA',
                productId: normalizedProductId,
                rawData: record,
                hash,
              })
              .returning({ id: rawCsvData.id });

            rawDataId = insertedRawData.id;
          } catch (insertError: any) {
            // 重複エラーの場合はスキップ
            if (insertError.code === '23505') {
              skippedCount++;
              continue;
            }
            throw insertError;
          }
        }

        // Parse release date (format: 2010年01月28日)
        let releaseDate: string | undefined = undefined;
        if (releaseDateStr) {
          const match = releaseDateStr.match(/(\d{4})年(\d{2})月(\d{2})日/);
          if (match) {
            releaseDate = `${match[1]}-${match[2]}-${match[3]}`;
          }
        }

        // Check if product already exists
        const existingProduct = await db
          .select()
          .from(products)
          .where(eq(products.normalizedProductId, normalizedProductId))
          .limit(1);

        let productId: number;

        if (existingProduct.length > 0) {
          productId = existingProduct[0].id;
          skippedCount++;
          continue;
        } else {
          // Insert product
          const [insertedProduct] = await db
            .insert(products)
            .values({
              normalizedProductId,
              title,
              description,
              releaseDate,
            })
            .returning({ id: products.id });

          productId = insertedProduct.id;

          // Log progress every 1000 products
          if (importedCount % 1000 === 0 && importedCount > 0) {
            console.log(`Progress: ${importedCount} products imported...`);
          }
        }

        // メーカー品番をスクレイピング（新規商品のみ）
        console.log(`  [NEW] Scraping manufacturer code for ${normalizedProductId}...`);
        const manufacturerCode = await fetchManufacturerCode(normalizedProductId);

        // レート制限のため少し待機（500ms）
        await new Promise(resolve => setTimeout(resolve, 500));

        // Insert product source
        await db.insert(productSources).values({
          productId,
          aspName: 'DUGA',
          originalProductId: manufacturerCode || normalizedProductId, // メーカー品番がある場合はそれを使用
          affiliateUrl,
          price,
          dataSource: 'CSV',
        });

        // Insert product cache
        await db.insert(productCache).values({
          productId,
          aspName: 'DUGA',
          price,
          affiliateUrl,
          inStock: true,
        }).onConflictDoNothing();

        // Insert performers if provided (split by comma)
        if (performerName && performerName.trim() !== '') {
          // Split performer names by comma and process each one
          const performerNames = performerName.split(',').map(name => name.trim()).filter(name => name !== '');

          for (const singlePerformerName of performerNames) {
            // Skip if name is too long (database limit is 200 chars)
            if (singlePerformerName.length > 200) {
              console.warn(`⚠️  Skipping performer name (too long): ${singlePerformerName.substring(0, 50)}...`);
              continue;
            }

            const existingPerformer = await db
              .select()
              .from(performers)
              .where(eq(performers.name, singlePerformerName))
              .limit(1);

            let performerId: number;

            if (existingPerformer.length > 0) {
              performerId = existingPerformer[0].id;
            } else {
              const [insertedPerformer] = await db
                .insert(performers)
                .values({ name: singlePerformerName })
                .returning({ id: performers.id });

              performerId = insertedPerformer.id;
            }

            // Link product to performer
            await db.insert(productPerformers).values({
              productId,
              performerId,
            }).onConflictDoNothing();
          }
        }

        // Insert category tag (genre)
        if (category && category.trim() !== '') {
          const existingTag = await db
            .select()
            .from(tags)
            .where(eq(tags.name, category))
            .limit(1);

          let tagId: number;

          if (existingTag.length > 0) {
            tagId = existingTag[0].id;
          } else {
            const [insertedTag] = await db
              .insert(tags)
              .values({
                name: category,
                category: 'genre',
              })
              .returning({ id: tags.id });

            tagId = insertedTag.id;
          }

          // Link product to tag
          await db.insert(productTags).values({
            productId,
            tagId,
          }).onConflictDoNothing();
        }

        // Link to DUGA site tag
        if (dugaTagId) {
          await db.insert(productTags).values({
            productId,
            tagId: dugaTagId,
          }).onConflictDoNothing();
        }

        // 生データの処理完了をマーク
        await db
          .update(rawCsvData)
          .set({ processedAt: new Date() })
          .where(eq(rawCsvData.id, rawDataId));

        importedCount++;

      } catch (error) {
        console.error(`❌ Error importing ${record['商品ID']}:`, error);
        errorCount++;
      }
    }

    console.log('\n========================================');
    console.log(`DUGA Import completed!`);
    console.log(`  ✓ Imported: ${importedCount}`);
    console.log(`  ⚠️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

downloadAndSeedDuga();
