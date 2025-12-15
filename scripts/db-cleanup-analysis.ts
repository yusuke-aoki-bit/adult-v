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

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('DATABASE_URL not set');
    return;
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log('=== DB Cleanup Analysis ===\n');

  // 1. raw_html_data の古いデータ
  const rawHtmlAge = await db.execute(sql`
    SELECT
      DATE_TRUNC('month', crawled_at) as month,
      COUNT(*) as count,
      pg_size_pretty(SUM(LENGTH(html_content))) as size
    FROM raw_html_data
    GROUP BY DATE_TRUNC('month', crawled_at)
    ORDER BY month DESC
    LIMIT 12
  `);
  console.log('raw_html_data by month:');
  for (const row of rawHtmlAge.rows) {
    console.log(`  ${(row as any).month}: ${(row as any).count} rows (${(row as any).size})`);
  }

  // 2. raw_csv_data の古いデータ
  const rawCsvAge = await db.execute(sql`
    SELECT
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as count
    FROM raw_csv_data
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
    LIMIT 12
  `);
  console.log('\nraw_csv_data by month:');
  for (const row of rawCsvAge.rows) {
    console.log(`  ${(row as any).month}: ${(row as any).count} rows`);
  }

  // 3. sokmil_raw_responses の古いデータ
  const sokmilAge = await db.execute(sql`
    SELECT
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as count
    FROM sokmil_raw_responses
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
    LIMIT 12
  `);
  console.log('\nsokmil_raw_responses by month:');
  for (const row of sokmilAge.rows) {
    console.log(`  ${(row as any).month}: ${(row as any).count} rows`);
  }

  // 4. duga_raw_responses の古いデータ
  const dugaAge = await db.execute(sql`
    SELECT
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as count
    FROM duga_raw_responses
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
    LIMIT 12
  `);
  console.log('\nduga_raw_responses by month:');
  for (const row of dugaAge.rows) {
    console.log(`  ${(row as any).month}: ${(row as any).count} rows`);
  }

  // 5. wiki_crawl_data の古いデータ
  const wikiAge = await db.execute(sql`
    SELECT
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as count
    FROM wiki_crawl_data
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
    LIMIT 12
  `);
  console.log('\nwiki_crawl_data by month:');
  for (const row of wikiAge.rows) {
    console.log(`  ${(row as any).month}: ${(row as any).count} rows`);
  }

  // 6. product_views の古いデータ（もしある場合）
  try {
    const viewsAge = await db.execute(sql`
      SELECT
        DATE_TRUNC('month', viewed_at) as month,
        COUNT(*) as count
      FROM product_views
      GROUP BY DATE_TRUNC('month', viewed_at)
      ORDER BY month DESC
      LIMIT 12
    `);
    console.log('\nproduct_views by month:');
    for (const row of viewsAge.rows) {
      console.log(`  ${(row as any).month}: ${(row as any).count} rows`);
    }
  } catch (e) {
    console.log('\nproduct_views: table does not exist or error');
  }

  // 7. 削除可能なデータ量の見積もり（30日以上前のraw_html_data）
  const cleanupEstimate = await db.execute(sql`
    SELECT
      COUNT(*) as deletable_rows,
      pg_size_pretty(SUM(LENGTH(html_content))) as deletable_size
    FROM raw_html_data
    WHERE crawled_at < NOW() - INTERVAL '30 days'
  `);
  console.log('\n=== Cleanup Estimate ===');
  console.log('raw_html_data older than 30 days:');
  for (const row of cleanupEstimate.rows) {
    console.log(`  ${(row as any).deletable_rows} rows (${(row as any).deletable_size})`);
  }

  await pool.end();
}

main().catch(console.error);
