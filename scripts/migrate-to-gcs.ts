/**
 * 既存データをGCSに移行するスクリプト
 * raw_html_data, raw_csv_data, wiki_crawl_dataのデータをGCSに移行
 *
 * 使用方法:
 *   npx tsx scripts/migrate-to-gcs.ts [--table=raw_html_data] [--batch=100] [--dry-run]
 */

import { db } from '../lib/db/index.js';
import { rawHtmlData, rawCsvData, wikiCrawlData } from '../lib/db/schema.js';
import { sql, eq, isNull, isNotNull, and } from 'drizzle-orm';
import { saveHtmlToGcs, saveJsonToGcs, checkGoogleApiConfig } from '../lib/google-apis.js';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  savedBytes: number;
}

async function migrateRawHtmlData(batchSize: number, dryRun: boolean): Promise<MigrationStats> {
  console.log('\n=== Migrating raw_html_data ===\n');

  const stats: MigrationStats = { total: 0, migrated: 0, skipped: 0, errors: 0, savedBytes: 0 };

  // GCSに移行されていないレコードを取得
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM raw_html_data
    WHERE gcs_url IS NULL AND html_content IS NOT NULL
  `);
  stats.total = Number(countResult.rows[0].cnt);
  console.log(`Found ${stats.total} records to migrate`);

  if (dryRun) {
    console.log('[DRY RUN] Skipping actual migration');
    return stats;
  }

  let offset = 0;
  while (offset < stats.total) {
    const records = await db.execute(sql`
      SELECT id, source, product_id, html_content
      FROM raw_html_data
      WHERE gcs_url IS NULL AND html_content IS NOT NULL
      ORDER BY id
      LIMIT ${batchSize} OFFSET ${offset}
    `);

    for (const row of records.rows as any[]) {
      try {
        const html = row.html_content as string;
        const originalSize = Buffer.byteLength(html, 'utf-8');

        const gcsUrl = await saveHtmlToGcs(
          row.source.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          row.product_id,
          html
        );

        if (gcsUrl) {
          // DBを更新（html_contentをnullに、gcs_urlを設定）
          await db.execute(sql`
            UPDATE raw_html_data
            SET gcs_url = ${gcsUrl}, html_content = NULL
            WHERE id = ${row.id}
          `);
          stats.migrated++;
          stats.savedBytes += originalSize;

          if (stats.migrated % 100 === 0) {
            console.log(`Progress: ${stats.migrated}/${stats.total} (${((stats.migrated / stats.total) * 100).toFixed(1)}%)`);
          }
        } else {
          stats.errors++;
        }
      } catch (error) {
        console.error(`Error migrating id=${row.id}:`, error);
        stats.errors++;
      }
    }

    offset += batchSize;

    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return stats;
}

async function migrateRawCsvData(batchSize: number, dryRun: boolean): Promise<MigrationStats> {
  console.log('\n=== Migrating raw_csv_data ===\n');

  const stats: MigrationStats = { total: 0, migrated: 0, skipped: 0, errors: 0, savedBytes: 0 };

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM raw_csv_data
    WHERE gcs_url IS NULL AND raw_data IS NOT NULL
  `);
  stats.total = Number(countResult.rows[0].cnt);
  console.log(`Found ${stats.total} records to migrate`);

  if (dryRun) {
    console.log('[DRY RUN] Skipping actual migration');
    return stats;
  }

  let offset = 0;
  while (offset < stats.total) {
    const records = await db.execute(sql`
      SELECT id, source, product_id, raw_data
      FROM raw_csv_data
      WHERE gcs_url IS NULL AND raw_data IS NOT NULL
      ORDER BY id
      LIMIT ${batchSize} OFFSET ${offset}
    `);

    for (const row of records.rows as any[]) {
      try {
        const jsonStr = JSON.stringify(row.raw_data);
        const originalSize = Buffer.byteLength(jsonStr, 'utf-8');

        const gcsUrl = await saveJsonToGcs(
          row.source.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          row.product_id,
          row.raw_data
        );

        if (gcsUrl) {
          await db.execute(sql`
            UPDATE raw_csv_data
            SET gcs_url = ${gcsUrl}, raw_data = NULL
            WHERE id = ${row.id}
          `);
          stats.migrated++;
          stats.savedBytes += originalSize;

          if (stats.migrated % 100 === 0) {
            console.log(`Progress: ${stats.migrated}/${stats.total} (${((stats.migrated / stats.total) * 100).toFixed(1)}%)`);
          }
        } else {
          stats.errors++;
        }
      } catch (error) {
        console.error(`Error migrating id=${row.id}:`, error);
        stats.errors++;
      }
    }

    offset += batchSize;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return stats;
}

async function migrateWikiCrawlData(batchSize: number, dryRun: boolean): Promise<MigrationStats> {
  console.log('\n=== Migrating wiki_crawl_data ===\n');

  const stats: MigrationStats = { total: 0, migrated: 0, skipped: 0, errors: 0, savedBytes: 0 };

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM wiki_crawl_data
    WHERE gcs_url IS NULL AND raw_data IS NOT NULL
  `);
  stats.total = Number(countResult.rows[0].cnt);
  console.log(`Found ${stats.total} records to migrate`);

  if (dryRun) {
    console.log('[DRY RUN] Skipping actual migration');
    return stats;
  }

  let offset = 0;
  while (offset < stats.total) {
    const records = await db.execute(sql`
      SELECT id, source, product_code, performer_name, raw_data
      FROM wiki_crawl_data
      WHERE gcs_url IS NULL AND raw_data IS NOT NULL
      ORDER BY id
      LIMIT ${batchSize} OFFSET ${offset}
    `);

    for (const row of records.rows as any[]) {
      try {
        const jsonStr = JSON.stringify(row.raw_data);
        const originalSize = Buffer.byteLength(jsonStr, 'utf-8');

        // wiki_crawl_dataはproduct_code + performer_nameでユニーク
        const objectId = `${row.product_code}_${row.performer_name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const gcsUrl = await saveJsonToGcs(
          `wiki-${row.source.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          objectId,
          row.raw_data
        );

        if (gcsUrl) {
          await db.execute(sql`
            UPDATE wiki_crawl_data
            SET gcs_url = ${gcsUrl}, raw_data = NULL
            WHERE id = ${row.id}
          `);
          stats.migrated++;
          stats.savedBytes += originalSize;

          if (stats.migrated % 500 === 0) {
            console.log(`Progress: ${stats.migrated}/${stats.total} (${((stats.migrated / stats.total) * 100).toFixed(1)}%)`);
          }
        } else {
          stats.errors++;
        }
      } catch (error) {
        console.error(`Error migrating id=${row.id}:`, error);
        stats.errors++;
      }
    }

    offset += batchSize;
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const tableArg = args.find(a => a.startsWith('--table='))?.split('=')[1];
  const batchArg = args.find(a => a.startsWith('--batch='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');

  const batchSize = batchArg ? parseInt(batchArg) : 100;
  const tables = tableArg ? [tableArg] : ['raw_html_data', 'raw_csv_data', 'wiki_crawl_data'];

  console.log('=== GCS Migration Script ===');
  console.log(`Tables: ${tables.join(', ')}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Dry run: ${dryRun}`);

  // GCS設定確認
  const config = checkGoogleApiConfig();
  if (!config.cloudStorage) {
    console.error('\nError: Cloud Storage is not configured.');
    console.error('Please set GOOGLE_SERVICE_ACCOUNT_KEY environment variable.');
    process.exit(1);
  }
  console.log('GCS: Configured ✓\n');

  const allStats: Record<string, MigrationStats> = {};

  for (const table of tables) {
    switch (table) {
      case 'raw_html_data':
        allStats[table] = await migrateRawHtmlData(batchSize, dryRun);
        break;
      case 'raw_csv_data':
        allStats[table] = await migrateRawCsvData(batchSize, dryRun);
        break;
      case 'wiki_crawl_data':
        allStats[table] = await migrateWikiCrawlData(batchSize, dryRun);
        break;
      default:
        console.warn(`Unknown table: ${table}`);
    }
  }

  // サマリー
  console.log('\n\n=== Migration Summary ===\n');
  let totalSaved = 0;
  for (const [table, stats] of Object.entries(allStats)) {
    console.log(`${table}:`);
    console.log(`  Total: ${stats.total}`);
    console.log(`  Migrated: ${stats.migrated}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Saved: ${(stats.savedBytes / 1024 / 1024).toFixed(2)} MB`);
    totalSaved += stats.savedBytes;
  }
  console.log(`\nTotal DB space saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);

  process.exit(0);
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
