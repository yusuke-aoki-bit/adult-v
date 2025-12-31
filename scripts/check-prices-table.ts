/**
 * product_prices テーブルの状態確認
 */
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: false,
  });

  try {
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'product_prices'
      ) as table_exists
    `);
    console.log('Table product_prices exists:', tableCheck.rows[0].table_exists);

    if (tableCheck.rows[0].table_exists) {
      // Count rows
      const count = await pool.query('SELECT COUNT(*) as cnt FROM product_prices');
      console.log('Row count:', count.rows[0].cnt);

      // Sample data
      const sample = await pool.query('SELECT * FROM product_prices LIMIT 5');
      console.log('Sample data:', sample.rows);
    } else {
      console.log('Creating table...');
      await pool.query(`
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

      await pool.query('CREATE UNIQUE INDEX idx_prices_source_type ON product_prices(product_source_id, price_type)');
      await pool.query('CREATE INDEX idx_prices_source ON product_prices(product_source_id)');
      await pool.query('CREATE INDEX idx_prices_type ON product_prices(price_type)');
      console.log('Indexes created');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
