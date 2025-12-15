import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env.local loading
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const DRY_RUN = process.argv.includes('--dry-run');
const RETENTION_DAYS = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] || '7', 10);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('DATABASE_URL not set');
    return;
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log(`=== DB Cleanup (${DRY_RUN ? 'DRY RUN' : 'LIVE'}) ===`);
  console.log(`Retention: ${RETENTION_DAYS} days\n`);

  // 1. raw_html_data のクリーンアップ
  console.log('Analyzing raw_html_data...');
  const rawHtmlCount = await db.execute(sql`
    SELECT
      COUNT(*) as count,
      pg_size_pretty(SUM(LENGTH(html_content))) as size
    FROM raw_html_data
    WHERE crawled_at < NOW() - INTERVAL '1 day' * ${RETENTION_DAYS}
  `);
  const htmlRow = rawHtmlCount.rows[0] as any;
  console.log(`  Deletable: ${htmlRow.count} rows (${htmlRow.size})`);

  if (!DRY_RUN && parseInt(htmlRow.count) > 0) {
    console.log('  Deleting...');
    await db.execute(sql`
      DELETE FROM raw_html_data
      WHERE crawled_at < NOW() - INTERVAL '1 day' * ${RETENTION_DAYS}
    `);
    console.log('  Done.');
  }

  // 2. wiki_crawl_data のクリーンアップ（処理済みデータは不要）
  console.log('\nAnalyzing wiki_crawl_data (processed)...');
  const wikiCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM wiki_crawl_data
    WHERE processed_at IS NOT NULL
      AND crawled_at < NOW() - INTERVAL '1 day' * ${RETENTION_DAYS}
  `);
  const wikiRow = wikiCount.rows[0] as any;
  console.log(`  Deletable (processed): ${wikiRow.count} rows`);

  if (!DRY_RUN && parseInt(wikiRow.count) > 0) {
    console.log('  Deleting...');
    await db.execute(sql`
      DELETE FROM wiki_crawl_data
      WHERE processed_at IS NOT NULL
        AND crawled_at < NOW() - INTERVAL '1 day' * ${RETENTION_DAYS}
    `);
    console.log('  Done.');
  }

  // 3. sokmil_raw_responses のクリーンアップ
  console.log('\nAnalyzing sokmil_raw_responses...');
  const sokmilCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM sokmil_raw_responses
    WHERE created_at < NOW() - INTERVAL '1 day' * ${RETENTION_DAYS}
  `);
  const sokmilRow = sokmilCount.rows[0] as any;
  console.log(`  Deletable: ${sokmilRow.count} rows`);

  if (!DRY_RUN && parseInt(sokmilRow.count) > 0) {
    console.log('  Deleting...');
    await db.execute(sql`
      DELETE FROM sokmil_raw_responses
      WHERE created_at < NOW() - INTERVAL '1 day' * ${RETENTION_DAYS}
    `);
    console.log('  Done.');
  }

  // 4. duga_raw_responses のクリーンアップ
  console.log('\nAnalyzing duga_raw_responses...');
  const dugaCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM duga_raw_responses
    WHERE created_at < NOW() - INTERVAL '1 day' * ${RETENTION_DAYS}
  `);
  const dugaRow = dugaCount.rows[0] as any;
  console.log(`  Deletable: ${dugaRow.count} rows`);

  if (!DRY_RUN && parseInt(dugaRow.count) > 0) {
    console.log('  Deleting...');
    await db.execute(sql`
      DELETE FROM duga_raw_responses
      WHERE created_at < NOW() - INTERVAL '1 day' * ${RETENTION_DAYS}
    `);
    console.log('  Done.');
  }

  // 5. VACUUM ANALYZE (ストレージ回収)
  if (!DRY_RUN) {
    console.log('\nRunning VACUUM ANALYZE...');
    await db.execute(sql`VACUUM ANALYZE raw_html_data`);
    await db.execute(sql`VACUUM ANALYZE wiki_crawl_data`);
    await db.execute(sql`VACUUM ANALYZE sokmil_raw_responses`);
    await db.execute(sql`VACUUM ANALYZE duga_raw_responses`);
    console.log('Done.');
  }

  // 6. Final stats
  console.log('\n=== Current Table Sizes ===');
  const stats = await db.execute(sql`
    SELECT
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size
    FROM pg_stat_user_tables
    WHERE relname IN ('raw_html_data', 'wiki_crawl_data', 'sokmil_raw_responses', 'duga_raw_responses', 'raw_csv_data')
    ORDER BY pg_total_relation_size(relid) DESC
  `);
  for (const row of stats.rows) {
    console.log(`  ${(row as any).table_name}: ${(row as any).total_size}`);
  }

  await pool.end();
}

main().catch(console.error);
