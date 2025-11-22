/**
 * Truncate all tables script
 * Run with: DATABASE_URL="..." npx tsx scripts/truncate-db.ts
 */

import { getDb } from '../lib/db/index';
import { products, performers, productPerformers, tags, productTags, productSources, productCache, rawCsvData, rawHtmlData } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

async function truncateAllTables() {
  try {
    console.log('Starting database truncate...\n');

    const db = getDb();

    // Truncate all tables using SQL TRUNCATE for better reliability
    console.log('Truncating product_cache...');
    await db.execute(sql`TRUNCATE TABLE product_cache CASCADE`);

    console.log('Truncating product_sources...');
    await db.execute(sql`TRUNCATE TABLE product_sources CASCADE`);

    console.log('Truncating product_tags...');
    await db.execute(sql`TRUNCATE TABLE product_tags CASCADE`);

    console.log('Truncating product_performers...');
    await db.execute(sql`TRUNCATE TABLE product_performers CASCADE`);

    console.log('Truncating tags...');
    await db.execute(sql`TRUNCATE TABLE tags CASCADE`);

    console.log('Truncating performers...');
    await db.execute(sql`TRUNCATE TABLE performers CASCADE`);

    console.log('Truncating products...');
    await db.execute(sql`TRUNCATE TABLE products CASCADE`);

    console.log('Truncating raw_csv_data...');
    await db.execute(sql`TRUNCATE TABLE raw_csv_data CASCADE`);

    console.log('Truncating raw_html_data...');
    await db.execute(sql`TRUNCATE TABLE raw_html_data CASCADE`);

    // Reset sequences (PostgreSQL specific)
    console.log('\nResetting sequences...');
    await db.execute(sql`ALTER SEQUENCE products_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE performers_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE tags_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE product_sources_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE product_cache_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE raw_csv_data_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE raw_html_data_id_seq RESTART WITH 1`);

    console.log('\n========================================');
    console.log('Database truncated successfully!');
    console.log('All tables are now empty.');
    console.log('========================================\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

truncateAllTables();
