/**
 * product_prices テーブルマイグレーションスクリプト
 * Cloud Run Job経由で実行される
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../packages/crawlers/src/lib/db';

async function runMigration() {
  const db = getDb();

  console.log('Starting product_prices migration...');

  // Check if table exists
  const checkResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'product_prices'
    ) as table_exists
  `);

  const tableExists = (checkResult.rows[0] as { table_exists: boolean }).table_exists;
  console.log('Table product_prices exists:', tableExists);

  if (tableExists) {
    const countResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM product_prices`);
    console.log('Current row count:', (countResult.rows[0] as { cnt: string }).cnt);
    console.log('Migration already applied, skipping...');
    process.exit(0);
  }

  // Create table
  console.log('Creating product_prices table...');
  await db.execute(sql`
    CREATE TABLE product_prices (
      id SERIAL PRIMARY KEY,
      product_source_id INTEGER NOT NULL REFERENCES product_sources(id) ON DELETE CASCADE,
      price_type VARCHAR(30) NOT NULL,
      price INTEGER NOT NULL,
      currency VARCHAR(3) DEFAULT 'JPY',
      is_default BOOLEAN DEFAULT FALSE,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Table created');

  // Create indexes
  console.log('Creating indexes...');
  await db.execute(sql`CREATE UNIQUE INDEX idx_prices_source_type ON product_prices(product_source_id, price_type)`);
  await db.execute(sql`CREATE INDEX idx_prices_source ON product_prices(product_source_id)`);
  await db.execute(sql`CREATE INDEX idx_prices_type ON product_prices(price_type)`);
  console.log('Indexes created');

  // Check existing columns in product_sources
  const colResult = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'product_sources'
    AND column_name IN ('download_price', 'streaming_price', 'hd_price', 'four_k_price')
  `);
  const existingCols = (colResult.rows as { column_name: string }[]).map(r => r.column_name);
  console.log('Found price columns in product_sources:', existingCols);

  // Migrate data
  if (existingCols.includes('download_price')) {
    console.log('Migrating download_price...');
    await db.execute(sql`
      INSERT INTO product_prices (product_source_id, price_type, price, is_default, display_order)
      SELECT id, 'download', download_price, FALSE, 2
      FROM product_sources
      WHERE download_price IS NOT NULL
      ON CONFLICT (product_source_id, price_type) DO NOTHING
    `);
    console.log('Migrated download_price');
  }

  if (existingCols.includes('streaming_price')) {
    console.log('Migrating streaming_price...');
    await db.execute(sql`
      INSERT INTO product_prices (product_source_id, price_type, price, is_default, display_order)
      SELECT id, 'streaming', streaming_price, FALSE, 3
      FROM product_sources
      WHERE streaming_price IS NOT NULL
      ON CONFLICT (product_source_id, price_type) DO NOTHING
    `);
    console.log('Migrated streaming_price');
  }

  if (existingCols.includes('hd_price')) {
    console.log('Migrating hd_price...');
    await db.execute(sql`
      INSERT INTO product_prices (product_source_id, price_type, price, is_default, display_order)
      SELECT id, 'hd', hd_price, TRUE, 1
      FROM product_sources
      WHERE hd_price IS NOT NULL
      ON CONFLICT (product_source_id, price_type) DO NOTHING
    `);
    console.log('Migrated hd_price');
  }

  if (existingCols.includes('four_k_price')) {
    console.log('Migrating four_k_price...');
    await db.execute(sql`
      INSERT INTO product_prices (product_source_id, price_type, price, is_default, display_order)
      SELECT id, '4k', four_k_price, FALSE, 0
      FROM product_sources
      WHERE four_k_price IS NOT NULL
      ON CONFLICT (product_source_id, price_type) DO NOTHING
    `);
    console.log('Migrated four_k_price');
  }

  // Create update trigger (raw SQL for PL/pgSQL)
  console.log('Creating update trigger...');
  await db.execute(sql.raw(`
    CREATE OR REPLACE FUNCTION update_product_prices_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `));

  await db.execute(sql`DROP TRIGGER IF EXISTS trigger_update_product_prices_updated_at ON product_prices`);

  await db.execute(sql.raw(`
    CREATE TRIGGER trigger_update_product_prices_updated_at
    BEFORE UPDATE ON product_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_product_prices_updated_at()
  `));
  console.log('Trigger created');

  // Final count
  const finalCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM product_prices`);
  console.log('Final row count:', (finalCount.rows[0] as { cnt: string }).cnt);

  console.log('Migration completed successfully!');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
