/**
 * Apex CSV data import script
 * Run with: DATABASE_URL="..." npx tsx scripts/seed-apex-data.ts
 */

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import * as iconv from 'iconv-lite';
import { getDb } from '../lib/db/index';
import { products, performers, productPerformers, tags, productTags, productSources, productCache } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

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

async function seedApexData() {
  try {
    console.log('Starting Apex CSV import...\n');

    // Read CSV file as buffer
    const buffer = readFileSync('./data/apex.csv');

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

    // Full import (all records)
    console.log(`Starting full import of ${records.length} products...\n`);

    const db = getDb();
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
        const affiliateUrl = record['商品URL'];

        if (!normalizedProductId || !title) {
          console.log(`⚠️  Skipping invalid record: ${normalizedProductId}`);
          skippedCount++;
          continue;
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
          // Product already exists, skip logging for brevity
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

          // Log progress every 100 products
          if (importedCount % 100 === 0) {
            console.log(`Progress: ${importedCount} products imported...`);
          }
        }

        // Insert product source
        const existingSource = await db
          .select()
          .from(productSources)
          .where(eq(productSources.productId, productId))
          .limit(1);

        if (existingSource.length === 0) {
          await db.insert(productSources).values({
            productId,
            aspName: 'DUGA',
            originalProductId: normalizedProductId,
            affiliateUrl,
            price,
            dataSource: 'CSV',
          });
        }

        // Insert product cache
        const existingCache = await db
          .select()
          .from(productCache)
          .where(eq(productCache.productId, productId))
          .limit(1);

        if (existingCache.length === 0) {
          await db.insert(productCache).values({
            productId,
            aspName: 'DUGA',
            price,
            affiliateUrl,
            inStock: true,
          });
        }

        // Insert performer if provided
        if (performerName && performerName.trim() !== '') {
          const existingPerformer = await db
            .select()
            .from(performers)
            .where(eq(performers.name, performerName))
            .limit(1);

          let performerId: number;

          if (existingPerformer.length > 0) {
            performerId = existingPerformer[0].id;
          } else {
            const [insertedPerformer] = await db
              .insert(performers)
              .values({
                name: performerName,
              })
              .returning({ id: performers.id });

            performerId = insertedPerformer.id;
          }

          // Link product to performer
          const existingLink = await db
            .select()
            .from(productPerformers)
            .where(eq(productPerformers.productId, productId))
            .limit(1);

          if (existingLink.length === 0) {
            await db.insert(productPerformers).values({
              productId,
              performerId,
            });
          }
        }

        // Insert category tag
        const category = record['カテゴリ'];
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
          const existingTagLink = await db
            .select()
            .from(productTags)
            .where(eq(productTags.productId, productId))
            .limit(1);

          if (existingTagLink.length === 0) {
            await db.insert(productTags).values({
              productId,
              tagId,
            });
          }
        }

        importedCount++;

      } catch (error) {
        console.error(`❌ Error importing ${record['商品ID']}:`, error);
        errorCount++;
      }
    }

    console.log('\n========================================');
    console.log(`Import completed!`);
    console.log(`  ✓ Imported: ${importedCount}`);
    console.log(`  ⚠️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

seedApexData();
